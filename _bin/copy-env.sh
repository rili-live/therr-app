#!/bin/bash
set -e

# Get color variables for output messages
pushd _bin
source ./lib/colorize.sh
popd

printMessageNeutral "Copying environment variables..."

touch .env

cp .env.template .env;
find ".env" -type f -exec sed -i '' -e "s/CLIENT_PORT=/CLIENT_PORT=$CLIENT_PORT/g" {} \;
find ".env" -type f -exec sed -i '' -e "s/CLIENT_URI=/CLIENT_URI=$CLIENT_URI/g" {} \;
find ".env" -type f -exec sed -i '' -e "s/PG_HOST=/PG_HOST=$PG_HOST/g" {} \;
find ".env" -type f -exec sed -i '' -e "s/PG_USER=/PG_USER=$PG_USER/g" {} \;
find ".env" -type f -exec sed -i '' -e "s/PG_DATABASE=/PG_DATABASE=$PG_DATABASE/g" {} \;
find ".env" -type f -exec sed -i '' -e "s/PG_PASSWORD=/PG_PASSWORD=$PG_PASSWORD/g" {} \;
find ".env" -type f -exec sed -i '' -e "s/PG_PORT=/PG_PORT=$PG_PORT/g" {} \;
find ".env" -type f -exec sed -i '' -e "s/DOMAIN_CERT_LOCATION=/DOMAIN_CERT_LOCATION=$DOMAIN_CERT_LOCATION/g" {} \;
find ".env" -type f -exec sed -i '' -e "s/DOMAIN_KEY_LOCATION=/DOMAIN_KEY_LOCATION=$DOMAIN_KEY_LOCATION/g" {} \;
find ".env" -type f -exec sed -i '' -e "s/SECRET=/SECRET=$SECRET/g" {} \;
printMessageSuccess "Successfully copied environment variables"