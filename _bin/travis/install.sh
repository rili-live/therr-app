#!/bin/bash

set -e

source _bin/cicd/git.sh

if [ "$LAST_COMMIT_AUTHOR" = "$GIT_AUTHOR_TRAVIS" ]; then
  echo "Previous build committed by git author, $GIT_AUTHOR_TRAVIS. Skipping install stage."
else
  npm run install:all:ci
fi
