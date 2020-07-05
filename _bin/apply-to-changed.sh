#!/bin/bash

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh

COMMAND=$1
TARGET_BRANCH=${2:-"stage"}
HAS_ANY_LIBRARY_CHANGES=false
HAS_STYLES_LIBRARY_CHANGES=false
HAS_UTILITIES_LIBRARY_CHANGES=false
HAS_REACT_LIBRARY_CHANGES=false

# Library directories: styles
if has_diff_changes $TARGET_BRANCH "rili-public-library/rili-styles"; then
  if [ -f package.json ]; then
    HAS_ANY_LIBRARY_CHANGES=true
    HAS_STYLES_LIBRARY_CHANGES=true
    pushd "rili-public-library/rili-styles"
    printMessageNeutral "Running command '${COMMAND}': rili-public-library/rili-styles"
    eval $COMMAND
  fi
    popd
else
  printMessageNeutral "Skipping command '${COMMAND}': rili-public-library/rili-styles (No Changes)"
fi

# Library directories: js-utilities
if has_diff_changes $TARGET_BRANCH "rili-public-library/rili-js-utilities"; then
  if [ -f package.json ]; then
    HAS_ANY_LIBRARY_CHANGES=true
    HAS_UTILITIES_LIBRARY_CHANGES=true
    pushd "rili-public-library/rili-js-utilities"
    printMessageNeutral "Running command '${COMMAND}': rili-public-library/rili-js-utilities"
    eval $COMMAND
  fi
    popd
else
  printMessageNeutral "Skipping command '${COMMAND}': rili-public-library/rili-js-utilities (No Changes)"
fi

# Library directories: react
if has_diff_changes $TARGET_BRANCH "rili-public-library/rili-react" || "$HAS_UTILITIES_LIBRARY_CHANGES" = true || "$HAS_STYLES_LIBRARY_CHANGES" = true; then
  if [ -f package.json ]; then
    HAS_ANY_LIBRARY_CHANGES=true
    HAS_REACT_LIBRARY_CHANGES=true
    pushd "rili-public-library/rili-react"
    printMessageNeutral "Running command '${COMMAND}': rili-public-library/rili-react"
    eval $COMMAND
  fi
    popd
else
  printMessageNeutral "Skipping command '${COMMAND}': rili-public-library/rili-react (No Changes)"
fi

# UI Apps
declare -a arr=("rili-client-web" "RiliMobile")
for i in "${arr[@]}"; do
  if has_diff_changes $TARGET_BRANCH ${i} || "$HAS_ANY_LIBRARY_CHANGES" = true; then
    if [ -f package.json ]; then
      pushd ${i}
      printMessageNeutral "Running command '${COMMAND}': ${i}"
      eval $COMMAND
    fi
      popd
  else
    printMessageNeutral "Skipping command '${COMMAND}': ${i} (No Changes)"
  fi
done

# Services
declare -a arr=("rili-servers/messages-service" "rili-servers/users-service" "rili-servers/websocket-service")
for i in "${arr[@]}"; do
  if has_diff_changes $TARGET_BRANCH ${i} || "$HAS_UTILITIES_LIBRARY_CHANGES" = true; then
    if [ -f package.json ]; then
      pushd ${i}
      printMessageNeutral "Running command '${COMMAND}': ${i}"
      eval $COMMAND
    fi
      popd
  else
    printMessageNeutral "Skipping command '${COMMAND}': ${i} (No Changes)"
  fi
done

printMessageSuccess "'${COMMAND}' command run on all Libraries, services, and frontend apps with changes or changes to respective dependencies!"${NC}