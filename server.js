//
// Copyright (c) 2021 Steve Seguin. All Rights Reserved.
//  Use of this source code is governed by the APGLv3 open-source 
//

const { createServer } = require('https');
const { readFileSync } = require('fs');
const polka = require('polka');
const { HTTPS_PORT=3000 } = process.env;
const serve = require('sirv')('vdo.ninja');
const ws = require("ws");

// Run create-localnetwork-cert.sh to generate self-signed certs
const options = {
    key: readFileSync('localhost.key'),
    cert: readFileSync('localhost.crt')
  };

const { handler } = polka()
    .use(serve)
    .get('/health', (req, res) => {
        res.end('OK');
    });

const { handler2 } = polka()
    .use(serve)
    .get('/health', (req, res) => {
        res.end('OK');
    });

const httpsServer = createServer(options, handler);

function wssSetup(wss) {
    wss.on('connection', (ws) => {
        ws.on('message', (message) => {
            wss.clients.forEach( client => {
                        if (ws!=client){
                            client.send(message.toString());
                        }
                });
        });
    });
}

wssSetup(new ws.WebSocketServer({ server: httpsServer }));

httpsServer.listen(HTTPS_PORT, _ => {
    console.log(`> Running on https://<your-ip>:${HTTPS_PORT}`);
    console.log(`Update vdo.ninja/index.html 'session.wss=wss://<your-ip>:${HTTPS_PORT}' & 'session.customWSS = true'`)
})


