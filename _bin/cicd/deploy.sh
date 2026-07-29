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

should_deploy_web_app()
{
  has_prev_diff_changes "therr-client-web" || [ "$HAS_ANY_LIBRARY_CHANGES" = "true" ] || [ "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = "true" ]
}

# NOTE: This is currently included in the web app build (container)
should_deploy_web_app_dashboard()
{
  has_prev_diff_changes "therr-client-web-dashboard" || [ "$HAS_ANY_LIBRARY_CHANGES" = "true" ] || [ "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = "true" ]
}

should_deploy_service()
{
  SERVICE_DIR=$1
  has_prev_diff_changes $SERVICE_DIR || [ "$HAS_UTILITIES_LIBRARY_CHANGES" = "true" ] || [ "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = "true" ]
}

# `kubectl set image` returns as soon as the Deployment spec is patched, so a pod
# that never passes its startup probe used to leave this job green while the
# rollout sat wedged. Deployments touched by this run are recorded here and
# verified together at the end, so they still roll out in parallel.
UPDATED_DEPLOYMENTS=()
# Deliberately longer than the manifests' progressDeadlineSeconds (300s) so the
# Deployment controller is the one to give up first. It marks the rollout
# Failed with a ProgressDeadlineExceeded reason that `rollout status` then
# prints, which beats the bare "timed out waiting for the condition" we would
# get from losing that race.
ROLLOUT_TIMEOUT="${DEPLOY_ROLLOUT_TIMEOUT:-360s}"

# Idempotent: a Deployment can be both reconfigured by `kubectl apply` and
# re-imaged by `kubectl set image` in the same run, and verifying it twice would
# just double the timeout budget on a wedged rollout.
track_rollout()
{
  local DEPLOYMENT
  for DEPLOYMENT in ${UPDATED_DEPLOYMENTS[@]+"${UPDATED_DEPLOYMENTS[@]}"}; do
    if [ "$DEPLOYMENT" = "$1" ]; then
      return 0
    fi
  done
  UPDATED_DEPLOYMENTS+=("$1")
}

verify_rollouts()
{
  if [ ${#UPDATED_DEPLOYMENTS[@]} -eq 0 ]; then
    echo "No deployments updated — nothing to verify."
    return 0
  fi

  local DEPLOYMENT
  local FAILED=()

  for DEPLOYMENT in "${UPDATED_DEPLOYMENTS[@]}"; do
    echo "Verifying rollout of $DEPLOYMENT (timeout $ROLLOUT_TIMEOUT)..."
    if kubectl rollout status "deployment/$DEPLOYMENT" --timeout="$ROLLOUT_TIMEOUT"; then
      printMessageSuccess "$DEPLOYMENT rolled out successfully."
    else
      printMessageError "$DEPLOYMENT failed to roll out."
      FAILED+=("$DEPLOYMENT")

      # Surface why, so the failure is actionable straight from the CI log
      # instead of requiring someone to open a shell against the cluster.
      echo "--- Recent events for $DEPLOYMENT ---"
      kubectl describe "deployment/$DEPLOYMENT" | tail -n 25 || true
      # Deployment-owned pods are always named "<deployment>-<rs>-<pod>", which is
      # a more dependable handle than reconstructing the label selector.
      kubectl get pods --no-headers | grep "^$DEPLOYMENT-" || true
      echo "--- End events for $DEPLOYMENT ---"
    fi
  done

  if [ ${#FAILED[@]} -gt 0 ]; then
    printMessageError "Rollout failed for: ${FAILED[*]}"
    printMessageError "The previous pods are still serving (maxUnavailable: 0)."
    printMessageError "Roll back with: kubectl rollout undo deployment/<name>"
    return 1
  fi

  return 0
}

# Kubectl Apply
#
# This also rolls pods on its own: a manifest-only change (probes, env, strategy,
# resources) reconfigures a Deployment with no corresponding `set image` below,
# so those rollouts have to be tracked here or they go unverified. `apply` prints
# one "deployment.apps/<name> configured" line per Deployment it actually
# changed, and "unchanged" for the rest.
APPLY_OUTPUT="$(kubectl apply -f k8s/prod)"
echo "$APPLY_OUTPUT"

while read -r RECONFIGURED; do
  track_rollout "$RECONFIGURED"
done < <(echo "$APPLY_OUTPUT" | sed -n 's|^deployment\.apps/\(.*\) configured$|\1|p')

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
  track_rollout client-deployment
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
  track_rollout api-gateway-service-deployment
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
  track_rollout push-notifications-service-deployment
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
  track_rollout maps-service-deployment
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
  track_rollout messages-service-deployment
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
  track_rollout reactions-service-deployment
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
  track_rollout users-service-deployment
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
  track_rollout websocket-service-deployment
else
  echo "Skipping websocket-service deployment (No Changes)"
fi

echo "Kubectl apply complete for all services with changes"

# Fail the deploy if any pod never reached Ready. Runs before migrations so we
# never migrate the schema underneath a rollout that is already wedged.
verify_rollouts

# Run any pending database migrations for services whose migration files
# changed in this deploy. Reuses the freshly rolled-out pods (which already
# have the Cloud SQL proxy + DB secrets). Additive/expand-contract migrations
# only. Set RUN_MIGRATIONS_ON_DEPLOY=false to skip. See run-migrations.sh.
./_bin/cicd/run-migrations.sh

echo "Resetting VERSIONS.txt"
cat > VERSIONS.txt <<EOF
EOF

git config user.email "rili.main@gmail.com"
git config user.name "Rili Admin"
git add VERSIONS.txt
git commit -m "[skip ci] Updated VERSIONS.txt"
git push --set-upstream origin main --no-verify
