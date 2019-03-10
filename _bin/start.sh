#!/bin/bash
# Run this script from the production server to start all processes

set -e

# Get color variables for output messages
pushd _bin
source ./lib/colorize.sh
popd

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