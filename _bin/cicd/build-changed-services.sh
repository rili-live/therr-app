#!/bin/bash
# Build Docker images for services that changed relative to the general branch.
# Used on feature branches to enable selective unit testing of changed services.

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh

GIT_SHA=${GIT_SHA:-$CIRCLE_SHA1}
NODE_VERSION=${NODE_VERSION:-"24.12.0"}

HAS_GLOBAL_CONFIG_FILE_CHANGES=false
HAS_ANY_LIBRARY_CHANGES=false
HAS_UTILITIES_LIBRARY_CHANGES=false

if has_diff_changes general "global-config.js"; then
  HAS_GLOBAL_CONFIG_FILE_CHANGES=true
fi

if has_diff_changes general "therr-public-library/therr-styles" || \
  has_diff_changes general "therr-public-library/therr-js-utilities" || \
  has_diff_changes general "therr-public-library/therr-react"; then
  HAS_ANY_LIBRARY_CHANGES=true
fi

if has_diff_changes general "therr-public-library/therr-js-utilities"; then
  HAS_UTILITIES_LIBRARY_CHANGES=true
fi

should_build_web_app()
{
  has_diff_changes general "therr-client-web" || "$HAS_ANY_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

should_build_web_app_dashboard()
{
  has_diff_changes general "therr-client-web-dashboard" || "$HAS_ANY_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

should_build_service()
{
  SERVICE_DIR=$1
  has_diff_changes general $SERVICE_DIR || "$HAS_UTILITIES_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

SERVICES_BUILT=0

# Docker Build
if should_build_web_app || should_build_web_app_dashboard; then
  printMessageNeutral "Building client-web Docker image..."
  docker build -t therrapp/client-web:latest -f ./therr-client-web/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} .
  SERVICES_BUILT=$((SERVICES_BUILT + 1))
fi
if should_build_service "therr-api-gateway"; then
  printMessageNeutral "Building api-gateway Docker image..."
  docker build -t therrapp/api-gateway:latest -f ./therr-api-gateway/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} ./therr-api-gateway
  SERVICES_BUILT=$((SERVICES_BUILT + 1))
fi
if should_build_service "therr-services/push-notifications-service"; then
  printMessageNeutral "Building push-notifications-service Docker image..."
  docker build -t therrapp/push-notifications-service:latest -f ./therr-services/push-notifications-service/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} ./therr-services/push-notifications-service
  SERVICES_BUILT=$((SERVICES_BUILT + 1))
fi
if should_build_service "therr-services/maps-service"; then
  printMessageNeutral "Building maps-service Docker image..."
  docker build -t therrapp/maps-service:latest -f ./therr-services/maps-service/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} ./therr-services/maps-service
  SERVICES_BUILT=$((SERVICES_BUILT + 1))
fi
if should_build_service "therr-services/messages-service"; then
  printMessageNeutral "Building messages-service Docker image..."
  docker build -t therrapp/messages-service:latest -f ./therr-services/messages-service/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} ./therr-services/messages-service
  SERVICES_BUILT=$((SERVICES_BUILT + 1))
fi
if should_build_service "therr-services/reactions-service"; then
  printMessageNeutral "Building reactions-service Docker image..."
  docker build -t therrapp/reactions-service:latest -f ./therr-services/reactions-service/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} ./therr-services/reactions-service
  SERVICES_BUILT=$((SERVICES_BUILT + 1))
fi
if should_build_service "therr-services/users-service"; then
  printMessageNeutral "Building users-service Docker image..."
  docker build -t therrapp/users-service:latest -f ./therr-services/users-service/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} ./therr-services/users-service
  SERVICES_BUILT=$((SERVICES_BUILT + 1))
fi
if should_build_service "therr-services/websocket-service"; then
  printMessageNeutral "Building websocket-service Docker image..."
  docker build -t therrapp/websocket-service:latest -f ./therr-services/websocket-service/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} ./therr-services/websocket-service
  SERVICES_BUILT=$((SERVICES_BUILT + 1))
fi

if [ $SERVICES_BUILT -eq 0 ]; then
  printMessageNeutral "No service changes detected relative to general. Skipping builds."
else
  printMessageSuccess "Docker build complete for ${SERVICES_BUILT} service(s) with changes"
fi
