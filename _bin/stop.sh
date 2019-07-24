#!/bin/bash
# Run this script from the production server to start all processes

set -e

# Get color variables for output messages
pushd _bin
source ./lib/colorize.sh
popd

# Start Docker
pushd docker
if [ "$1" = "dev" ]; then
  printMessageNeutral "Running 'docker compose down' in DEV..."
  docker-compose down
else
  printMessageNeutral "Running 'docker compose down' in PROD..."
  docker-compose -f docker-compose.prod.yml down
fi
popd