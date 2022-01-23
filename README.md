This is a basic web-socket & static-file server. Websocket messages broadcasts them to everyone else connected.

## Purpose
This can be used with a number of apps provided by Steve Seguin, including caption.ninja, vdo.ninja, chat.overlay.ninja, and more.

Due to the simplicity and generic nature of this app, this server is suitable really only for personal or private use, as published data is broadcasted to everyone connected.

## Installation
```
sudo apt-get update
sudo apt-get upgrade
sudo apt-get install nodejs -y
sudo apt-get install npm -y
npm install
```

Fetch vdo.ninja static files
```
git submodule update --init
```

Create self-signed cert for local network
```
./create-localnetwork-cert.sh
```

## Run
```
npm start
```
visit to https://localhost:3000

## If using with VDO.Ninja
Update `vdo.ninja/index.html` to match your setup:
```
session.wss = "wss://<your ip/domain>:3000";
session.customWSS = true;
```
note: The most update to date directions on how to configure VDO.Ninja will likely be found in its index.html file; this repository's instructions may be out of date in comparison.

## Advanced
### Certbot certificate setup
Using certbot https://certbot.eff.org/
```
sudo add-apt-repository ppa:certbot/certbot  
sudo apt-get install certbot -y
sudo certbot certonly // register your domain
```

configure server.js
```
const options = {
    key: readFileSync('<path/to/your>.key'),
    cert: readFileSync('<path/to/your>.crt')
  };
```

