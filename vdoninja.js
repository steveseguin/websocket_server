//
// Copyright (c) 2021 Steve Seguin. All Rights Reserved.
// Use of this source code is governed by the AGPLv3 open-source license.
//
// This is VDO.Ninja-specific handshake server implementation
// It has better routing isolation and performance than a generic fan-out implementation
//
// >> Use at your own risk, as it still may contain bugs or security vulnerabilities <<
//
// Setup, TLS paths, ports and matching browser options: see README.md.

"use strict";
var fs = require("fs");
var https = require("https");
var express = require("express");
var app = express();
var WebSocket = require("ws");
var cors = require('cors');

const key = fs.readFileSync(process.env.KEY_PATH || "/etc/letsencrypt/live/debug.vdo.ninja/privkey.pem");
const cert = fs.readFileSync(process.env.CERT_PATH || "/etc/letsencrypt/live/debug.vdo.ninja/fullchain.pem");

var server = https.createServer({ key, cert }, app);
var websocketServer = new WebSocket.Server({ server });

app.use(cors({
  origin: '*'
}));

websocketServer.on('connection', (webSocketClient) => {
  var room = false;
  webSocketClient.on('message', (message) => {
    try {
      var msg = JSON.parse(message);
    } catch (e) {
      return;
    }

    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || !msg.from) return;

    if (!webSocketClient.uuid) {
      let alreadyExists = Array.from(websocketServer.clients).some(client => client.uuid && client.uuid === msg.from && client != webSocketClient);

      if (alreadyExists) {
        webSocketClient.send(JSON.stringify({ error: "uuid already in use" }));
        return;
      } 
      webSocketClient.uuid = msg.from;
    }

    var streamID = false;

    try {
      if (msg.request == "seed" && msg.streamID) {
        streamID = msg.streamID;
      } else if (msg.request == "joinroom") {
        room = msg.roomid + "";
        webSocketClient.room = room;
        if (msg.streamID) {
          streamID = msg.streamID;
        }
      }
    } catch (e) {
      return;
    }

    if (streamID) {
      if (webSocketClient.sid && streamID != webSocketClient.sid) {
        webSocketClient.send(JSON.stringify({ error: "can't change sid" }));
        return;
      }

      let alreadyExists = Array.from(websocketServer.clients).some(client => client.sid && client.sid === streamID && client != webSocketClient);

      if (alreadyExists) {
        webSocketClient.send(JSON.stringify({ error: "sid already in use" }));
        return;
      }
      webSocketClient.sid = streamID;
    }

    websocketServer.clients.forEach(client => {
      if (webSocketClient == client || (msg.UUID && msg.UUID != client.uuid) || (room && (!client.room || client.room !== room)) || (!room && client.room) || (msg.request == "play" && msg.streamID && (!client.sid || client.sid !== msg.streamID))) return;
      
      client.send(message.toString());
    });
  });

  webSocketClient.on('close', function(reasonCode, description) {});
});
const port = Number(process.env.PORT) || 443;
server.listen(port, () => { console.log(`Server started on port ${port}`) });
