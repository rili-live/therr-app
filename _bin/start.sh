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
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml up --build --remove-orphans
elif [ "$1" = "stage" ]; then
  printMessageNeutral "Running 'docker compose up' in STAGE..."
  docker stack deploy --compose-file docker/docker-compose.yml -c docker/docker-compose.stage.yml rili-app
else
  printMessageNeutral "Running 'docker compose up' in PROD..."
  docker stack deploy --compose-file docker/docker-compose.yml -c docker/docker-compose.prod.yml rili-app
fi