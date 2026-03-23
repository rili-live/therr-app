#!/bin/bash

set -e

source ./_bin/lib/colorize.sh

# Cache fetched branches to avoid redundant network calls
_FETCHED_BRANCHES=""

_fetch_once()
{
    local BRANCH=$1
    if [[ "$_FETCHED_BRANCHES" != *"|$BRANCH|"* ]]; then
        git fetch origin "$BRANCH"
        _FETCHED_BRANCHES="${_FETCHED_BRANCHES}|$BRANCH|"
    fi
}

has_diff_changes()
{
    ORIGIN_BRANCH=$1
    DIR=$2

    _fetch_once "$ORIGIN_BRANCH"
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
    CURRENT_BRANCH=${CICD_BRANCH:-$CIRCLE_BRANCH}

    if [ "$CURRENT_BRANCH" = "stage" ]; then
        COMPARE_BRANCH="general"
    elif [ "$CURRENT_BRANCH" = "main" ]; then
        COMPARE_BRANCH="stage"
    else
        # Fallback to HEAD^1 for unknown branches
        NUM_FILES_CHANGED=$(git diff HEAD^1 --name-only -- $DIR | wc -l)
        if [[ ${NUM_FILES_CHANGED} -gt 0 ]]; then
            printMessageWarning "Found ${NUM_FILES_CHANGED} files changed w/ 'git diff HEAD^1 -- $DIR'"
            return 0
        else
            return 1
        fi
    fi

    _fetch_once "$COMPARE_BRANCH"
    MERGE_BASE=$(git merge-base HEAD origin/$COMPARE_BRANCH)
    NUM_FILES_CHANGED=$(git diff $MERGE_BASE --name-only -- $DIR | wc -l)

    if [[ ${NUM_FILES_CHANGED} -gt 0 ]]; then
        printMessageWarning "Found ${NUM_FILES_CHANGED} files changed w/ 'git diff $MERGE_BASE -- $DIR'"
        return 0
    else
        return 1
    fi
}
