This is a basic web-socket server, similar to that provided by piesocket.com. It accepts messages and broadcasts them to everyone else connected.

## Purpose

This can be used with a number of apps provided by Steve Seguin, including caption.ninja, obs.ninja, chat.overlay.ninja, and more.

Due to the simplicity and generic nature of this app, it is suitable really only for personal/private use, as published data is broadcasted to everyone connected.


## Installation
```
sudo apt-get update
sudo apt-get upgrade
sudo apt-get install nodejs -y
sudo apt-get install npm -y
sudo npm install express
sudo npm install ws
sudo npm install fs
sudo add-apt-repository ppa:certbot/certbot  
sudo apt-get install certbot -y
sudo certbot certonly // register your domain
```

## Run
```
sudo nodejs server.js // port 443 needs to be open. THIS STARTS THE SERVER
```

Finally, if using this with a ninja deploy, update index.html of the ninja installation to enable pie-mode and to set the wss server address, such as with:
```
session.wss = "wss://wss.contribute.cam:443";
session.pie=true;
```
