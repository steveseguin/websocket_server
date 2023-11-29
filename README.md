This repository includes a couple variations of websocket servers written in Node.js.

## Purpose

The included websocket server scripts are designed to allow self-hosting of some of the apps and services provided by Steve Seguin, including caption.ninja, vdo.ninja, chat.overlay.ninja, and more.

### basic server
The basic websocket server, `server.js`, can be used with a number of apps provided by Steve Seguin, including vdo.ninja, caption.ninja, chat.overlay.ninja, and more.

Due to the simplicity and generic nature of its basic fan-out design, it's really only suitable for personal or private use, as published data is broadcasted to everyone connected. 

### VDO.NInja optimized version server

VDO.Ninja is intentionally designed to work with a basic websocket server, due to a core tenant of the VDO.Ninja's design philosophy is to be as serverless as possible. This develoment mindset allows VDO.Ninja to not only have a low-cost to operate, but also allows it to work over public blockchain networks, RabbitMQ, IRC chat rooms, and probably even Twitter. It's a good idea to use a secure password in such cases though, to ensure message encryption over public channels.

That said, it's fairly easy to optimize the message routing to get better performance and security when using VDO.Ninja.  To demonstrate this, I've also included in this repository an optimized version of the websocket server (`vdoninja.js`), specifically designed to fill the role of a VDO.Ninja handshake server. Either the basic or this optimized version would work with VDO.Ninja as a handshake server, however the optimized version can handle more clients and has better routing isolation.

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

## To run the basic server manually
```
sudo nodejs server.js // port 443 needs to be open. THIS STARTS THE SERVER
```
or with


## If using with VDO.Ninja

To run the VDO.Ninja optimized version manually,
```
sudo nodejs vdoninja.js // port 443 needs to be open. THIS STARTS THE SERVER
```
Whether you use the optimized version or not, if using this with a self-hosted version of VDO.Ninja, you'll need to update the index.html of your VDO.Ninja installation with the connection details.

Specially, you'll need to enable the `customWSS` mode and set the wss server address to whatever you setup, such as with:
```
session.wss = "wss://wss.contribute.cam:443";
session.customWSS = true;
```
You can also just specify the new WSS URL as a URL parameter, such as:
```
https://vdo.ninja?wss=wss://yourdomain.com
```

