#!/bin/bash
# Run this script from the production server to start all processes

set -e

# Get color variables for output messages
pushd _bin
source ./lib/colorize.sh
popd

# Start Docker
if [ "$1" = "dev" ]; then
  printMessageNeutral "Running 'docker compose up' in DEV..."
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml restart $2
elif [ "$1" = "stage" ]; then
  printMessageNeutral "Running 'docker compose up' in STAGE..."
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.stage.yml restart $2
else
  printMessageNeutral "Running 'docker compose up' in PROD..."
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml restart $2
fi