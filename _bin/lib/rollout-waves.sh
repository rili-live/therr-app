#!/bin/bash

# Ordered rollout waves for deploys to k8s/prod.
#
# WHY THIS EXISTS
#
# Every Deployment in k8s/prod is `replicas: 1` with `maxSurge: 1 /
# maxUnavailable: 0`. That keeps the old Pod serving until the replacement is
# Ready, but it also means each rolling Deployment transiently needs *two* Pods
# instead of one. Rolling all ten at once therefore doubles the Pod footprint of
# the entire cluster — and the cluster is two nodes with no headroom.
#
# On 2026-08-12 that wedged a deploy for 10+ minutes:
#   - client / messages / reactions / push-notifications carry a hard
#     `nodeSelector: cloud.google.com/gke-preemptible: "true"`, so they can only
#     land on the one preemptible node. All four surged at once, the node ran out
#     of memory, and the scheduler had no fallback and no preemption victims.
#   - api-gateway / users / websocket all prefer the main pool, so all three
#     surge Pods landed on the one main-pool node together. Three simultaneous
#     image pulls and Node boots at 10-15m CPU requests starved each other badly
#     enough that the startup probes were still getting `connection refused` ten
#     minutes in, and the co-located ingress-nginx controller began failing its
#     own liveness check.
#
# THE TWO RULES ENCODED BELOW
#
# 1. Node-pool safety: a wave surges at most one Pod onto each node pool, so the
#    scheduler is never asked to fit two extra Pods on one node. This is the part
#    that actually prevents the incident, and `assert_rollout_waves` enforces it
#    from the manifests rather than from a comment.
#
# 2. Skew direction: waves run inside-out — backing stores, then services, then
#    the API gateway, then the public web app dead last. Because maxUnavailable
#    is 0 everywhere, no ordering is needed to keep things *available*; ordering
#    is about which version-skew window is open during the deploy. Old-client ->
#    new-backend is safe by the same expand/contract discipline the migrations
#    follow. New-client -> old-backend is the one that breaks users, so the
#    browser bundle is the last thing to flip.
#
# ADDING A SERVICE
#
# Add it to a wave. `assert_rollout_waves` fails the deploy if any
# k8s/prod/*-deployment.yaml is not claimed by exactly one wave, so a new service
# cannot silently rejoin the all-at-once herd. Run `npm run k8s:check-waves`
# after editing.

K8S_PROD_DIR="${K8S_PROD_DIR:-k8s/prod}"

# Each entry is a space-separated list of Deployment names rolled concurrently.
# Deployment name == manifest basename, for every file in k8s/prod.
ROLLOUT_WAVES=(
  "redis-deployment redis-ephemeral-deployment"
  "users-service-deployment messages-service-deployment"
  "websocket-service-deployment reactions-service-deployment"
  "maps-service-deployment"
  "push-notifications-service-deployment"
  "api-gateway-service-deployment"
  "client-deployment"
)

# Parallel to ROLLOUT_WAVES, for legible CI output.
ROLLOUT_WAVE_NAMES=(
  "backing stores"
  "identity + messaging"
  "realtime + reactions"
  "geo"
  "push notifications"
  "api edge"
  "public web"
)

# Which node pool a Deployment lands on, read from its manifest so this cannot
# drift from the scheduling constraints it is supposed to describe.
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
  # pool. A soft preference can always fall back, but the fallback is what
  # overloads the *other* node, so treat it as a pin for wave-packing purposes.
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

  # 2. No wave surges two Pods onto the same node pool.
  INDEX=0
  for WAVE in "${ROLLOUT_WAVES[@]}"; do
    INDEX=$((INDEX + 1))

    local SEEN_MAIN=0
    local SEEN_PREEMPTIBLE=0

    for MEMBER in $WAVE; do
      local POOL
      POOL="$(rollout_pool "$MEMBER")"
      case "$POOL" in
        main) SEEN_MAIN=$((SEEN_MAIN + 1)) ;;
        preemptible) SEEN_PREEMPTIBLE=$((SEEN_PREEMPTIBLE + 1)) ;;
        missing) PROBLEMS+=("wave $INDEX names $MEMBER, but $K8S_PROD_DIR/$MEMBER.yaml does not exist") ;;
      esac
    done

    if [ "$SEEN_MAIN" -gt 1 ] || [ "$SEEN_PREEMPTIBLE" -gt 1 ]; then
      PROBLEMS+=("wave $INDEX ($WAVE) surges more than one Pod onto the same node pool — split it")
    fi
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
