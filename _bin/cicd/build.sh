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
should_build_web_app()
{
  has_prev_diff_changes "therr-client-web" || "$HAS_ANY_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

# NOTE: This is currently included in the web app build (container)
# This is reliant on the previous commit being a single merge commit with all prior changes
should_build_web_app_dashboard()
{
  has_prev_diff_changes "therr-client-web-dashboard" || "$HAS_ANY_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

# This is reliant on the previous commit being a single merge commit with all prior changes
should_build_service()
{
  SERVICE_DIR=$1
  has_prev_diff_changes $SERVICE_DIR || "$HAS_UTILITIES_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

# Docker Build
if should_build_web_app || should_build_web_app_dashboard; then
  docker build -t therrapp/client-web$SUFFIX:latest -t therrapp/client-web$SUFFIX:$GIT_SHA -f ./therr-client-web/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} .
fi
if should_build_service "therr-api-gateway"; then
  docker build -t therrapp/api-gateway$SUFFIX:latest -t therrapp/api-gateway$SUFFIX:$GIT_SHA -f ./therr-api-gateway/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} .
fi
if should_build_service "therr-services/push-notifications-service"; then
  docker build -t therrapp/push-notifications-service$SUFFIX:latest -t therrapp/push-notifications-service$SUFFIX:$GIT_SHA -f ./therr-services/push-notifications-service/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} .
fi
if should_build_service "therr-services/maps-service"; then
  docker build -t therrapp/maps-service$SUFFIX:latest -t therrapp/maps-service$SUFFIX:$GIT_SHA -f ./therr-services/maps-service/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} .
fi
if should_build_service "therr-services/messages-service"; then
  docker build -t therrapp/messages-service$SUFFIX:latest -t therrapp/messages-service$SUFFIX:$GIT_SHA -f ./therr-services/messages-service/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} .
fi
if should_build_service "therr-services/reactions-service"; then
  docker build -t therrapp/reactions-service$SUFFIX:latest -t therrapp/reactions-service$SUFFIX:$GIT_SHA -f ./therr-services/reactions-service/Dockerfile \
  --build-arg NODE_VERSION=${NODE_VERSION} .
fi
if should_build_service "therr-services/users-service"; then
  docker build -t therrapp/users-service$SUFFIX:latest -t therrapp/users-service$SUFFIX:$GIT_SHA -f ./therr-services/users-service/Dockerfile \
  --build-arg NODE_VERSION=${NODE_VERSION} .
fi
if should_build_service "therr-services/websocket-service"; then
  docker build -t therrapp/websocket-service$SUFFIX:latest -t therrapp/websocket-service$SUFFIX:$GIT_SHA -f ./therr-services/websocket-service/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} .
fi

echo "Docker build complete for all services with changes"
