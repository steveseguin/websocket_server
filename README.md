This repository includes a couple variations of websocket servers written in Node.js.

## Purpose

The included websocket server scripts are designed to allow self-hosting of some of the apps and services provided by Steve Seguin, including caption.ninja, vdo.ninja, chat.overlay.ninja, and more.

### basic server
The basic websocket server, `server.js`, can be used with a number of apps provided by Steve Seguin, including vdo.ninja, caption.ninja, chat.overlay.ninja, and more.

Due to the simplicity and generic nature of its basic fan-out design, it's really only suitable for personal or private use, as published data is broadcasted to everyone connected.

### VDO.Ninja optimized version server

VDO.Ninja is intentionally designed to work with a basic websocket server, due to a core tenant of the VDO.Ninja's design philosophy being: "be as serverless as possible". This develoment mindset allows VDO.Ninja to not only have a low-cost to operate, but also allows it to work over public blockchain networks, mesh-networks, RabbitMQ, IRC chat rooms, and probably even Twitter. It's a good idea to use a secure password in such cases though, to ensure message encryption over public channels.

That said, it's fairly easy to optimize the message routing to get better performance and security when using VDO.Ninja.  To demonstrate this, I've also included in this repository an optimized version of the websocket server (`vdoninja.js`), specifically designed to fill the role of a VDO.Ninja handshake server. Either the basic or this optimized version would work as a VDO.Ninja handshake server, however the optimized version can handle more clients and has better routing isolation.

### Offline use, when Internet isn't available

There's a version of VDO.Ninja handshake server located here, https://github.com/steveseguin/offline_deployment/, which combines the websocket (handshake) server with a Node.js-based webserver. It adds to the complexity by also focusing on being Dockerfile friendly, as well as being offline-focused, however it would work for an online option also.

### Dockers

This repository isn't focused on offering a Docker specifically, however https://github.com/steveseguin/offline_deployment/ contains one, as well as there is a community Docker for VDO.Ninja forked over at https://github.com/steveseguin/docker-vdon/.

### Alternative options

You can use services like piesocket.com or Cloudflare workers, instead of self-hosting a websocket server as well. Just pointing that out, as self-hosting servers is a responsibility..

## Installation
```
sudo apt-get update
sudo apt-get upgrade
sudo apt-get install nodejs -y
sudo apt-get install npm -y
sudo npm install express
sudo npm install ws
sudo npm install fs
sudo npm install cors
```

You will very likely also require SSL, so either use something like Cloudflare SSL, or grab a self-hosted SSL certificate. Certbot is a free way to get SSL certificates that you need to renewal every 90-days, and the setup for that is as follows:
```
sudo add-apt-repository ppa:certbot/certbot  
sudo apt-get install certbot -y
sudo certbot certonly // register your domain
```
I'm not going to detail the SSL setup process much, but once you have your certificate, you can update the server script to point to your certificate.

As well, you will probably need a domain name in most cases, so perhaps consider a cloud host that offers a server hostname or be prepared to spend a few dollars on a domain name. (namescheap.com has them for as low as $2)

In the case of an offline deployment, you may need self-signed certicates, but that topic is outside the scope of this guide.

## To run the basic server manually
```
sudo nodejs server.js // port 443 needs to be open. THIS STARTS THE SERVER
```
But you'll probably want to create a service and have the script auto start on system load or restart on a crash.

## If using with VDO.Ninja

To run the VDO.Ninja optimized version manually,
```
sudo nodejs vdoninja.js // port 443 needs to be open. THIS STARTS THE SERVER
```
Whether you use the optimized version or not, if using this with a self-hosted version of VDO.Ninja, you'll need to update the `index.html` of your VDO.Ninja installation with the WSS connection details.

Specially, you'll need to enable the `customWSS` mode and set the wss server address to whatever you setup, such as with:
```
session.wss = "wss://wss.contribute.cam:443";
session.customWSS = true;
```
You can also just specify the new WSS URL as a URL parameter, such as:
```
https://vdo.ninja?wss=wss://yourdomain.com
```

## Disclaimer

No guarentee is made on security, privacy, support, or reliability of these scripts; nor anything else for that matter. You're on your own if you choose to go this path.

Good luck!
