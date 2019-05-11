#!/bin/bash
# This script runs before making a commit with git

set -e

# Get color variables for output messages
pushd _bin
source ./lib/colorize.sh
popd

is_pre_check_success()
{
    npm run lint:all
}

# TODO: Use CHANGEME.json file to verify development changes and re-build respective pages
# Also add valid conditions to ensure good commits
if is_pre_check_success; then
    printMessageNeutral "-- PRE COMMIT SUCCESS --"
else
    printMessageError "-- PRE COMMIT ERROR --"
    exit 1
fi