#!/bin/bash

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh

CURRENT_BRANCH=${CICD_BRANCH:-$CIRCLE_BRANCH}
echo "Current branch is $CURRENT_BRANCH"

DESTINATION_BRANCH="main"
echo "Destination branch is $DESTINATION_BRANCH"

# This should get us the SHA of the stage branch prior to main that last built and published docker images
export $(cat VERSIONS.txt)
GIT_SHA="${LAST_PUBLISHED_GIT_SHA}"
echo "LAST_PUBLISHED_GIT_SHA=${GIT_SHA}"

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

# NOTE: This is currently included in the web app build (container)
# This is reliant on the previous commit being a single merge commit with all prior changes
should_deploy_web_app_dashboard()
{
  has_prev_diff_changes "therr-client-web-dashboard" || "$HAS_ANY_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

# This is reliant on the previous commit being a single merge commit with all prior changes
should_deploy_service()
{
  SERVICE_DIR=$1
  has_prev_diff_changes $SERVICE_DIR $GIT_SHA || "$HAS_UTILITIES_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

# Kubectl Apply
kubectl apply -f k8s/prod

# Short circuit if GIT_SHA is empty
if [ -z "$GIT_SHA" ]; then
  echo "No new build SHA for deploy."
  echo "This might mean that the deploy was started before the stage publish job completed."
  echo "Please wait for stage to finish before merging to master"
  exit 0
fi

# NOTE: stage and main docker tags are essentially the same. The Docker container is interchangable and implements env variables injected by Kubernetes
if should_deploy_web_app || should_deploy_web_app_dashboard; then
  docker pull therrapp/client-web-stage:$GIT_SHA
  if [[ "$CURRENT_BRANCH" == "main"  ]]; then
    docker tag therrapp/client-web-stage:$GIT_SHA therrapp/client-web:$GIT_SHA
    docker tag therrapp/client-web-stage:$GIT_SHA therrapp/client-web:latest
    docker push therrapp/client-web:$GIT_SHA
    docker push therrapp/client-web:latest
  fi
  kubectl set image deployments/client-deployment web=therrapp/client-web$SUFFIX:$GIT_SHA
else
  echo "Skipping client-web deployment (No Changes)"
fi
if should_deploy_service "therr-api-gateway"; then
  docker pull therrapp/api-gateway-stage:$GIT_SHA
  if [[ "$CURRENT_BRANCH" == "main"  ]]; then
    docker tag therrapp/api-gateway-stage:$GIT_SHA therrapp/api-gateway:$GIT_SHA
    docker tag therrapp/api-gateway-stage:$GIT_SHA therrapp/api-gateway:latest
    docker push therrapp/api-gateway:$GIT_SHA
    docker push therrapp/api-gateway:latest
  fi
  kubectl set image deployments/api-gateway-service-deployment server-api-gateway=therrapp/api-gateway$SUFFIX:$GIT_SHA
else
  echo "Skipping api-gateway deployment (No Changes)"
fi
if should_deploy_service "therr-services/push-notifications-service"; then
  docker pull therrapp/push-notifications-service-stage:$GIT_SHA
  if [[ "$CURRENT_BRANCH" == "main"  ]]; then
    docker tag therrapp/push-notifications-service-stage:$GIT_SHA therrapp/push-notifications-service:$GIT_SHA
    docker tag therrapp/push-notifications-service-stage:$GIT_SHA therrapp/push-notifications-service:latest
    docker push therrapp/push-notifications-service:$GIT_SHA
    docker push therrapp/push-notifications-service:latest
  fi
  kubectl set image deployments/push-notifications-service-deployment server-push-notifications=therrapp/push-notifications-service$SUFFIX:$GIT_SHA
else
  echo "Skipping push-notifications-service deployment (No Changes)"
fi
if should_deploy_service "therr-services/maps-service"; then
  docker pull therrapp/maps-service-stage:$GIT_SHA
  if [[ "$CURRENT_BRANCH" == "main"  ]]; then
    docker tag therrapp/maps-service-stage:$GIT_SHA therrapp/maps-service:$GIT_SHA
    docker tag therrapp/maps-service-stage:$GIT_SHA therrapp/maps-service:latest
    docker push therrapp/maps-service:$GIT_SHA
    docker push therrapp/maps-service:latest
  fi
  kubectl set image deployments/maps-service-deployment server-maps=therrapp/maps-service$SUFFIX:$GIT_SHA
else
  echo "Skipping maps-service deployment (No Changes)"
fi
if should_deploy_service "therr-services/messages-service"; then
  docker pull therrapp/messages-service-stage:$GIT_SHA
  if [[ "$CURRENT_BRANCH" == "main"  ]]; then
    docker tag therrapp/messages-service-stage:$GIT_SHA therrapp/messages-service:$GIT_SHA
    docker tag therrapp/messages-service-stage:$GIT_SHA therrapp/messages-service:latest
    docker push therrapp/messages-service:$GIT_SHA
    docker push therrapp/messages-service:latest
  fi
  kubectl set image deployments/messages-service-deployment server-messages=therrapp/messages-service$SUFFIX:$GIT_SHA
else
  echo "Skipping messages-service deployment (No Changes)"
fi
if should_deploy_service "therr-services/reactions-service"; then
  docker pull therrapp/reactions-service-stage:$GIT_SHA
  if [[ "$CURRENT_BRANCH" == "main"  ]]; then
    docker tag therrapp/reactions-service-stage:$GIT_SHA therrapp/reactions-service:$GIT_SHA
    docker tag therrapp/reactions-service-stage:$GIT_SHA therrapp/reactions-service:latest
    docker push therrapp/reactions-service:$GIT_SHA
    docker push therrapp/reactions-service:latest
  fi
  kubectl set image deployments/reactions-service-deployment server-reactions=therrapp/reactions-service$SUFFIX:$GIT_SHA
else
  echo "Skipping reactions-service deployment (No Changes)"
fi
if should_deploy_service "therr-services/users-service"; then
  docker pull therrapp/users-service-stage:$GIT_SHA
  if [[ "$CURRENT_BRANCH" == "main"  ]]; then
    docker tag therrapp/users-service-stage:$GIT_SHA therrapp/users-service:$GIT_SHA
    docker tag therrapp/users-service-stage:$GIT_SHA therrapp/users-service:latest
    docker push therrapp/users-service:$GIT_SHA
    docker push therrapp/users-service:latest
  fi
  kubectl set image deployments/users-service-deployment server-users=therrapp/users-service$SUFFIX:$GIT_SHA
else
  echo "Skipping users-service deployment (No Changes)"
fi
if should_deploy_service "therr-services/websocket-service"; then
  docker pull therrapp/websocket-service-stage:$GIT_SHA
  if [[ "$CURRENT_BRANCH" == "main"  ]]; then
    docker tag therrapp/websocket-service-stage:$GIT_SHA therrapp/websocket-service:$GIT_SHA
    docker tag therrapp/websocket-service-stage:$GIT_SHA therrapp/websocket-service:latest
    docker push therrapp/websocket-service:$GIT_SHA
    docker push therrapp/websocket-service:latest
  fi
  kubectl set image deployments/websocket-service-deployment server-websocket=therrapp/websocket-service$SUFFIX:$GIT_SHA
else
  echo "Skipping websocket-service deployment (No Changes)"
fi

echo "Kubectl apply complete for all services with changes"

echo "Resetting VERSIONS.txt"
cat > VERSIONS.txt <<EOF
EOF

git config user.email "rili.main@gmail.com"
git config user.name "Rili Admin"
git add VERSIONS.txt
git commit -m "[skip ci] Updated VERSIONS.txt"
git push --set-upstream origin main --no-verify
