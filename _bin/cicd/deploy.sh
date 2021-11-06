#!/bin/bash

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh

TRAVIS_CI_CD_BRANCH=${TRAVIS_PULL_REQUEST_BRANCH:-$TRAVIS_BRANCH}

CURRENT_BRANCH=${TRAVIS_CI_CD_BRANCH:-$CICD_BRANCH}
echo "Current branch is $CURRENT_BRANCH"

# TRAVIS_BRANCH represents the destination branch for PR builds
if [ ! -z "$TRAVIS_PULL_REQUEST_BRANCH" ]; then
  DESTINATION_BRANCH=$TRAVIS_BRANCH
  echo "Destination branch is $TRAVIS_BRANCH"
else
  DESTINATION_BRANCH="main"
fi

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
should_deploy_web_app()
{
  has_prev_diff_changes "therr-client-web" || "$HAS_ANY_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

# This is reliant on the previous commit being a single merge commit with all prior changes
should_deploy_service()
{
  SERVICE_DIR=$1
  has_prev_diff_changes $SERVICE_DIR || "$HAS_UTILITIES_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

# Kubectl Apply
kubectl apply -f k8s
if should_deploy_web_app; then
  kubectl set image deployments/client-deployment web=therrapp/client-web:$GIT_SHA
else
  echo "Skipping client-web deployment (No Changes)"
fi
if should_deploy_service "therr-api-gateway"; then
  kubectl set image deployments/api-gateway-service-deployment server-api-gateway=therrapp/api-gateway:$GIT_SHA
else
  echo "Skipping api-gateway deployment (No Changes)"
fi
if should_deploy_service "therr-services/push-notifications-service"; then
  kubectl set image deployments/push-notifications-service-deployment server-push-notifications=therrapp/push-notifications-service:$GIT_SHA
else
  echo "Skipping push-notifications-service deployment (No Changes)"
fi
if should_deploy_service "therr-services/maps-service"; then
  kubectl set image deployments/maps-service-deployment server-maps=therrapp/maps-service:$GIT_SHA
else
  echo "Skipping maps-service deployment (No Changes)"
fi
if should_deploy_service "therr-services/messages-service"; then
  kubectl set image deployments/messages-service-deployment server-messages=therrapp/messages-service:$GIT_SHA
else
  echo "Skipping messages-service deployment (No Changes)"
fi
if should_deploy_service "therr-services/reactions-service"; then
  kubectl set image deployments/reactions-service-deployment server-reactions=therrapp/reactions-service:$GIT_SHA
else
  echo "Skipping reactions-service deployment (No Changes)"
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

echo "Kubectl apply complete for all services with changes"
