#!/bin/bash
# Run this script from the production server to start all processes

set -e

# Get color variables for output messages
pushd _bin
source ./lib/colorize.sh
popd

# Start Docker
if [ "$1" = "dev" ]; then
  printMessageNeutral "Running 'docker compose down' in DEV..."
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml down
elif [ "$1" = "stage" ]; then
  printMessageNeutral "Running 'docker compose down' in STAGE..."
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.stage.yml down
else
  printMessageNeutral "Running 'docker compose down' in PROD..."
  docker-compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml down
fi