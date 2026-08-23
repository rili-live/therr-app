#!/bin/bash

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh
source ./_bin/lib/rollout-waves.sh
source ./_bin/lib/service-registry.sh
source ./_bin/lib/versions-ledger.sh
source ./_bin/lib/deploy-plan.sh

# Validate the wave plan and the service registry before anything touches the
# cluster, so a service that was added to k8s/prod without being placed in a wave —
# or without a registry row at all — fails here rather than by silently rejoining
# the all-at-once rollout, or by never deploying and never being mentioned.
assert_rollout_waves
assert_service_registry

CURRENT_BRANCH=${CICD_BRANCH:-$CIRCLE_BRANCH}
echo "Current branch is $CURRENT_BRANCH"

DESTINATION_BRANCH="main"
echo "Destination branch is $DESTINATION_BRANCH"

# Only deploy when the source branch is stage or main
if [[ ("$CURRENT_BRANCH" != "stage") && ("$CURRENT_BRANCH" != "main") ]]; then
  echo "Skipping post build stage."
  exit 0
fi

[[ "$CURRENT_BRANCH" = "stage" ]] && SUFFIX="-stage" || SUFFIX=""

# The stage revision this commit is promoting. Published images are checked against
# this rather than against HEAD^1, because HEAD^1 only describes the merge and says
# nothing about whether the images were built from the code inside it.
PROMOTED_TIP="$(promoted_tip)"
echo "Promoting stage tip $PROMOTED_TIP"

ledger_load VERSIONS.txt

# Where the plan is handed to run-migrations.sh, so migrations are gated on the
# version range each service actually moved through rather than on a git diff that
# assumes the previous deploy landed.
DEPLOY_PLAN_FILE="${DEPLOY_PLAN_FILE:-.deploy-plan.tsv}"

# `kubectl set image` returns as soon as the Deployment spec is patched, so a pod
# that never passes its startup probe would otherwise leave this job green while
# the rollout sat wedged. Every Deployment this run touches is verified with
# `kubectl rollout status` before the deploy moves on.
#
# Rollouts still go out in waves, but only three of them, and only to control
# version skew — everything internal, then the API gateway, then the browser
# bundle last. The seven-wave plan that predated the cluster move existed to keep
# at most one surge Pod per node pool; the new cluster's nodes absorb the whole
# surge footprint, so that constraint is gone. _bin/lib/rollout-waves.sh holds the
# plan and the reasoning.
#
# Deliberately longer than the manifests' progressDeadlineSeconds (300s) so the
# Deployment controller is the one to give up first. It marks the rollout
# Failed with a ProgressDeadlineExceeded reason that `rollout status` then
# prints, which beats the bare "timed out waiting for the condition" we would
# get from losing that race.
ROLLOUT_TIMEOUT="${DEPLOY_ROLLOUT_TIMEOUT:-360s}"
# How long to let a wave's superseded Pods finish terminating before the next
# wave surges. This was a capacity gate: `rollout status` returns as soon as the
# new ReplicaSet is complete, but the old Pod holds its memory reservation
# through terminationGracePeriodSeconds (30s, 45s for users-service), and on the
# old cluster starting the next wave before it was gone handed the scheduler an
# over-subscribed node.
#
# Defaults to 0 (skip the wait) now that there is headroom to spare — it bought
# nothing but ~30-45s per wave boundary. Set DEPLOY_DRAIN_TIMEOUT to a positive
# number of seconds to bring the gate back, e.g. while draining a node pool or
# after shrinking the cluster.
DRAIN_TIMEOUT="${DEPLOY_DRAIN_TIMEOUT:-0}"

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

# ---------------------------------------------------------------------------
# Planning
#
# Nothing below touches the cluster. The plan is computed and printed in full, and
# a blocking verdict stops the run here — before any manifest is applied and before
# any image is promoted — so that a half-applied deploy is not a state this script
# can reach by way of an unpullable tag.
# ---------------------------------------------------------------------------

# The tag a Deployment is serving right now.
#
# Read before `kubectl apply` runs, not after. The manifests all pin `:latest`, and
# apply's three-way merge leaves the live tag alone only because `:latest` is
# unchanged between the manifest and its last-applied annotation. That is a thin
# guarantee to read state through, so the plan snapshots the cluster first.
running_tag_for()
{
  local DEPLOYMENT=$1
  local CONTAINER=$2
  local IMAGE

  IMAGE="$(kubectl get "deployment/$DEPLOYMENT" \
    -o jsonpath="{.spec.template.spec.containers[?(@.name==\"$CONTAINER\")].image}" \
    2>/dev/null || true)"

  case "$IMAGE" in
    *:*) printf '%s' "${IMAGE##*:}" ;;
    *) printf '' ;;
  esac
}

# `docker manifest inspect` asks the registry without downloading layers, which is
# what makes a whole-plan existence check affordable. Not every Docker CLI build
# exposes it, so the fallback is a real pull — slower, but it answers the same
# question, and a probe that cannot run must not default to "exists": that is how
# the missing tag used to reach `docker pull` under `set -e` mid-loop.
DOCKER_MANIFEST_SUPPORTED=false
if docker manifest inspect --help >/dev/null 2>&1; then
  DOCKER_MANIFEST_SUPPORTED=true
