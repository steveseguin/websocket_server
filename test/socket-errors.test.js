'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const WebSocket = require('ws');

// Exercise the real entrypoint callbacks without opening sockets or reading keys.
function loadServer(script) {
    let server;
    let listens = 0;
    class StubServer extends EventEmitter {
        constructor() {
            super();
            this.clients = new Set();
            server = this;
        }
        peer() {
            // The real ws EventEmitter error behavior is important to this test.
            const peer = new WebSocket(null, undefined, {});
            peer._readyState = WebSocket.OPEN;
            peer.messages = [];
            peer.terminations = 0;
            peer.send = message => peer.messages.push(message);
            peer.terminate = () => {
                peer.terminations++;
                peer._readyState = WebSocket.CLOSED;
                peer.emit('close');
            };
            this.clients.add(peer);
            peer.on('close', () => this.clients.delete(peer));
            this.emit('connection', peer);
            return peer;
        }
    }
    const dependencies = {
        fs: { readFileSync: () => Buffer.from('inert certificate placeholder') },
        https: {
            createServer: () => ({
                listen: (_port, callback) => { listens++; callback(); }
            })
        },
        express: () => ({ use() {} }),
        cors: () => () => {},
        ws: { Server: StubServer }
    };
    vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, '..', script), 'utf8'),
        {
            require(name) {
                assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
                return dependencies[name];
            },
            process: { env: {} },
            console: { log() {} }
        },
        { filename: script }
    );
    assert.equal(listens, 1);
    assert.ok(server);
    return server;
}

for (const script of ['server.js', 'vdoninja.js']) {
    test(`${script} contains a socket error before any application message`, () => {
        const server = loadServer(script);
        const failed = server.peer();
        const healthy = server.peer();
        const error = new Error('synthetic receiver failure');
        assert.doesNotThrow(() => failed.emit('error', error));
        assert.equal(failed.terminations, 1);
        assert.equal(server.clients.has(failed), false);
        assert.equal(healthy.terminations, 0);
        assert.equal(server.clients.has(healthy), true);
    });

    test(`${script} preserves healthy delivery after another socket fails`, () => {
        const server = loadServer(script);
        const failed = server.peer();
        const publisher = server.peer();
        const viewer = server.peer();
        const outsider = server.peer();
        if (script === 'vdoninja.js') {
            failed.emit('message', Buffer.from(JSON.stringify({ from: 'failed', request: 'joinroom', roomid: 'studio' })));
            publisher.emit('message', Buffer.from(JSON.stringify({ from: 'publisher', request: 'joinroom', roomid: 'studio' })));
            viewer.emit('message', Buffer.from(JSON.stringify({ from: 'viewer', request: 'joinroom', roomid: 'studio' })));
        }
        for (const peer of server.clients) peer.messages.length = 0;
        assert.doesNotThrow(() => failed.emit('error', new Error('synthetic receiver failure')));
        const message = JSON.stringify({ from: 'publisher', UUID: 'viewer', description: { type: 'offer' } });
        publisher.emit('message', Buffer.from(message));
        assert.deepEqual(viewer.messages, [message]);
        assert.deepEqual(publisher.messages, []);
        assert.deepEqual(failed.messages, []);
        assert.deepEqual(outsider.messages, script === 'server.js' ? [message] : []);
        assert.equal(publisher.terminations, 0);
        assert.equal(viewer.terminations, 0);
    });
}
