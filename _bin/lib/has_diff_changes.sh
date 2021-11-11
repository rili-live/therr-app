#!/bin/bash

set -e

source ./_bin/lib/colorize.sh

has_diff_changes()
{
    ORIGIN_BRANCH=$1
    DIR=$2
    
    git fetch origin $ORIGIN_BRANCH
    NUM_FILES_CHANGED=$(git diff --name-only origin/$ORIGIN_BRANCH -- $DIR | wc -l)

    if [[ ${NUM_FILES_CHANGED} -gt 0 ]]; then
        printMessageWarning "Found ${NUM_FILES_CHANGED} files changed w/ 'git diff origin/$ORIGIN_BRANCH:$DIR'"
        return 0
    else
        return 1
    fi
}

has_prev_diff_changes()
{
    DIR=$1
    
    NUM_FILES_CHANGED=$(git diff HEAD^1 --name-only -- $DIR | wc -l)

    if [[ ${NUM_FILES_CHANGED} -gt 0 ]]; then
        printMessageWarning "Found ${NUM_FILES_CHANGED} files changed w/ 'git diff HEAD^1 --name-only -- $DIR'"
        return 0
    else
        return 1
    fi
}
