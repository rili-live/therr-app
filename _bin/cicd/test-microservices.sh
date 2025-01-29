#!/bin/bash

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh

CURRENT_BRANCH=${CICD_BRANCH:-$CIRCLE_BRANCH}
echo "Current branch is $CURRENT_BRANCH"

DESTINATION_BRANCH="main"
echo "Destination branch is $DESTINATION_BRANCH"

# Only build the docker images when the source branch is stage or main
if [[ ("$CURRENT_BRANCH" != "stage") && ("$CURRENT_BRANCH" != "main") ]]; then
  echo "Skipping post build stage."
  exit 0
fi

[[ "$CURRENT_BRANCH" = "stage" ]] && SUFFIX="-stage" || SUFFIX=""

HAS_GLOBAL_CONFIG_FILE_CHANGES=false
HAS_ANY_LIBRARY_CHANGES=false
HAS_UTILITIES_LIBRARY_CHANGES=false

if has_prev_diff_changes "global-config.js"; then
  HAS_GLOBAL_CONFIG_FILE_CHANGES=true
fi

if has_prev_diff_changes "therr-public-library/therr-styles" || \
  has_prev_diff_changes "therr-public-library/therr-js-utilities" || \
  has_prev_diff_changes "therr-public-library/therr-react"; then
  HAS_ANY_LIBRARY_CHANGES=true
fi

if has_prev_diff_changes "therr-public-library/therr-js-utilities"; then
  HAS_UTILITIES_LIBRARY_CHANGES=true
fi

# This is reliant on the previous commit being a single merge commit with all prior changes
should_test_service()
{
  SERVICE_DIR=$1
  has_prev_diff_changes $SERVICE_DIR || "$HAS_ANY_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

# Docker Build
if should_test_service "therr-api-gateway"; then
  docker run -it therrapp/api-gateway$SUFFIX:latest /bin/sh -c 'npm test'
fi
if should_test_service "therr-services/push-notifications-service"; then
  docker run -it therrapp/push-notifications-service$SUFFIX:latest /bin/sh -c 'npm test'
fi
if should_test_service "therr-services/maps-service"; then
  docker run -it therrapp/maps-service$SUFFIX:latest /bin/sh -c 'npm test'
fi
if should_test_service "therr-services/messages-service"; then
  docker run -it therrapp/messages-service$SUFFIX:latest /bin/sh -c 'npm test'
fi
if should_test_service "therr-services/reactions-service"; then
  docker run -it therrapp/reactions-service$SUFFIX:latest /bin/sh -c 'npm test'
fi
if should_test_service "therr-services/users-service"; then
  docker run -it therrapp/users-service$SUFFIX:latest /bin/sh -c 'npm test'
fi
if should_test_service "therr-services/websocket-service"; then
  docker run -it therrapp/websocket-service$SUFFIX:latest /bin/sh -c 'npm test'
fi

echo "Testing complete for all services with changes"
