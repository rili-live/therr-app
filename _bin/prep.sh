#!/bin/bash
# Run this script to set the correct npm version

set -e

pushd _bin
source ./env.sh
popd

export NVM_DIR="/opt/circleci/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

npmVersion=$(npm -v)
echo "This environment's npm version is $npmVersion"
if [[ "$npmVersion" != "$NPM_VERSION"  ]]; then
    echo "NPM version is incorrect, expected npm v$NPM_VERSION, installing..."
    ! command -v nvm &> /dev/null || { echo "nvm is not installed. Using npm install -g instead"; npm install -g npm@$NPM_VERSION; }
    nvm install-latest-npm
else
    echo "NPM is correct"
fi
