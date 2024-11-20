#!/bin/bash

# Update system packages
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js, npm, and vim
sudo apt-get install nodejs npm vim -y

# Install certbot
sudo add-apt-repository ppa:certbot/certbot -y
sudo apt-get install certbot -y

# Install npm dependencies
npm install

# Configure vim
echo "set mouse=v" >> ~/.vimrc
echo "set paste" >> ~/.vimrc
echo "syntax on" >> ~/.vimrc
echo "colorscheme default" >> ~/.vimrc
echo "set background=dark" >> ~/.vimrc

# Request SSL certificate
echo "(Optional) Follow the prompts to set up your SSL certificate:"
sudo certbot certonly
