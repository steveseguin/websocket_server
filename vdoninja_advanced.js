/*
VDO.Ninja Advanced Example
Copyright Steve Seguin
License: AGPLv3
&wss2=wss.yourdomain.com -- if testing via URL
session.wss = "wss://wss.yourdomain.com:443";
session.customWSS = false;
*/
const fs = require('fs');
const http = require('http');
const https = require('https');
const { WebSocketServer, WebSocket } = require('ws');
const { randomUUID } = require('crypto');

function createServer() {
    const certPath = process.env.SERVER_CERT || process.env.CERT_PATH; // "/etc/letsencrypt/live/wss.yourdomain.com/fullchain.pem";
    const keyPath = process.env.SERVER_KEY || process.env.KEY_PATH; // "/etc/letsencrypt/live/wss.yourdomain.com/privkey.pem";
    if (certPath && keyPath) {
        try {
            const cert = fs.readFileSync(certPath);
            const key = fs.readFileSync(keyPath);
            const server = https.createServer({ cert, key }, (_, res) => {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('Secure VDONinja server');
            });
            return { server, port: Number(process.env.PORT) || 443 };
        } catch (error) {
            console.error('TLS configuration failed, falling back to HTTP:', error.message);
        }
    }
    const server = http.createServer((_, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('VDONinja server');
    });
    return { server, port: Number(process.env.PORT) || 80 };
}

function readId(input) {
    return typeof input === 'string' ? input.trim() : '';
}

function safeSend(ws, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(payload);
        } catch (error) {
            ws.terminate();
        }
    }
}

const { server, port } = createServer();
const wss = new WebSocketServer({ server });
const clients = new Map();
const streams = new Map();
const streamIDs = new Map();
const callbackView = new Map();
const callbackCleanup = new Map();
const directors = new Map();
const myRooms = new Map();
const roomList = new Map();

function removeFromCallback(uuid) {
    if (!callbackCleanup.has(uuid)) return;
    const pending = callbackCleanup.get(uuid);
    callbackCleanup.delete(uuid);
    pending.forEach(streamID => {
        if (!callbackView.has(streamID)) return;
        const list = callbackView.get(streamID);
        const index = list.indexOf(uuid);
        if (index !== -1) list.splice(index, 1);
        if (!list.length) callbackView.delete(streamID);
    });
}

function cleanupClient(uuid) {
    if (!clients.has(uuid)) return;
    clients.delete(uuid);
    if (streamIDs.has(uuid)) {
        const streamID = streamIDs.get(uuid);
        streamIDs.delete(uuid);
        if (streams.get(streamID) === uuid) streams.delete(streamID);
    }
    if (myRooms.has(uuid)) {
        const roomid = myRooms.get(uuid);
        myRooms.delete(uuid);
        if (directors.get(roomid) === uuid) directors.delete(roomid);
        if (roomList.has(roomid)) {
            const members = roomList.get(roomid);
            const index = members.indexOf(uuid);
            if (index !== -1) members.splice(index, 1);
            if (!members.length) roomList.delete(roomid);
        }
    }
    removeFromCallback(uuid);
}

function queueForStream(uuid, streamID) {
    if (!callbackView.has(streamID)) callbackView.set(streamID, []);
    const queue = callbackView.get(streamID);
    if (!queue.includes(uuid)) queue.push(uuid);
    if (!callbackCleanup.has(uuid)) callbackCleanup.set(uuid, new Set());
    callbackCleanup.get(uuid).add(streamID);
}

function notifyRoom(roomid, payload, skip) {
    if (!roomList.has(roomid)) return;
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    roomList.get(roomid).forEach(member => {
        if (skip && skip.includes(member)) return;
        safeSend(clients.get(member), message);
    });
}

