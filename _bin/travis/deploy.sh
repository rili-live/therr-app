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

HAS_ANY_LIBRARY_CHANGES=false
HAS_UTILITIES_LIBRARY_CHANGES=false

if has_prev_diff_changes "rili-public-library/rili-styles" || \
  has_prev_diff_changes "rili-public-library/rili-js-utilities" || \
  has_prev_diff_changes "rili-public-library/rili-react"; then
  HAS_ANY_LIBRARY_CHANGES=true
fi

if has_prev_diff_changes "rili-public-library/rili-js-utilities"; then
  HAS_UTILITIES_LIBRARY_CHANGES=true
fi

# This is reliant on the previous commit being a single merge commit with all prior changes
should_deploy_web_app()
{
  has_prev_diff_changes "rili-client-web" || "$HAS_ANY_LIBRARY_CHANGES" = true
}

# This is reliant on the previous commit being a single merge commit with all prior changes
should_deploy_service()
{
  SERVICE_DIR=$1
  has_prev_diff_changes $SERVICE_DIR || "$HAS_UTILITIES_LIBRARY_CHANGES" = true
}

# Docker Build
if should_deploy_web_app; then
  docker build -t riliadmin/client-web$SUFFIX:latest -t riliadmin/client-web$SUFFIX:$GIT_SHA -f ./rili-client-web/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} .
fi
if should_deploy_service "rili-servers/messages-service"; then
  docker build -t riliadmin/messages-service$SUFFIX:latest -t riliadmin/messages-service$SUFFIX:$GIT_SHA -f ./rili-servers/messages-service/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} .
fi
if should_deploy_service "rili-servers/users-service"; then
  docker build -t riliadmin/users-service$SUFFIX:latest -t riliadmin/users-service$SUFFIX:$GIT_SHA -f ./rili-servers/users-service/Dockerfile \
  --build-arg NODE_VERSION=${NODE_VERSION} .
fi
if should_deploy_service "rili-servers/websocket-service"; then
  docker build -t riliadmin/websocket-service$SUFFIX:latest -t riliadmin/websocket-service$SUFFIX:$GIT_SHA -f ./rili-servers/websocket-service/Dockerfile \
    --build-arg NODE_VERSION=${NODE_VERSION} .
fi

# Docker Push
if should_deploy_web_app; then
  docker push riliadmin/client-web$SUFFIX:latest
  docker push riliadmin/client-web$SUFFIX:$GIT_SHA
fi
if should_deploy_service "rili-servers/messages-service"; then
  docker push riliadmin/messages-service$SUFFIX:latest
  docker push riliadmin/messages-service$SUFFIX:$GIT_SHA
fi
if should_deploy_service "rili-servers/users-service"; then
  docker push riliadmin/users-service$SUFFIX:latest
  docker push riliadmin/users-service$SUFFIX:$GIT_SHA
fi
if should_deploy_service "rili-servers/websocket-service"; then
  docker push riliadmin/websocket-service$SUFFIX:latest
  docker push riliadmin/websocket-service$SUFFIX:$GIT_SHA
fi

kubectl apply -f k8s
if should_deploy_web_app; then
  kubectl set image deployments/client-deployment web=riliadmin/client-web:$GIT_SHA
else
  echo "Skipping client-web deployment (No Changes)"
fi
if should_deploy_service "rili-servers/messages-service"; then
  kubectl set image deployments/messages-service-deployment server-messages=riliadmin/messages-service:$GIT_SHA
else
  echo "Skipping messages-service deployment (No Changes)"
fi
if should_deploy_service "rili-servers/users-service"; then
  kubectl set image deployments/users-service-deployment server-users=riliadmin/users-service:$GIT_SHA
else
  echo "Skipping users-service deployment (No Changes)"
fi
if should_deploy_service "rili-servers/websocket-service"; then
  kubectl set image deployments/websocket-service-deployment server-websocket=riliadmin/websocket-service:$GIT_SHA
else
  echo "Skipping websocket-service deployment (No Changes)"
fi