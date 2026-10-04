'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const https = require('https');
const net = require('net');
const { spawn, spawnSync } = require('child_process');
const { once } = require('events');
const WebSocket = require('ws');

const repo = path.resolve(__dirname, '..');
const output = path.join(repo, '.test-output');
fs.mkdirSync(output, { recursive: true });
const work = fs.mkdtempSync(path.join(output, 'servers-'));
let ca;
before(() => {
    const result = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
        '-days', '1', '-keyout', path.join(work, 'server.key'), '-out', path.join(work, 'server.crt'),
        '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost'],
    { encoding: 'utf8', windowsHide: true, timeout: 30000 });
    assert.equal(result.status, 0, String(result.error || result.stderr));
    ca = fs.readFileSync(path.join(work, 'server.crt'));
});
after(() => {
    if (path.dirname(work) === output && path.basename(work).startsWith('servers-')) {
        fs.rmSync(work, { recursive: true, force: true });
    }
});

async function start(t, script) {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const child = spawn(process.execPath, [script], {
        cwd: repo, windowsHide: true,
        env: { ...process.env, UV_THREADPOOL_SIZE: '2', PORT: String(port), SERVER_KEY: '', SERVER_CERT: '',
            KEY_PATH: path.join(work, 'server.key'), CERT_PATH: path.join(work, 'server.crt') }
    });
    const sockets = [];
    t.after(async () => {
        for (const socket of sockets) socket.terminate();
        if (child.exitCode === null && child.signalCode === null) {
            const exited = once(child, 'exit');
            child.kill();
            await exited;
        }
    });
    await new Promise((resolve, reject) => {
        let logs = '';
        const timer = setTimeout(() => reject(new Error('Server startup timed out: ' + logs)), 10000);
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.on('exit', () => { clearTimeout(timer); reject(new Error(logs)); });
        child.stderr.on('data', data => { logs += data; });
        child.stdout.on('data', data => { logs += data; clearTimeout(timer); resolve(); });
    });
    return {
        port,
        async peer() {
            const ws = new WebSocket('wss://127.0.0.1:' + port, { ca });
            sockets.push(ws);
            const messages = [];
            ws.on('message', raw => messages.push(raw.toString()));
            await once(ws, 'open');
            return {
                ws, messages,
                async send(data) {
                    ws.send(typeof data === 'string' ? data : JSON.stringify(data));
                    const pong = once(ws, 'pong');
                    ws.ping();
                    await pong;
                },
                async next() {
                    const deadline = Date.now() + 3000;
                    while (!messages.length && Date.now() < deadline) {
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                    assert.ok(messages.length, 'Expected a message');
                    return JSON.parse(messages.shift());
                },
                async close() { const closed = once(ws, 'close'); ws.close(); await closed; }
            };
        }
    };
}

test('basic server uses configured TLS/port and fans out raw messages', async t => {
    const server = await start(t, 'server.js');
    const a = await server.peer(), b = await server.peer(), c = await server.peer();
    await a.send('hello');
    await b.send('barrier');
    await c.send('barrier');
    assert.ok(b.messages.includes('hello'));
    assert.ok(c.messages.includes('hello'));
    assert.ok(!a.messages.includes('hello'));
});

test('legacy server ignores malformed message shapes and retains room filtering', async t => {
    const server = await start(t, 'vdoninja.js');
    const a = await server.peer(), b = await server.peer(), outsider = await server.peer();
    for (const raw of ['{', 'null', '[]', '42', '"text"']) await a.send(raw);
    await a.send({ request: 'joinroom', from: 'a', roomid: 'studio' });
    await b.send({ request: 'joinroom', from: 'b', roomid: 'studio' });
    await a.send({ from: 'a', UUID: 'b', description: { type: 'offer' } });
    assert.equal((await b.next()).description.type, 'offer');
    assert.deepEqual(outsider.messages, []);
});

test('advanced server rejects malformed shapes and uses connection-owned sender identities', async t => {
    const server = await start(t, 'vdoninja_advanced.js');
    const publisher = await server.peer(), viewer = await server.peer(), outsider = await server.peer();
    for (const raw of ['{', 'null', '[]', '42', '"text"']) await publisher.send(raw);
    await publisher.send({ request: 'seed', streamID: 'stream' });
    await viewer.send({ request: 'play', streamID: 'stream' });
    const request = await publisher.next();
    assert.equal(request.request, 'offerSDP');
    await publisher.send({ UUID: request.UUID, from: 'forged', description: { type: 'offer' } });
    const offer = await viewer.next();
    assert.match(offer.UUID, /^[0-9a-f-]{36}$/);
    assert.notEqual(offer.UUID, request.UUID);
    assert.equal(offer.from, undefined);
    assert.equal(offer.description.type, 'offer');
    assert.deepEqual(outsider.messages, []);
});

test('advanced stream ownership rejects renames but permits repeat seeds and reuse after disconnect', async t => {
    const server = await start(t, 'vdoninja_advanced.js');
    const a = await server.peer(), b = await server.peer(), viewer = await server.peer();
    await a.send({ request: 'seed', streamID: 'old' });
    await a.send({ request: 'seed', streamID: 'old' });
    assert.deepEqual(a.messages, []);
    await a.send({ request: 'seed', streamID: 'new' });
    assert.match((await a.next()).message, /cannot change/);
    await b.send({ request: 'seed', streamID: 'new' });
    await viewer.send({ request: 'play', streamID: 'new' });
    assert.equal((await b.next()).request, 'offerSDP');
    await b.send({ request: 'seed', streamID: 'old' });
    assert.equal((await b.next()).request, 'alert');
    await a.close();
    const replacement = await server.peer();
    await replacement.send({ request: 'seed', streamID: 'old' });
    await viewer.send({ request: 'play', streamID: 'old' });
    assert.equal((await replacement.next()).request, 'offerSDP');
});

test('advanced waiting viewers and room listings retain their protocol', async t => {
    const server = await start(t, 'vdoninja_advanced.js');
    const viewer = await server.peer(), publisher = await server.peer();
    await viewer.send({ request: 'play', streamID: 'later' });
    await publisher.send({ request: 'seed', streamID: 'later' });
    assert.equal((await publisher.next()).request, 'offerSDP');
    const director = await server.peer(), guest = await server.peer();
    await director.send({ request: 'joinroom', roomid: 'studio', claim: true });
    assert.deepEqual(await director.next(), { request: 'listing', list: [], claim: true });
    await guest.send({ request: 'joinroom', roomid: 'STUDIO' });
    const listing = await guest.next();
    assert.equal(listing.director, listing.list[0].UUID);
    const joined = await director.next();
    await guest.send({ request: 'seed', streamID: 'guest' });
    assert.deepEqual(await director.next(), { request: 'videoaddedtoroom', UUID: joined.UUID, streamID: 'guest' });
});

test('advanced HTTPS endpoint presents the configured certificate', async t => {
    const server = await start(t, 'vdoninja_advanced.js');
    function get(trust) {
        return new Promise((resolve, reject) => {
            https.get({ hostname: '127.0.0.1', port: server.port, ca: trust }, res => {
                let body = '';
                res.on('data', chunk => { body += chunk; });
                res.on('end', () => resolve(body));
            }).on('error', reject);
        });
    }
    assert.equal(await get(ca), 'Secure VDONinja server');
    await assert.rejects(get(undefined), /certificate|self.signed/i);
});
