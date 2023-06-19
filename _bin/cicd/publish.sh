#!/bin/bash

set -e

GIT_SHA=$(git rev-parse HEAD)

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
should_publish_web_app()
{
  has_prev_diff_changes "therr-client-web" || "$HAS_ANY_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

# NOTE: This is currently included in the web app build (container)
# This is reliant on the previous commit being a single merge commit with all prior changes
should_publish_web_app_dashboard()
{
  has_prev_diff_changes "therr-client-web-dashboard" || "$HAS_ANY_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

# This is reliant on the previous commit being a single merge commit with all prior changes
should_publish_service()
{
  SERVICE_DIR=$1
  has_prev_diff_changes $SERVICE_DIR || "$HAS_UTILITIES_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

NUMBER_SERVICES_PUBLISHED=0

# Docker Publish
if should_publish_web_app || should_publish_web_app_dashboard; then
  ((NUMBER_SERVICES_PUBLISHED=i+1))
  docker push therrapp/client-web$SUFFIX:latest
  docker push therrapp/client-web$SUFFIX:$GIT_SHA
fi
if should_publish_service "therr-api-gateway"; then
  ((NUMBER_SERVICES_PUBLISHED=i+1))
  docker push therrapp/api-gateway$SUFFIX:latest
  docker push therrapp/api-gateway$SUFFIX:$GIT_SHA
fi
if should_publish_service "therr-services/maps-service"; then
  ((NUMBER_SERVICES_PUBLISHED=i+1))
  docker push therrapp/maps-service$SUFFIX:latest
  docker push therrapp/maps-service$SUFFIX:$GIT_SHA
fi
if should_publish_service "therr-services/messages-service"; then
  ((NUMBER_SERVICES_PUBLISHED=i+1))
  docker push therrapp/messages-service$SUFFIX:latest
  docker push therrapp/messages-service$SUFFIX:$GIT_SHA
fi
if should_publish_service "therr-services/push-notifications-service"; then
  ((NUMBER_SERVICES_PUBLISHED=i+1))
  docker push therrapp/push-notifications-service$SUFFIX:latest
  docker push therrapp/push-notifications-service$SUFFIX:$GIT_SHA
fi
if should_publish_service "therr-services/reactions-service"; then
  ((NUMBER_SERVICES_PUBLISHED=i+1))
  docker push therrapp/reactions-service$SUFFIX:latest
  docker push therrapp/reactions-service$SUFFIX:$GIT_SHA
fi
if should_publish_service "therr-services/users-service"; then
  ((NUMBER_SERVICES_PUBLISHED=i+1))
  docker push therrapp/users-service$SUFFIX:latest
  docker push therrapp/users-service$SUFFIX:$GIT_SHA
fi
if should_publish_service "therr-services/websocket-service"; then
  ((NUMBER_SERVICES_PUBLISHED=i+1))
  docker push therrapp/websocket-service$SUFFIX:latest
  docker push therrapp/websocket-service$SUFFIX:$GIT_SHA
fi

if [[ "$CURRENT_BRANCH" == "stage" && ${NUMBER_SERVICES_PUBLISHED} -gt 0 ]]; then
## TODO: Output a list of all services that should be deployed for the given commit
cat > VERSIONS.txt <<EOF
LAST_PUBLISHED_GIT_SHA=${GIT_SHA}
EOF

  git config user.email "rili.main@gmail.com"
  git config user.name "Rili Admin"
  git add VERSIONS.txt
  git commit -m "[skip ci] Updated VERSIONS.txt"
  git push --set-upstream origin stage --no-verify
fi


echo "Docker publish complete for all services with changes"
