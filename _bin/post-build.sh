#!/bin/bash

set -e

GIT_AUTHOR_TRAVIS="Travis CI"
LAST_COMMIT_AUTHOR="$(git log -1 --pretty=format:'%an')"

echo "$LAST_COMMIT_AUTHOR"

if [ "$LAST_COMMIT_AUTHOR" = "$GIT_AUTHOR_TRAVIS" ]; then
  echo "Previous build committed by git author, $GIT_AUTHOR_TRAVIS. Exiting"
else
  echo "Committing build changes as, $GIT_AUTHOR_TRAVIS..."
  git config --global user.email "travis@travis-ci.org"
  git config --global user.name "$GIT_AUTHOR_TRAVIS"
  git add -A
  git commit -a -m "Committed by Travis-CI build number, $((TRAVIS_JOB_ID - 1))" --no-verify
  git remote set-url origin https://${GH_TOKEN}@github.com/rili-live/rili-app.git >/dev/null 2>&1
  git push origin HEAD:${TRAVIS_PULL_REQUEST_BRANCH:-$TRAVIS_BRANCH}
  PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')
  echo "$PACKAGE_VERSION"
  git tag $PACKAGE_VERSION
  git push --tags
fi
