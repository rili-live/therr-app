#!/bin/bash

set -e

# Get color variables for output messages
pushd _bin
source ./lib/colorize.sh
popd

# The rili-public-library utilities then react-components commands must happen first to ensure cross-package dependencies
declare -a arr=("rili-public-library/styles" "rili-public-library/utilities" "rili-public-library/react-components")
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
declare -a arr=("rili-client-web" "rili-client-mobile" "rili-servers/messages-service" "rili-servers/users-service" "rili-servers/websocket-service")
for i in "${arr[@]}"; do
    pushd ${i}
    if [ -f package.json ]
    then
        printMessageNeutral "Running command '${1}': ${i}"
        eval $1
    fi
    popd
done

printMessageSuccess "'${1}' command run on all Libraries and example UI Apps!"${NC}