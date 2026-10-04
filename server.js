//
// Copyright (c) 2021 Steve Seguin. All Rights Reserved.
// Use of this source code is governed by the AGPLv3 open-source license.
// Use at your own risk, as it may contain bugs or security vulnerabilities.
//
// Setup, TLS paths, ports and matching browser options: see README.md.

"use strict";
var fs = require("fs");
var https = require("https");
var express = require("express");
var app = express();
var WebSocket = require("ws");

const key = fs.readFileSync(process.env.KEY_PATH || "/etc/letsencrypt/live/wss.contribute.cam/privkey.pem");
const cert = fs.readFileSync(process.env.CERT_PATH || "/etc/letsencrypt/live/wss.contribute.cam/fullchain.pem");

var server = https.createServer({key,cert}, app);
var websocketServer = new WebSocket.Server({ server });

websocketServer.on('connection', (webSocketClient) => {
    webSocketClient.on('message', (message) => {
            websocketServer.clients.forEach( client => {
                    if (webSocketClient!=client){
                        client.send(message.toString());
                    }
            });
    });
});
const port = Number(process.env.PORT) || 443;
server.listen(port, () => {console.log(`Server started on port ${port}`) });
