#!/bin/bash

set -e

# Get color variables for output messages
pushd _bin
source ./lib/colorize.sh
popd

printMessageNeutral "Copying environment variables..."

touch .env

if
  [[ -z ${CLIENT_PORT+x} || 
    -z ${CLIENT_URI+x} ||
    -z ${PG_HOST+x} ||
    -z ${PG_USER+x} ||
    -z ${PG_DATABASE+x} ||
    -z ${PG_PASSWORD+x} ||
    -z ${PG_PORT+x} ||
    -z ${DOMAIN_CERT_LOCATION+x} ||
    -z ${DOMAIN_KEY_LOCATION+x} ||
    -z ${SECRET+x} ]]; then
  printMessageWarning "Missing environment variables. copy-env failed."
  exit 0
else
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
fi


