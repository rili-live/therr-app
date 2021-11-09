#!/bin/bash

set -e

GIT_SHA=$(git rev-parse HEAD)

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

# Docker Publish
if should_deploy_web_app; then
  docker push therrapp/client-web$SUFFIX:latest
  docker push therrapp/client-web$SUFFIX:$GIT_SHA
fi
if should_deploy_service "therr-api-gateway"; then
  docker push therrapp/api-gateway$SUFFIX:latest
  docker push therrapp/api-gateway$SUFFIX:$GIT_SHA
fi
if should_deploy_service "therr-services/maps-service"; then
  docker push therrapp/maps-service$SUFFIX:latest
  docker push therrapp/maps-service$SUFFIX:$GIT_SHA
fi
if should_deploy_service "therr-services/messages-service"; then
  docker push therrapp/messages-service$SUFFIX:latest
  docker push therrapp/messages-service$SUFFIX:$GIT_SHA
fi
if should_deploy_service "therr-services/push-notifications-service"; then
  docker push therrapp/push-notifications-service$SUFFIX:latest
  docker push therrapp/push-notifications-service$SUFFIX:$GIT_SHA
fi
if should_deploy_service "therr-services/reactions-service"; then
  docker push therrapp/reactions-service$SUFFIX:latest
  docker push therrapp/reactions-service$SUFFIX:$GIT_SHA
fi
if should_deploy_service "therr-services/users-service"; then
  docker push therrapp/users-service$SUFFIX:latest
  docker push therrapp/users-service$SUFFIX:$GIT_SHA
fi
if should_deploy_service "therr-services/websocket-service"; then
  docker push therrapp/websocket-service$SUFFIX:latest
  docker push therrapp/websocket-service$SUFFIX:$GIT_SHA
fi

cat > VERSIONS.txt <<EOF
LAST_PUBLISHED_GIT_SHA=${GIT_SHA}
EOF

git add VERSIONS.txt
git commit -m "Updated VERSIONS.txt"
git push origin/stage

echo "Docker publish complete for all services with changes"
