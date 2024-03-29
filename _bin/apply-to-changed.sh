#!/bin/bash

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh

COMMAND=$1
TARGET_BRANCH=${2:-"stage"}
HAS_GLOBAL_CONFIG_FILES_CHANGES=false
HAS_ANY_LIBRARY_CHANGES=false
HAS_STYLES_LIBRARY_CHANGES=false
HAS_UTILITIES_LIBRARY_CHANGES=false
HAS_REACT_LIBRARY_CHANGES=false

# Global config file
if has_diff_changes $TARGET_BRANCH "global-config.js"; then
  HAS_GLOBAL_CONFIG_FILES_CHANGES=true
else
  printMessageNeutral "No changes found in global-config.js file"
fi

# Library directories: styles
if has_diff_changes $TARGET_BRANCH "therr-public-library/therr-styles"; then
  if [ -f package.json ]; then
    HAS_ANY_LIBRARY_CHANGES=true
    HAS_STYLES_LIBRARY_CHANGES=true
    pushd "therr-public-library/therr-styles"
    printMessageNeutral "Running command '${COMMAND}': therr-public-library/therr-styles"
    eval $COMMAND
  fi
    popd
else
  printMessageNeutral "Skipping command '${COMMAND}': therr-public-library/therr-styles (No Changes)"
fi

# Library directories: js-utilities
if has_diff_changes $TARGET_BRANCH "therr-public-library/therr-js-utilities"; then
  if [ -f package.json ]; then
    HAS_ANY_LIBRARY_CHANGES=true
    HAS_UTILITIES_LIBRARY_CHANGES=true
    pushd "therr-public-library/therr-js-utilities"
    printMessageNeutral "Running command '${COMMAND}': therr-public-library/therr-js-utilities"
    eval $COMMAND
  fi
    popd
else
  printMessageNeutral "Skipping command '${COMMAND}': therr-public-library/therr-js-utilities (No Changes)"
fi

# Library directories: react
if has_diff_changes $TARGET_BRANCH "therr-public-library/therr-react" || "$HAS_UTILITIES_LIBRARY_CHANGES" = true || "$HAS_STYLES_LIBRARY_CHANGES" = true; then
  if [ -f package.json ]; then
    HAS_ANY_LIBRARY_CHANGES=true
    HAS_REACT_LIBRARY_CHANGES=true
    pushd "therr-public-library/therr-react"
    printMessageNeutral "Running command '${COMMAND}': therr-public-library/therr-react"
    eval $COMMAND
  fi
    popd
else
  printMessageNeutral "Skipping command '${COMMAND}': therr-public-library/therr-react (No Changes)"
fi

# UI Apps
declare -a arr=("therr-client-web" "therr-client-web-dashboard" "TherrMobile")
for i in "${arr[@]}"; do
  if has_diff_changes $TARGET_BRANCH ${i} || "$HAS_ANY_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILES_CHANGES" = true; then
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
declare -a arr=("therr-api-gateway" "therr-services/push-notifications-service" "therr-services/maps-service" "therr-services/messages-service" "therr-services/reactions-service" "therr-services/users-service" "therr-services/websocket-service")
for i in "${arr[@]}"; do
  if has_diff_changes $TARGET_BRANCH ${i} || "$HAS_UTILITIES_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILES_CHANGES" = true; then
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