fi

image_exists()
{
  if [ "$DOCKER_MANIFEST_SUPPORTED" = "true" ]; then
    docker manifest inspect "$1" >/dev/null 2>&1
  else
    docker pull "$1" >/dev/null 2>&1
  fi
}

PLAN_KEYS=()
PLAN_DESIRED=()
PLAN_RUNNING=()
PLAN_VERDICTS=()

BLOCKED=()

for KEY in $(service_keys); do
  DEPLOYMENT="$(service_deployment "$KEY")"
  CONTAINER="$(service_container "$KEY")"
  IMAGE="$(service_image "$KEY")"
  SOURCES="$(service_sources "$KEY")"

  DESIRED="$(ledger_resolve "$KEY")"
  RUNNING="$(running_tag_for "$DEPLOYMENT" "$CONTAINER")"

  CHANGED_IN_MERGE=false
  # stdout only: the per-path "Found N files changed" lines would drown the plan
  # table, but a git failure on stderr still needs to be visible.
  if has_prev_diff_changes_any $SOURCES >/dev/null; then
    CHANGED_IN_MERGE=true
  fi

  IMAGE_EXISTS=false
  BUILD_STALE=false
  WOULD_ROLL_BACK=false

  if [ -n "$DESIRED" ]; then
    # "Did this service's code move on after the image we are about to deploy was
    # built?" If so the image under-represents the promotion, and deploying it
    # would leave the service stale with a green build — the exact failure this
    # rewrite exists to stop.
    if sources_changed_between "$DESIRED" "$PROMOTED_TIP" $SOURCES; then
      BUILD_STALE=true
    fi

    if image_exists "therrapp/$IMAGE-stage:$DESIRED"; then
      IMAGE_EXISTS=true
    fi

    # An accidental re-run of an older pipeline should not quietly downgrade
    # production, so a desired tag that is an ancestor of the running one is
    # reported rather than applied.
    if [ -n "$RUNNING" ] && [ "$RUNNING" != "$DESIRED" ] \
      && git merge-base --is-ancestor "$DESIRED" "$RUNNING" 2>/dev/null; then
      WOULD_ROLL_BACK=true
    fi
  fi

  VERDICT="$(plan_verdict "$DESIRED" "$RUNNING" "$IMAGE_EXISTS" "$BUILD_STALE" "$WOULD_ROLL_BACK" "$CHANGED_IN_MERGE")"

  PLAN_KEYS+=("$KEY")
  PLAN_DESIRED+=("$DESIRED")
  PLAN_RUNNING+=("$RUNNING")
  PLAN_VERDICTS+=("$VERDICT")

  if verdict_is_blocking "$VERDICT"; then
    BLOCKED+=("$KEY ($VERDICT): $(verdict_explanation "$VERDICT")")
  fi
done

