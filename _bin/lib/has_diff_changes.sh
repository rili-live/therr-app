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

is_in_deploy_profile()
{
    local DIR=$1
    local PROFILE_FILE="DEPLOY_PROFILE.txt"
    if [ -f "$PROFILE_FILE" ]; then
        if grep -qx "$DIR" "$PROFILE_FILE" 2>/dev/null; then
            printMessageWarning "Service '$DIR' found in DEPLOY_PROFILE.txt (forced deploy)"
            return 0
        fi
    fi
    return 1
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

    if [ "$CURRENT_BRANCH" = "stage" ] || [ "$CURRENT_BRANCH" = "main" ]; then
        # On stage/main, changes arrive via merge commits from general/stage.
        # Compare against HEAD^1 (first parent = previous branch tip) to detect
        # everything that was merged in. Using merge-base with the source branch
        # doesn't work here because the source branch tip is an ancestor of the
        # merge commit, making the diff empty for the merged-in changes.
        NUM_FILES_CHANGED=$(git diff HEAD^1 --name-only -- $DIR | wc -l)
        if [[ ${NUM_FILES_CHANGED} -gt 0 ]]; then
            printMessageWarning "Found ${NUM_FILES_CHANGED} files changed w/ 'git diff HEAD^1 -- $DIR'"
            return 0
        else
            return 1
        fi
    else
        # Feature branches: use merge-base with the target branch to detect
        # all changes since the branch diverged
        _fetch_once "general"
        MERGE_BASE=$(git merge-base HEAD origin/general)
        NUM_FILES_CHANGED=$(git diff $MERGE_BASE --name-only -- $DIR | wc -l)
        if [[ ${NUM_FILES_CHANGED} -gt 0 ]]; then
            printMessageWarning "Found ${NUM_FILES_CHANGED} files changed w/ 'git diff $MERGE_BASE -- $DIR'"
            return 0
        else
            return 1
        fi
    fi
}
