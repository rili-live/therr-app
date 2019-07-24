#!/bin/bash
# Run this script from the production server to start all processes

set -e

# Get color variables for output messages
pushd _bin
source ./lib/colorize.sh
popd

# Start Docker
pushd docker
printMessageNeutral "Running 'docker compose up' in PROD..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml config > docker-compose.compiled.yml
popd