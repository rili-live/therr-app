#!/bin/bash

set -e

# Get color variables for output messages
pushd _bin
source ./lib/colorize.sh
popd

# The therr-public-library utilities then react-components commands must happen first to ensure cross-package dependencies
declare -a arr=("therr-public-library/therr-styles" "therr-public-library/therr-js-utilities" "therr-public-library/therr-react")
for i in "${arr[@]}"; do
    pushd ${i}
    if [ -f package.json ]
    then
        printMessageNeutral "Running command '${1}': ${i}"
        eval $1
    fi
        popd
done

printMessageSuccess "'${1}' command run on all Libraries!"

# Only run command on library if this is a root only operation
if [ "$2" = "rootOnly" ]
then
    exit
fi

# Remaining directores to run script in. Order matters.
declare -a arr=("rili-client-web" "TherrMobile" "rili-servers/messages-service" "rili-servers/users-service" "rili-servers/websocket-service")
for i in "${arr[@]}"; do
    pushd ${i}
    if [ -f package.json ]
    then
        printMessageNeutral "Running command '${1}': ${i}"
        eval $1
    fi
        popd
done

printMessageSuccess "'${1}' command run on all Libraries, services, and frontend apps!"${NC}