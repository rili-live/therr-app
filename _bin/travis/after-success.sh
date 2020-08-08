#!/bin/bash
# TODO: This might be a good place to update the github build status badges (per branch/environment)

set -e

source _bin/travis/git.sh

# if [ "$LAST_COMMIT_AUTHOR" = "$GIT_AUTHOR_TRAVIS" ]; then
#   echo "Previous build committed by git author, $GIT_AUTHOR_TRAVIS. No build changes to commit. Exiting"
# else
#   echo "Committing build changes as, $GIT_AUTHOR_TRAVIS..."
#   git config --global user.email "travis@travis-ci.org"
#   git config --global user.name "$GIT_AUTHOR_TRAVIS"
#   git add -A
#   git commit -a -m "Committed by Travis-CI build number, $((TRAVIS_JOB_ID - 1))" --no-verify
#   git remote set-url origin https://${GH_TOKEN}@github.com/rili-live/therr-app.git >/dev/null 2>&1
#   git push origin HEAD:${TRAVIS_PULL_REQUEST_BRANCH:-$TRAVIS_BRANCH} # Push to the source branch before it gets merged to stage/master
#   PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')
#   git tag $PACKAGE_VERSION
#   git push --tags
# fi