#!/bin/bash

# Ordered rollout waves for deploys to k8s/prod.
#
# WHY THIS EXISTS
#
# Every Deployment in k8s/prod is `replicas: 1` with `maxSurge: 1 /
# maxUnavailable: 0`. That keeps the old Pod serving until the replacement is
# Ready, but it also means each rolling Deployment transiently needs *two* Pods
# instead of one.
#
# On 2026-08-12 that wedged a deploy for 10+ minutes on the old two-node cluster,
# which had no headroom to absorb ten simultaneous surge Pods: four Deployments
# hard-pinned to the single preemptible node hit FailedScheduling on Insufficient
# memory, and three more surging onto the single main-pool node starved each
# other's image pulls and Node boots past their startup probes.
#
# THE PLAN AFTER THE CLUSTER MOVE
#
# The new cluster's nodes are large enough to absorb the whole surge footprint at
# once, so the original constraint — at most one surge Pod per node pool per wave,
# which is what forced seven waves — no longer applies and is no longer enforced.
# Fitting the surge is now the scheduler's problem, as it should be.
#
# Confirmed 2026-08-14: main-pool has ample headroom on the new node sizes. That
# retires the old shortfall (~103Mi uncommitted against a 144Mi users-service surge
# Pod), which is what would have forced users-service onto a preemptible node —
# node affinity there is `preferred`, not `required`, so it would have scheduled
# rather than sat Pending, and the rollout would have "succeeded" onto a node that
# can be preempted. If node sizes are ever reduced, re-measure before trusting this:
# the packing rule removed from `assert_rollout_waves` is what compensated for it.
#
# What survives the capacity increase is the reason that was never about capacity:
#
#   Skew direction. Waves run inside-out — everything internal, then the API
#   gateway, then the public web app dead last. Because maxUnavailable is 0
#   everywhere, no ordering is needed to keep things *available*; ordering is
#   about which version-skew window is open during the deploy. Old-client ->
#   new-backend is safe by the same expand/contract discipline the migrations
#   follow. New-client -> old-backend is the one that breaks users, so the
#   browser bundle is the last thing to flip.
#
# That needs exactly three waves, and `assert_rollout_waves` still pins the last
# two by name.
#
# ADDING A SERVICE
#
# Add it to a wave — in practice, to wave 1 unless it serves browsers directly.
# `assert_rollout_waves` fails the deploy if any k8s/prod/*-deployment.yaml is not
# claimed by exactly one wave, so a new service cannot silently escape the skew
# ordering. Run `npm run k8s:check-waves` after editing.

K8S_PROD_DIR="${K8S_PROD_DIR:-k8s/prod}"

# Each entry is a space-separated list of Deployment names rolled concurrently.
# Deployment name == manifest basename, for every file in k8s/prod.
ROLLOUT_WAVES=(
  "redis-deployment redis-ephemeral-deployment users-service-deployment messages-service-deployment websocket-service-deployment reactions-service-deployment maps-service-deployment push-notifications-service-deployment"
  "api-gateway-service-deployment"
  "client-deployment"
)

# Parallel to ROLLOUT_WAVES, for legible CI output.
ROLLOUT_WAVE_NAMES=(
  "backing stores + internal services"
  "api edge"
  "public web"
)

# Which node pool a Deployment lands on, read from its manifest so this cannot
# drift from the scheduling constraints it is supposed to describe. No longer
# gates the plan — it labels each member in the `npm run k8s:check-waves` output,
# and doubles as the existence probe for a wave entry, so that a manifest whose
# scheduling has drifted is visible when someone reads the plan.
#
# Echoes one of: preemptible | main | unpinned | missing
rollout_pool()
{
  local MANIFEST="$K8S_PROD_DIR/$1.yaml"

  if [ ! -f "$MANIFEST" ]; then
    echo "missing"
    return 0
  fi

  # A hard nodeSelector is the only pin that can leave a Pod unschedulable, so it
  # wins over the soft nodeAffinity preference checked below.
  if grep -qE '^[[:space:]]+cloud\.google\.com/gke-preemptible:[[:space:]]*"true"' "$MANIFEST"; then
    echo "preemptible"
    return 0
  fi

  # In the nodeAffinity preference, `operator: Exists` on the preemptible label
  # leans the Pod at the preemptible pool and `DoesNotExist` leans it at the main
  # pool. A soft preference can always fall back, so this reports where the Pod
  # is *expected* to land, not where it is guaranteed to.
  local PREFERENCE
  PREFERENCE="$(grep -A1 'key: cloud\.google\.com/gke-preemptible' "$MANIFEST" \
    | grep -oE 'operator: (Exists|DoesNotExist)' \
    | head -n 1 || true)"

  case "$PREFERENCE" in
    "operator: DoesNotExist") echo "main" ;;
    "operator: Exists") echo "preemptible" ;;
    *) echo "unpinned" ;;
  esac
}