print_plan()
{
  local TOTAL=${#PLAN_KEYS[@]}
  local INDEX=0

  printf '\n%-28s %-12s %-12s %s\n' "SERVICE" "RUNNING" "DESIRED" "VERDICT"
  printf -- '---------------------------------------------------------------------------\n'

  while [ "$INDEX" -lt "$TOTAL" ]; do
    printf '%-28s %-12s %-12s %s\n' \
      "${PLAN_KEYS[$INDEX]}" \
      "${PLAN_RUNNING[$INDEX]:0:10}" \
      "${PLAN_DESIRED[$INDEX]:0:10}" \
      "${PLAN_VERDICTS[$INDEX]}"
    INDEX=$((INDEX + 1))
  done

  printf -- '---------------------------------------------------------------------------\n'

  # Warnings are printed with their explanation so that pre-existing drift is
  # visible in the log every run, rather than only on the run that finally trips
  # over it.
  INDEX=0
  while [ "$INDEX" -lt "$TOTAL" ]; do
    if verdict_is_warning "${PLAN_VERDICTS[$INDEX]}"; then
      printMessageWarning "${PLAN_KEYS[$INDEX]}: $(verdict_explanation "${PLAN_VERDICTS[$INDEX]}")"
    fi
    INDEX=$((INDEX + 1))
  done

  echo ""
}

print_plan

# Written whether or not the deploy proceeds — a blocked run's plan is exactly what
# someone needs to read.
{
  INDEX=0
  while [ "$INDEX" -lt "${#PLAN_KEYS[@]}" ]; do
    printf '%s\t%s\t%s\t%s\n' \
      "${PLAN_KEYS[$INDEX]}" "${PLAN_RUNNING[$INDEX]}" "${PLAN_DESIRED[$INDEX]}" "${PLAN_VERDICTS[$INDEX]}"
    INDEX=$((INDEX + 1))
  done
} > "$DEPLOY_PLAN_FILE"

if [ ${#BLOCKED[@]} -gt 0 ]; then
  printMessageError "Refusing to deploy — the published images do not cover this promotion:"
  for PROBLEM in "${BLOCKED[@]}"; do
    printMessageError "  - $PROBLEM"
  done
  printMessageError ""
  printMessageError "Nothing has been applied to the cluster. The usual cause is a stage build that"
  printMessageError "did not finish before stage was merged to main: re-run the stage pipeline, let"
  printMessageError "it publish, merge the resulting VERSIONS.txt commit into main, and re-deploy."
  exit 1
fi

# ---------------------------------------------------------------------------
# Rollout
# ---------------------------------------------------------------------------

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
#
# A DRAIN_TIMEOUT of 0 (the default) skips the wait entirely.
wait_for_drain()
{
  if [ "$DRAIN_TIMEOUT" -le 0 ]; then
    return 0
  fi

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
# is what keeps a manifest-only deploy ordered too.
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
      # Stopping here keeps the skew window closed in the safe direction: if the
      # backend never came up, the last thing we want is to hand browsers a new
      # bundle that calls it.
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

# Promote and queue every service whose running tag differs from its published tag.
#
# The old script gated this on `git diff HEAD^1`, which meant a service missed by
# one deploy stayed missed by every deploy after it: the range that would have
# named it had already scrolled past. Driving it from the running-vs-desired
# comparison instead makes the deploy convergent — whatever the cluster is behind
# on gets picked up here, regardless of which merge introduced it.
#
# NOTE: stage and main docker tags are essentially the same. The Docker container is
# interchangable and implements env variables injected by Kubernetes.
INDEX=0
while [ "$INDEX" -lt "${#PLAN_KEYS[@]}" ]; do
  KEY="${PLAN_KEYS[$INDEX]}"
  VERDICT="${PLAN_VERDICTS[$INDEX]}"
  DESIRED="${PLAN_DESIRED[$INDEX]}"
  INDEX=$((INDEX + 1))

  if [ "$VERDICT" != "deploy" ]; then
    echo "Skipping $KEY deployment ($VERDICT)"
    continue
  fi

  IMAGE="$(service_image "$KEY")"

  docker pull "therrapp/$IMAGE-stage:$DESIRED"
  if [[ "$CURRENT_BRANCH" == "main" ]]; then
    docker tag "therrapp/$IMAGE-stage:$DESIRED" "therrapp/$IMAGE:$DESIRED"
    docker tag "therrapp/$IMAGE-stage:$DESIRED" "therrapp/$IMAGE:latest"
    docker push "therrapp/$IMAGE:$DESIRED"
    docker push "therrapp/$IMAGE:latest"
  fi

  queue_image "$(service_deployment "$KEY")" "$(service_container "$KEY")=therrapp/$IMAGE$SUFFIX:$DESIRED"
done

echo "Image bumps queued for all services behind their published version"

# Roll the queued images out wave by wave, failing the deploy if any pod never
# reached Ready. Runs before migrations so we never migrate the schema
# underneath a rollout that is already wedged.
deploy_waves

# Run any pending database migrations for services this deploy actually moved.
# Reuses the freshly rolled-out pods (which already have the Cloud SQL proxy + DB
# secrets). Additive/expand-contract migrations only. Set
# RUN_MIGRATIONS_ON_DEPLOY=false to skip. See run-migrations.sh.
DEPLOY_PLAN_FILE="$DEPLOY_PLAN_FILE" ./_bin/cicd/run-migrations.sh

# Confirm the cluster ended up where the plan said it would. `rollout status`
# already proved the pods came up; this proves they came up on the intended tag,
# which is the half that used to go unchecked — and it closes the loop on the
# failure this rewrite is about, because a service still short of its desired tag
# after a "successful" deploy now fails the job instead of waiting to be noticed.
DRIFTED=()
INDEX=0
while [ "$INDEX" -lt "${#PLAN_KEYS[@]}" ]; do
  KEY="${PLAN_KEYS[$INDEX]}"
  VERDICT="${PLAN_VERDICTS[$INDEX]}"
  DESIRED="${PLAN_DESIRED[$INDEX]}"
  INDEX=$((INDEX + 1))

  [ "$VERDICT" = "deploy" ] || continue

  FINAL="$(running_tag_for "$(service_deployment "$KEY")" "$(service_container "$KEY")")"
  if [ "$FINAL" != "$DESIRED" ]; then
    DRIFTED+=("$KEY (running ${FINAL:-none}, expected $DESIRED)")
  fi
done

if [ ${#DRIFTED[@]} -gt 0 ]; then
  printMessageError "Deploy finished but these services are not on their published version:"
  for PROBLEM in "${DRIFTED[@]}"; do
    printMessageError "  - $PROBLEM"
  done
  exit 1
fi

printMessageSuccess "All services are running their published version."

# VERSIONS.txt is deliberately NOT rewritten here.
#
# This job used to truncate it and push the empty file to main, which is what made
# stage and main disagree about a file neither is edited by hand — every back-merge
# then carried a conflict whose wrong resolution silently re-pointed the next deploy
# at an arbitrary SHA. The ledger has one writer (publish.sh, on stage) and main only
# reads it. Re-running this job is idempotent without the truncation, because the
# plan above compares against the cluster rather than against a file it just cleared.
