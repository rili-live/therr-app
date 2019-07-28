#!/bin/bash
# Run this script to set the correct npm version

set -e

pushd _bin
source ./env.sh
popd

npmVersion=$(npm -v)
if [[ "$npmVersion" != "$NPM_VERSION"  ]]; then
    echo "NPM version is incorrect, expected npm v$NPM_VERSION, installing..."
    npm install -g npm@$NPM_VERSION
else
    echo "NPM is correct"
fi