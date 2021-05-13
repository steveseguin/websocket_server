This is a basic web-socket server, similar to that provided by piesocket.com. It accepts messages and broadcasts them to everyone else connected.

## Purpose
This can be used with a number of apps provided by Steve Seguin, including caption.ninja, obs.ninja, chat.overlay.ninja, and more.

Due to the simplicity and generic nature of this app, this server is suitable really only for personal or private use, as published data is broadcasted to everyone connected.

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

## If using with OBS.Ninja
If using this with a ninja deploy, you'll also need to deploy ninja v17.3 or newer, and then update the index.html of the ninja installation with the connection details. You'll need to enable 'pie'-mode and to set the wss server address to whatever you setup, such as with:
```
session.wss = "wss://wss.contribute.cam:443";
session.pie = true;
```
The reason for calling it pie-mode is that you can alternatively use the managed-service provider https://www.piesocket.com/, rather than hosting your own websocket server. Just create an account, create an API KEY with them, and then when loading up obs.ninja use the paramater `pie={APIKEY}`, such as 

`https://obs.ninja/?pie=YOURAPIKEYHERE`

This will automatically select a websocket server hosted by pie-socket, and use your API key to host handshake communication. Pie-socket is not affliated with me at all, but they have a free-tier of service that is more than enough for personal/private use.

Pie-mode and this websocket service is only compatible with version 17.3 or newer of ninja.
