#!/bin/bash

set -e

cp .env.template .env

sed -i '' -e "s/CLIENT_PORT=/CLIENT_PORT=$CLIENT_PORT/g" ".env"
sed -i '' -e "s/CLIENT_URI=/CLIENT_URI=$CLIENT_URI/g" ".env"
sed -i '' -e "s/PG_HOST=/PG_HOST=$PG_HOST/g" ".env"
sed -i '' -e "s/PG_USER=/PG_USER=$PG_USER/g" ".env"
sed -i '' -e "s/PG_DATABASE=/PG_DATABASE=$PG_DATABASE/g" ".env"
sed -i '' -e "s/PG_PASSWORD=/PG_PASSWORD=$PG_PASSWORD/g" ".env"
sed -i '' -e "s/PG_PORT=/PG_PORT=$PG_PORT/g" ".env"
sed -i '' -e "s/DOMAIN_CERT_LOCATION=/DOMAIN_CERT_LOCATION=$DOMAIN_CERT_LOCATION/g" ".env"
sed -i '' -e "s/DOMAIN_KEY_LOCATION=/DOMAIN_KEY_LOCATION=$DOMAIN_KEY_LOCATION/g" ".env"
sed -i '' -e "s/SECRET=/SECRET=$SECRET/g" ".env"