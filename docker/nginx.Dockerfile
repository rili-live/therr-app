FROM nginx:latest

RUN apt-get update
RUN apt-get install -y vim
# TODO Install Certbot

WORKDIR /usr/share/nginx/html
