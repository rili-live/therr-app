#!/bin/bash

if ! [ -x "$(command -v docker-compose)" ]; then
  echo 'Error: docker-compose is not installed.' >&2
  exit 1
fi

domains=($2 "www.${2}")
rsa_key_size=4096
data_path="./docker/volumes/certbot"
email="rili.main@gmail.com" # Adding a valid address is strongly recommended
staging=0 # Set to 1 if you're testing your setup to avoid hitting request limits

if [ -d "$data_path" ]; then
  read -p "Existing data found for $domains. Continue and replace existing certificate? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi


if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
  echo "### Downloading recommended TLS parameters ..."
  mkdir -p "$data_path/conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
  echo
fi

echo "### Creating dummy certificate for $domains ..."
path="/etc/letsencrypt/live/$domains"
mkdir -p "$data_path/conf/live/$domains"
if [ "$1" = "dev" ]; then
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml run --rm --entrypoint "\
    openssl req -x509 -nodes -newkey rsa:1024 -days 1\
      -keyout '$path/privkey.pem' \
      -out '$path/fullchain.pem' \
      -subj '/CN=localhost'" certbot
  echo
elif [ "$1" = "stage" ]; then
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.stage.yml run --rm --entrypoint "\
    openssl req -x509 -nodes -newkey rsa:1024 -days 1\
      -keyout '$path/privkey.pem' \
      -out '$path/fullchain.pem' \
      -subj '/CN=localhost'" certbot
  echo
else
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml run --rm --entrypoint "\
    openssl req -x509 -nodes -newkey rsa:1024 -days 1\
      -keyout '$path/privkey.pem' \
      -out '$path/fullchain.pem' \
      -subj '/CN=localhost'" certbot
  echo
fi

if [ "$1" = "dev" ]; then
  echo "### Starting nginx ..."
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml up --force-recreate -d rili-nginx
  echo

  echo "### Deleting dummy certificate for $domains ..."
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml run --rm --entrypoint "\
    rm -Rf /etc/letsencrypt/live/$domains && \
    rm -Rf /etc/letsencrypt/archive/$domains && \
    rm -Rf /etc/letsencrypt/renewal/$domains.conf" certbot
  echo
elif [ "$1" = "stage" ]; then
  echo "### Starting nginx ..."
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.stage.yml up --force-recreate -d rili-nginx
  echo

  echo "### Deleting dummy certificate for $domains ..."
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.stage.yml run --rm --entrypoint "\
    rm -Rf /etc/letsencrypt/live/$domains && \
    rm -Rf /etc/letsencrypt/archive/$domains && \
    rm -Rf /etc/letsencrypt/renewal/$domains.conf" certbot
  echo
else
  echo "### Starting nginx ..."
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up --force-recreate -d rili-nginx
  echo

  echo "### Deleting dummy certificate for $domains ..."
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml run --rm --entrypoint "\
    rm -Rf /etc/letsencrypt/live/$domains && \
    rm -Rf /etc/letsencrypt/archive/$domains && \
    rm -Rf /etc/letsencrypt/renewal/$domains.conf" certbot
  echo
fi

echo "### Requesting Let's Encrypt certificate for $domains ..."
#Join $domains to -d args
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Select appropriate email arg
case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email" ;;
esac

# Enable staging mode if needed
if [ $staging != "0" ]; then staging_arg="--staging"; fi

if [ "$1" = "dev" ]; then
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml run --rm --entrypoint "\
    certbot certonly --webroot -w /var/www/certbot \
      $staging_arg \
      $email_arg \
      $domain_args \
      --rsa-key-size $rsa_key_size \
      --agree-tos \
      --force-renewal" certbot
  echo

  echo "### Reloading nginx ..."
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml exec rili-nginx nginx -s reload
elif [ "$1" = "stage" ]; then
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.stage.yml run --rm --entrypoint "\
    certbot certonly --webroot -w /var/www/certbot \
      $staging_arg \
      $email_arg \
      $domain_args \
      --rsa-key-size $rsa_key_size \
      --agree-tos \
      --force-renewal" certbot
  echo

  echo "### Reloading nginx ..."
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.stage.yml exec rili-nginx nginx -s reload
else
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml run --rm --entrypoint "\
    certbot certonly --webroot -w /var/www/certbot \
      $staging_arg \
      $email_arg \
      $domain_args \
      --rsa-key-size $rsa_key_size \
      --agree-tos \
      --force-renewal" certbot
  echo

  echo "### Reloading nginx ..."
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml exec rili-nginx nginx -s reload
fi