//
// Copyright (c) 2021 Steve Seguin. All Rights Reserved.
//  Use of this source code is governed by the APGLv3 open-source 
//
///// INSTALLATION
// sudo apt-get update
// sudo apt-get upgrade
// sudo apt-get install nodejs -y
// sudo apt-get install npm -y
// sudo npm install express
// sudo npm install ws
// sudo npm install fs
// sudo add-apt-repository ppa:certbot/certbot  
// sudo apt-get install certbot -y
// sudo certbot certonly // register your domain
// sudo nodejs server.js // port 443 needs to be open. THIS STARTS THE SERVER
//
//// Finally, if using this with a ninja deploy, update index.html of the ninja installation as needed, such as with:
//  session.wss = "wss://wss.contribute.cam:443";
//	session.customWSS = true;  #  Please refer to the vdo.ninja instructions for exact details on settings; this is just a demo.
/////////////////////////

"use strict";
var fs = require("fs");
var https = require("https");
var express = require("express");
var app = express();
var WebSocket = require("ws");

const key = fs.readFileSync("/etc/letsencrypt/live/wss.contribute.cam/privkey.pem"); /// UPDATE THIS PATH
const cert = fs.readFileSync("/etc/letsencrypt/live/wss.contribute.cam/fullchain.pem"); /// UPDATE THIS PATH

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
server.listen(443, () => {console.log(`Server started on port 443`) });


