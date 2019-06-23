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
  printMessageNeutral "Running 'docker compose up' in DEV..."
  docker-compose -f docker-compose.dev.yml up
else
  printMessageNeutral "Running 'docker compose up' in PROD..."
  docker-compose up -d
fi
popd

if [ "$1" != "dev" ]; then
  # Start server
  pushd rili-server
  printMessageNeutral "Starting Rili Server..."
  npm run start
  popd

  # Start client
  pushd rili-client-web
  printMessageNeutral "Starting Rili Client..."
  npm run start
  popd
fi