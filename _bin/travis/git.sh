#!/bin/bash

set -e

GIT_AUTHOR_TRAVIS="Travis CI"
LAST_COMMIT_AUTHOR="$(git log -1 --pretty=format:'%an')"