#!/bin/bash

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh
source ./_bin/lib/rollout-waves.sh

# Validate the wave plan before anything touches the cluster, so a service that
# was added to k8s/prod without being placed in a wave fails here rather than by
# silently rejoining the all-at-once rollout this file exists to prevent.
assert_rollout_waves

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
# that never passes its startup probe would otherwise leave this job green while
# the rollout sat wedged. Every Deployment this run touches is verified with
# `kubectl rollout status` before the deploy moves on.
#
# Rollouts are staggered rather than fired all at once. Each Deployment is
# `replicas: 1` with `maxSurge: 1 / maxUnavailable: 0`, so rolling all of them
# together transiently doubles the Pod footprint of a two-node cluster that has
# no headroom — which is exactly how the 2026-08-12 deploy wedged for 10+
# minutes. _bin/lib/rollout-waves.sh holds the wave plan and the reasoning.
#
# Deliberately longer than the manifests' progressDeadlineSeconds (300s) so the
# Deployment controller is the one to give up first. It marks the rollout
# Failed with a ProgressDeadlineExceeded reason that `rollout status` then
# prints, which beats the bare "timed out waiting for the condition" we would
# get from losing that race.
ROLLOUT_TIMEOUT="${DEPLOY_ROLLOUT_TIMEOUT:-360s}"
# How long to let a wave's superseded Pods finish terminating before the next
# wave surges. `rollout status` returns as soon as the new ReplicaSet is
# complete, but the old Pod is still holding its memory reservation through
# terminationGracePeriodSeconds (30s) — starting the next wave before it is gone
# would hand the scheduler the same over-subscribed node the staggering is meant
# to avoid.
DRAIN_TIMEOUT="${DEPLOY_DRAIN_TIMEOUT:-90}"

# Image bumps are queued here instead of applied inline, so that the wave walker
# below — not the order these service blocks happen to be written in — decides
# when each Deployment actually starts rolling.
QUEUED_DEPLOYMENTS=()
QUEUED_IMAGES=()

queue_image()
{
  QUEUED_DEPLOYMENTS+=("$1")
  QUEUED_IMAGES+=("$2")
}