wss.on('connection', ws => {
    const uuid = randomUUID();
    clients.set(uuid, ws);
    ws.on('close', () => cleanupClient(uuid));
    ws.on('error', () => cleanupClient(uuid));
    ws.on('message', raw => {
        let data;
        try {
            data = JSON.parse(raw);
        } catch (error) {
            return;
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;
        if (!data.request) {
            if (!data.UUID) return;
            const target = clients.get(data.UUID);
            if (!target) return;
            data.UUID = uuid;
            delete data.from;
            safeSend(target, JSON.stringify(data));
            return;
        }
        const requester = clients.get(uuid);
        if (!requester) return;
        switch (data.request) {
            case 'play': {
                const streamID = readId(data.streamID);
                if (!streamID) return;
                if (!streams.has(streamID)) {
                    queueForStream(uuid, streamID);
                    return;
                }
                const seederUUID = streams.get(streamID);
                if (seederUUID === uuid) return;
                const seeder = clients.get(seederUUID);
                if (!seeder || seeder.readyState !== WebSocket.OPEN) {
                    cleanupClient(seederUUID);
                    queueForStream(uuid, streamID);
                    return;
                }
                if (myRooms.has(seederUUID) && myRooms.get(uuid) !== myRooms.get(seederUUID)) {
                    queueForStream(uuid, streamID);
                    return;
                }
                safeSend(seeder, JSON.stringify({ request: 'offerSDP', UUID: uuid }));
                break;
            }
            case 'seed': {
                const streamID = readId(data.streamID);
                if (!streamID) return;
                if (streamIDs.has(uuid) && streamIDs.get(uuid) !== streamID) {
                    safeSend(requester, JSON.stringify({ request: 'alert', message: 'Stream ID cannot change on an existing connection.' }));
                    return;
                }
                if (streams.has(streamID)) {
                    const existing = streams.get(streamID);
                    if (existing !== uuid) {
                        const existingWS = clients.get(existing);
                        if (existingWS && existingWS.readyState === WebSocket.OPEN) {
                            safeSend(requester, JSON.stringify({ request: 'alert', message: 'Stream ID is already in use.' }));
                            return;
                        }
                        cleanupClient(existing);
                    }
                }
                streams.set(streamID, uuid);
                streamIDs.set(uuid, streamID);
                if (myRooms.has(uuid)) {
                    const roomid = myRooms.get(uuid);
                    notifyRoom(roomid, { request: 'videoaddedtoroom', UUID: uuid, streamID }, [uuid]);
                } else if (callbackView.has(streamID)) {
                    const watchers = callbackView.get(streamID);
                    callbackView.delete(streamID);
                    const seeder = clients.get(uuid);
                    watchers.forEach(viewer => {
                        const queue = callbackCleanup.get(viewer);
                        if (queue) {
                            queue.delete(streamID);
                            if (!queue.size) callbackCleanup.delete(viewer);
                        }
                        safeSend(seeder, JSON.stringify({ request: 'offerSDP', UUID: viewer }));
                    });
                }
                break;
            }
            case 'joinroom': {
                const input = readId(data.roomid).toLowerCase();
                if (!input || myRooms.has(uuid)) return;
                myRooms.set(uuid, input);
                let isDirector = false;
                const response = { request: 'listing', list: [] };
                if (data.claim) {
                    const currentDirector = directors.get(input);
                    if (!currentDirector || !clients.has(currentDirector)) {
                        directors.set(input, uuid);
                        response.claim = true;
                        isDirector = true;
                    } else {
                        response.claim = currentDirector === uuid;
                        if (!response.claim) response.director = currentDirector;
                    }
                } else if (directors.has(input)) {
                    response.director = directors.get(input);
                }
                if (!roomList.has(input)) roomList.set(input, []);
                const members = roomList.get(input);
                members.forEach(member => {
                    const entry = { UUID: member };
                    if (streamIDs.has(member)) entry.streamID = streamIDs.get(member);
                    response.list.push(entry);
                });
                safeSend(requester, JSON.stringify(response));
                const notice = { request: 'someonejoined', UUID: uuid };
                if (isDirector) notice.director = true;
                if (streamIDs.has(uuid)) notice.streamID = streamIDs.get(uuid);
                notifyRoom(input, notice, [uuid]);
                members.push(uuid);
                break;
            }
            case 'migrate': {
                const target = readId(data.target);
                const destination = readId(data.roomid).toLowerCase();
                if (!target || !destination) return;
                const directorRoom = myRooms.get(uuid);
                if (!directorRoom || directors.get(directorRoom) !== uuid) return;
                const sourceRoom = myRooms.get(target);
                if (!sourceRoom || sourceRoom !== directorRoom || target === uuid) return;
                const members = roomList.get(sourceRoom);
                if (!members) return;
                const index = members.indexOf(target);
                if (index === -1) return;
                members.splice(index, 1);
                if (!members.length) roomList.delete(sourceRoom);
                myRooms.set(target, destination);
                if (!roomList.has(destination)) roomList.set(destination, []);
                const destMembers = roomList.get(destination);
                const view = { request: 'transferred', list: [] };
                if (directors.has(destination)) view.director = directors.get(destination);
                destMembers.forEach(member => {
                    const entry = { UUID: member };
                    if (streamIDs.has(member)) entry.streamID = streamIDs.get(member);
                    view.list.push(entry);
                });
                safeSend(clients.get(target), JSON.stringify(view));
                notifyRoom(destination, { request: 'someonejoined', UUID: target, streamID: streamIDs.get(target) }, [target]);
                destMembers.push(target);
                break;
            }
        }
    });
});

server.listen(port, () => {
    console.log(`VDONinja WebSocket server listening on port ${port}`);
});