# Fails loudly rather than deploying a wave plan that no longer matches the
# manifests. Called at the top of deploy.sh, before anything touches the cluster.
assert_rollout_waves()
{
  local PROBLEMS
  PROBLEMS=()
  local WAVE
  local MEMBER
  local INDEX

  # 1. Every Deployment manifest is claimed by exactly one wave.
  local MANIFEST
  for MANIFEST in "$K8S_PROD_DIR"/*-deployment.yaml; do
    local NAME
    NAME="$(basename "$MANIFEST" .yaml)"

    local MATCHES=0
    for WAVE in "${ROLLOUT_WAVES[@]}"; do
      for MEMBER in $WAVE; do
        if [ "$MEMBER" = "$NAME" ]; then
          MATCHES=$((MATCHES + 1))
        fi
      done
    done

    if [ "$MATCHES" -ne 1 ]; then
      PROBLEMS+=("$NAME is named by $MATCHES waves (expected exactly 1) — add it to ROLLOUT_WAVES")
    fi
  done

  # 2. Every wave member names a manifest that actually exists. (Rule 1 catches a
  #    manifest with no wave; this catches a wave entry with no manifest — a typo
  #    or a Deployment that was deleted without being removed from the plan.)
  INDEX=0
  for WAVE in "${ROLLOUT_WAVES[@]}"; do
    INDEX=$((INDEX + 1))

    for MEMBER in $WAVE; do
      if [ "$(rollout_pool "$MEMBER")" = "missing" ]; then
        PROBLEMS+=("wave $INDEX names $MEMBER, but $K8S_PROD_DIR/$MEMBER.yaml does not exist")
      fi
    done
  done

  # 3. ROLLOUT_WAVE_NAMES stays parallel, or the CI output mislabels waves.
  if [ "${#ROLLOUT_WAVE_NAMES[@]}" -ne "${#ROLLOUT_WAVES[@]}" ]; then
    PROBLEMS+=("ROLLOUT_WAVE_NAMES has ${#ROLLOUT_WAVE_NAMES[@]} entries but ROLLOUT_WAVES has ${#ROLLOUT_WAVES[@]}")
  fi

  # 4. Skew direction: the browser bundle flips last, the gateway just before it.
  local LAST=$(( ${#ROLLOUT_WAVES[@]} - 1 ))
  if [ "${ROLLOUT_WAVES[$LAST]}" != "client-deployment" ]; then
    PROBLEMS+=("the final wave must be exactly 'client-deployment' so a new browser bundle never calls an old API")
  fi
  if [ "$LAST" -lt 1 ] || [ "${ROLLOUT_WAVES[$((LAST - 1))]}" != "api-gateway-service-deployment" ]; then
    PROBLEMS+=("the wave before the last must be exactly 'api-gateway-service-deployment' so the gateway leads the web app")
  fi

  if [ "${#PROBLEMS[@]}" -gt 0 ]; then
    echo "Invalid rollout wave plan in _bin/lib/rollout-waves.sh:" >&2
    local PROBLEM
    for PROBLEM in "${PROBLEMS[@]}"; do
      echo "  - $PROBLEM" >&2
    done
    return 1
  fi

  return 0
}

# Running this file directly checks the plan without deploying anything.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  if assert_rollout_waves; then
    echo "Rollout wave plan is valid (${#ROLLOUT_WAVES[@]} waves)."
    INDEX=0
    for WAVE in "${ROLLOUT_WAVES[@]}"; do
      echo "  $((INDEX + 1)). ${ROLLOUT_WAVE_NAMES[$INDEX]}"
      for MEMBER in $WAVE; do
        echo "       - $MEMBER [$(rollout_pool "$MEMBER") pool]"
      done
      INDEX=$((INDEX + 1))
    done
  else
    exit 1
  fi
fi