# Echoes the queued "<container>=<image>" for a Deployment; non-zero if none.
#
# Indexed by position rather than by iterating `${!QUEUED_DEPLOYMENTS[@]}`: the
# guarded form of that expansion (needed for the empty-array case) silently
# yields nothing even when the array is populated, which would skip every image
# bump while still reporting a green deploy.
queued_image_for()
{
  local TOTAL=${#QUEUED_DEPLOYMENTS[@]}
  local INDEX=0

  while [ "$INDEX" -lt "$TOTAL" ]; do
    if [ "${QUEUED_DEPLOYMENTS[$INDEX]}" = "$1" ]; then
      echo "${QUEUED_IMAGES[$INDEX]}"
      return 0
    fi
    INDEX=$((INDEX + 1))
  done

  return 1
}

wait_for_rollouts()
{
  local DEPLOYMENT
  local FAILED
  FAILED=()

  for DEPLOYMENT in "$@"; do
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
      # FailedScheduling is reported against the Pod, not the Deployment, so the
      # describe above misses the "Insufficient memory" case entirely.
      kubectl get events --field-selector reason=FailedScheduling \
        --sort-by=.lastTimestamp --no-headers 2>/dev/null | tail -n 10 || true
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

# Blocks until each Deployment's superseded Pods are actually gone. Best effort:
# a Pod stuck Terminating is worth a warning, not a failed deploy, since the
# rollout it belongs to has already been confirmed complete.
wait_for_drain()
{
  local DEADLINE=$((SECONDS + DRAIN_TIMEOUT))
  local PENDING

  while [ $SECONDS -lt $DEADLINE ]; do
    PENDING=""

    local DEPLOYMENT
    for DEPLOYMENT in "$@"; do
      # .status.replicas counts every non-terminated Pod the Deployment owns, so
      # it stays above .spec.replicas until the old Pod is fully gone.
      local CURRENT
      local DESIRED
      CURRENT="$(kubectl get "deployment/$DEPLOYMENT" -o jsonpath='{.status.replicas}' 2>/dev/null || echo "")"
      DESIRED="$(kubectl get "deployment/$DEPLOYMENT" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "")"

      if [ -n "$CURRENT" ] && [ -n "$DESIRED" ] && [ "$CURRENT" -gt "$DESIRED" ]; then
        PENDING="$PENDING $DEPLOYMENT"
      fi
    done

    if [ -z "$PENDING" ]; then
      return 0
    fi

    echo "Waiting for superseded pods to terminate:$PENDING"
    sleep 5
  done

  printMessageWarning "Superseded pods still terminating after ${DRAIN_TIMEOUT}s:$PENDING"
  printMessageWarning "Continuing — the next wave may contend for their memory."
  return 0
}

# Walks the wave plan, rolling each wave to completion before starting the next.
#
# Both kinds of change are applied here: a manifest edit (probes, env, strategy,
# resources) rolls a Deployment just as an image bump does, so applying the
# Deployment manifests wave by wave — rather than in one directory-wide apply —
# is what keeps a manifest-only deploy staggered too.
deploy_waves()
{
  local WAVE_INDEX=0
  local WAVE

  for WAVE in "${ROLLOUT_WAVES[@]}"; do
    local WAVE_NAME="${ROLLOUT_WAVE_NAMES[$WAVE_INDEX]}"
    local WAVE_LABEL="wave $((WAVE_INDEX + 1))/${#ROLLOUT_WAVES[@]} ($WAVE_NAME)"
    WAVE_INDEX=$((WAVE_INDEX + 1))

    local ROLLING
    ROLLING=()

    local DEPLOYMENT
    for DEPLOYMENT in $WAVE; do
      local IS_ROLLING=false

      # `apply` prints "deployment.apps/<name> configured" only when it actually
      # changed the spec, and "unchanged" otherwise — so this both reconciles the
      # manifest and tells us whether doing so started a rollout.
      local APPLY_OUTPUT
      APPLY_OUTPUT="$(kubectl apply -f "$K8S_PROD_DIR/$DEPLOYMENT.yaml")"
      echo "$APPLY_OUTPUT"
      case "$APPLY_OUTPUT" in
        *" configured") IS_ROLLING=true ;;
      esac

      local IMAGE
      if IMAGE="$(queued_image_for "$DEPLOYMENT")"; then
        kubectl set image "deployments/$DEPLOYMENT" "$IMAGE"
        IS_ROLLING=true
      fi

      if [ "$IS_ROLLING" = "true" ]; then
        ROLLING+=("$DEPLOYMENT")
      fi
    done

    if [ ${#ROLLING[@]} -eq 0 ]; then
      echo "Skipping $WAVE_LABEL — nothing changed."
      continue
    fi

    printMessageNeutral "Rolling $WAVE_LABEL: ${ROLLING[*]}"

    if ! wait_for_rollouts "${ROLLING[@]}"; then
      printMessageError "Aborting deploy at $WAVE_LABEL."
      # Stopping here is the point of staggering: piling later waves onto a
      # cluster that could not absorb this one is how a single wedged rollout
      # became a cluster-wide one.
      local REMAINING
      REMAINING=()
      local LATER
      for LATER in "${ROLLOUT_WAVES[@]:$WAVE_INDEX}"; do
        REMAINING+=($LATER)
      done
      if [ ${#REMAINING[@]} -gt 0 ]; then
        printMessageError "Not deployed (still on the previous version): ${REMAINING[*]}"
      fi
      return 1
    fi

    wait_for_drain "${ROLLING[@]}"
  done

  return 0
}

# Kubectl Apply — everything except the Deployments.
#
# Services, Ingresses, PDBs, Certificates and the ServiceAccount cause no pod
# churn, so they are reconciled up front in one shot. The Deployment manifests
# are deliberately excluded and applied inside deploy_waves instead.
NON_DEPLOYMENT_MANIFESTS=()
for MANIFEST in "$K8S_PROD_DIR"/*.yaml; do
  case "$MANIFEST" in
    *-deployment.yaml) continue ;;
  esac

  # Directory-mode apply silently skips a file holding no objects, but naming
  # one explicitly with -f is an error, and k8s/prod has a fully commented-out
  # manifest (internal-ingress-service.yaml).
  if grep -qE '^[[:space:]]*[^#[:space:]]' "$MANIFEST"; then
    NON_DEPLOYMENT_MANIFESTS+=("-f" "$MANIFEST")
  fi
done

kubectl apply "${NON_DEPLOYMENT_MANIFESTS[@]}"

# Short circuit if GIT_SHA is empty
if [ -z "$GIT_SHA" ]; then
  echo "No new build SHA for deploy."
  echo "This might mean that the deploy was started before the stage publish job completed."
  echo "Please wait for stage to finish before merging to master"
  # No images to bump, but a manifest-only change still needs reconciling — and
  # still needs staggering, since it rolls just as many pods as an image bump.
  deploy_waves
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
  queue_image client-deployment web=therrapp/client-web$SUFFIX:$GIT_SHA
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
  queue_image api-gateway-service-deployment server-api-gateway=therrapp/api-gateway$SUFFIX:$GIT_SHA
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
  queue_image push-notifications-service-deployment server-push-notifications=therrapp/push-notifications-service$SUFFIX:$GIT_SHA
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
  queue_image maps-service-deployment server-maps=therrapp/maps-service$SUFFIX:$GIT_SHA
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
  queue_image messages-service-deployment server-messages=therrapp/messages-service$SUFFIX:$GIT_SHA
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
  queue_image reactions-service-deployment server-reactions=therrapp/reactions-service$SUFFIX:$GIT_SHA
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
  queue_image users-service-deployment server-users=therrapp/users-service$SUFFIX:$GIT_SHA
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
  queue_image websocket-service-deployment server-websocket=therrapp/websocket-service$SUFFIX:$GIT_SHA
else
  echo "Skipping websocket-service deployment (No Changes)"
fi

echo "Image bumps queued for all services with changes"

# Roll the queued images out wave by wave, failing the deploy if any pod never
# reached Ready. Runs before migrations so we never migrate the schema
# underneath a rollout that is already wedged.
deploy_waves

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
