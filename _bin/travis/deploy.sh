#!/bin/bash

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh

CURRENT_BRANCH=${TRAVIS_PULL_REQUEST_BRANCH:-$TRAVIS_BRANCH}
echo "Current branch is $CURRENT_BRANCH"

# TRAVIS_BRANCH represents the destination branch for PR builds
if [ ! -z "$TRAVIS_PULL_REQUEST_BRANCH" ]; then
  DESTINATION_BRANCH=$TRAVIS_BRANCH
  echo "Destination branch is $TRAVIS_BRANCH"
else
  DESTINATION_BRANCH="master"
fi

# Only build the docker images when the source branch is stage or master
if [[ ("$CURRENT_BRANCH" != "stage") && ("$CURRENT_BRANCH" != "master") ]]; then
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
should_deploy_web_app()
{
  has_prev_diff_changes "therr-client-web" || "$HAS_ANY_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

# This is reliant on the previous commit being a single merge commit with all prior changes
should_deploy_service()
{
  SERVICE_DIR=$1
  has_prev_diff_changes $SERVICE_DIR || "$HAS_UTILITIES_LIBRARY_CHANGES" = true ||  || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

# Docker Build
if should_deploy_web_app; then
  docker build -t therrapp/client-web$SUFFIX:latest -t therrapp/client-web$SUFFIX:$GIT_SHA -f ./therr-client-web/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} .
fi
if should_deploy_service "therr-api-gateway"; then
  docker build -t therrapp/api-gateway$SUFFIX:latest -t therrapp/api-gateway$SUFFIX:$GIT_SHA -f ./therr-api-gateway/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} .
fi
if should_deploy_service "therr-services/messages-service"; then
  docker build -t therrapp/messages-service$SUFFIX:latest -t therrapp/messages-service$SUFFIX:$GIT_SHA -f ./therr-services/messages-service/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} .
fi
if should_deploy_service "therr-services/users-service"; then
  docker build -t therrapp/users-service$SUFFIX:latest -t therrapp/users-service$SUFFIX:$GIT_SHA -f ./therr-services/users-service/Dockerfile \
  --build-arg NODE_VERSION=${NODE_VERSION} .
fi
if should_deploy_service "therr-services/websocket-service"; then
  docker build -t therrapp/websocket-service$SUFFIX:latest -t therrapp/websocket-service$SUFFIX:$GIT_SHA -f ./therr-services/websocket-service/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} .
fi

# Docker Push
if should_deploy_web_app; then
  docker push therrapp/client-web$SUFFIX:latest
  docker push therrapp/client-web$SUFFIX:$GIT_SHA
fi
if should_deploy_service "therr-api-gateway"; then
  docker push therrapp/api-gateway$SUFFIX:latest
  docker push therrapp/api-gateway$SUFFIX:$GIT_SHA
fi
if should_deploy_service "therr-services/messages-service"; then
  docker push therrapp/messages-service$SUFFIX:latest
  docker push therrapp/messages-service$SUFFIX:$GIT_SHA
fi
if should_deploy_service "therr-services/users-service"; then
  docker push therrapp/users-service$SUFFIX:latest
  docker push therrapp/users-service$SUFFIX:$GIT_SHA
fi
if should_deploy_service "therr-services/websocket-service"; then
  docker push therrapp/websocket-service$SUFFIX:latest
  docker push therrapp/websocket-service$SUFFIX:$GIT_SHA
fi

kubectl apply -f k8s
if should_deploy_web_app; then
  kubectl set image deployments/client-deployment web=therrapp/client-web:$GIT_SHA
else
  echo "Skipping client-web deployment (No Changes)"
fi
if should_deploy_service "therr-services/messages-service"; then
  kubectl set image deployments/messages-service-deployment server-messages=therrapp/messages-service:$GIT_SHA
else
  echo "Skipping messages-service deployment (No Changes)"
fi
if should_deploy_service "therr-services/users-service"; then
  kubectl set image deployments/users-service-deployment server-users=therrapp/users-service:$GIT_SHA
else
  echo "Skipping users-service deployment (No Changes)"
fi
if should_deploy_service "therr-services/websocket-service"; then
  kubectl set image deployments/websocket-service-deployment server-websocket=therrapp/websocket-service:$GIT_SHA
else
  echo "Skipping websocket-service deployment (No Changes)"
fi