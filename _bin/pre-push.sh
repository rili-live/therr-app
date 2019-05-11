#!/bin/bash
# This script runs before pushing a commit with git

set -e

# Get color variables for output messages
pushd _bin
source ./lib/colorize.sh
popd

is_pre_check_success()
{
    npm run build:all
    npm run test:all
}

# TODO: Add conditions to prevent bad commits
# Use CHANGEME.json file to verify development changes and re-build respective pages
if is_pre_check_success; then
    printMessageNeutral "-- PRE PUSH SUCCESS --"
else
    printMessageError "-- PRE PUSH ERROR --"
    exit 1
fi