#!/bin/bash

set -e

source _bin/travis/git.sh

# TRAVIS_BRANCH represents the destination branch for PR builds
if [ ! -z "$TRAVIS_PULL_REQUEST_BRANCH" ]; then
  DESTINATION_BRANCH=$TRAVIS_BRANCH
else
  DESTINATION_BRANCH="stage"
fi

if [ "$LAST_COMMIT_AUTHOR" = "$GIT_AUTHOR_TRAVIS" ]; then
  echo "Previous build committed by git author, $GIT_AUTHOR_TRAVIS. Skipping build stage."
else
  npm run build:changed ${DESTINATION_BRANCH:-"master"}
fi