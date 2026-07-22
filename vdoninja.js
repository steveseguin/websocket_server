//
// Copyright (c) 2021 Steve Seguin. All Rights Reserved.
// Use of this source code is governed by the AGPLv3 open-source license.
//
// This is VDO.Ninja-specific handshake server implementation
// It has better routing isolation and performance than a generic fan-out implementation
//
// >> Use at your own risk, as it still may contain bugs or security vulnerabilities <<
//
///// INSTALLATION
// sudo apt-get update
// sudo apt-get upgrade
// sudo apt-get install nodejs -y
// sudo apt-get install npm -y
// sudo npm install express
// sudo npm install ws
// sudo npm install cors
// sudo add-apt-repository ppa:certbot/certbot  
// sudo apt-get install certbot -y
// sudo certbot certonly // register your domain
// sudo nodejs vdoninja.js // port 443 needs to be open. THIS STARTS THE SERVER (or create a service instead)
//
//// Finally, within VDO.Ninja, update index.html of the ninja installation as needed, such as with:
//  session.wss = "wss://wss.contribute.cam:443";
//  session.customWSS = true;  #  Please refer to the vdo.ninja instructions for exact details on settings; this is just a demo.
/////////////////////////

"use strict";
var fs = require("fs");
var express = require("express");
var app = express();
var WebSocket = require("ws");
var cors = require('cors');

// TLS is optional: set SSL_KEY_PATH/SSL_CERT_PATH to serve wss directly,
// or run plain http behind a TLS-terminating ingress (e.g. Traefik).
var server;
if (process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
  const key = fs.readFileSync(process.env.SSL_KEY_PATH);
  const cert = fs.readFileSync(process.env.SSL_CERT_PATH);
  server = require("https").createServer({ key, cert }, app);
} else {
  server = require("http").createServer(app);
}
var websocketServer = new WebSocket.Server({ server });

app.use(cors({
  origin: '*'
}));

app.get('/health', (req, res) => res.status(200).send('ok'));

websocketServer.on('connection', (webSocketClient) => {
  var room = false;
  webSocketClient.on('message', (message) => {
    try {
      var msg = JSON.parse(message);
    } catch (e) {
      return;
    }

    if (!msg.from) return;

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
var port = parseInt(process.env.PORT || "443", 10);
server.listen(port, () => { console.log(`Server started on port ${port}`) });
