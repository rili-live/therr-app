FROM nginx:latest

RUN apt-get update
RUN apt-get install -y vim
# TODO Install Certbot

COPY ./docker/prod.nginx.conf /etc/nginx/nginx.conf

WORKDIR /usr/share/nginx/html
