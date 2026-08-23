#!/bin/bash

# The one list of deployable services.
#
# WHY THIS EXISTS
#
# build.sh, publish.sh and deploy.sh each used to carry their own hand-maintained
# if-chain naming the same eight services, plus their own copy of the
# "...or a library changed, or global-config.js changed" fan-out. Three lists that
# must agree, with nothing checking that they do. The failure is silent in the
# direction that costs the most: a service present in build.sh and publish.sh but
# missing from deploy.sh builds and publishes on every stage merge and then never
# deploys, and the deploy log says nothing at all about it.
#
# Everything downstream now iterates this table, so a service exists once or not at
# all, and `assert_service_registry` fails the deploy if the table has drifted from
# k8s/prod or from the rollout wave plan.
#
# FIELDS (pipe-separated)
#
#   1 key         stable identifier. Also the VERSIONS.txt ledger key, so it must
#                 match ^[a-z0-9-]+$ (see versions-ledger.sh for the mapping).
#   2 image       Docker Hub repo under therrapp/. Stage builds append "-stage".
#   3 deployment  k8s/prod Deployment name (== manifest basename).
#   4 container   container name within that Deployment, for `kubectl set image`.
#   5 dockerfile  path to the Dockerfile.
#   6 context     docker build context.
#   7 sources     space-separated paths whose changes require a rebuild. This is
#                 the full fan-out, libraries included — the deploy scripts no
#                 longer keep separate HAS_*_LIBRARY_CHANGES flags.
#
# SOURCES, AND WHY THE LIBRARIES ARE SPELLED OUT PER SERVICE
#
# Backend services compile therr-js-utilities into their image; the web container
# additionally bundles therr-react and therr-styles. Listing them inline means the
# "what feeds this image" question has one answer per service instead of being
# reconstructed from boolean flags at three call sites. TherrMobile is deliberately
# absent: it ships through EAS, not through any of these images.

THERR_LIB_UTILITIES="therr-public-library/therr-js-utilities"
THERR_LIB_WEB="therr-public-library/therr-styles therr-public-library/therr-js-utilities therr-public-library/therr-react"
THERR_GLOBAL_CONFIG="global-config.js"

THERR_SERVICES=(
  "client-web|client-web|client-deployment|web|./therr-client-web/Dockerfile|.|therr-client-web therr-client-web-dashboard $THERR_LIB_WEB $THERR_GLOBAL_CONFIG"
  "api-gateway|api-gateway|api-gateway-service-deployment|server-api-gateway|./therr-api-gateway/Dockerfile|./therr-api-gateway|therr-api-gateway $THERR_LIB_UTILITIES $THERR_GLOBAL_CONFIG"
  "push-notifications-service|push-notifications-service|push-notifications-service-deployment|server-push-notifications|./therr-services/push-notifications-service/Dockerfile|./therr-services/push-notifications-service|therr-services/push-notifications-service $THERR_LIB_UTILITIES $THERR_GLOBAL_CONFIG"
  "maps-service|maps-service|maps-service-deployment|server-maps|./therr-services/maps-service/Dockerfile|./therr-services/maps-service|therr-services/maps-service $THERR_LIB_UTILITIES $THERR_GLOBAL_CONFIG"
  "messages-service|messages-service|messages-service-deployment|server-messages|./therr-services/messages-service/Dockerfile|./therr-services/messages-service|therr-services/messages-service $THERR_LIB_UTILITIES $THERR_GLOBAL_CONFIG"
  "reactions-service|reactions-service|reactions-service-deployment|server-reactions|./therr-services/reactions-service/Dockerfile|./therr-services/reactions-service|therr-services/reactions-service $THERR_LIB_UTILITIES $THERR_GLOBAL_CONFIG"
  "users-service|users-service|users-service-deployment|server-users|./therr-services/users-service/Dockerfile|./therr-services/users-service|therr-services/users-service $THERR_LIB_UTILITIES $THERR_GLOBAL_CONFIG"
  "websocket-service|websocket-service|websocket-service-deployment|server-websocket|./therr-services/websocket-service/Dockerfile|./therr-services/websocket-service|therr-services/websocket-service $THERR_LIB_UTILITIES $THERR_GLOBAL_CONFIG"
)

# Services that own knex migrations, keyed as above. run-migrations.sh reads this
# rather than repeating the service list a fourth time.
THERR_MIGRATABLE_SERVICES="users-service maps-service messages-service reactions-service push-notifications-service"

service_keys()
{
  local ENTRY
  for ENTRY in "${THERR_SERVICES[@]}"; do
    echo "${ENTRY%%|*}"
  done
}

# Echoes field <index> (1-based) of the registry row for <key>; non-zero if the
# key is unknown, so a typo in a caller surfaces as a failure rather than as an
# empty string that quietly disables a step.
service_field()
{
  local KEY=$1
  local INDEX=$2
  local ENTRY

  for ENTRY in "${THERR_SERVICES[@]}"; do
    if [ "${ENTRY%%|*}" = "$KEY" ]; then
      printf '%s' "$ENTRY" | cut -d'|' -f"$INDEX"
      return 0
    fi
  done

  echo "Unknown service key: $KEY" >&2
  return 1
}

service_image()      { service_field "$1" 2; }
service_deployment() { service_field "$1" 3; }
service_container()  { service_field "$1" 4; }
service_dockerfile() { service_field "$1" 5; }
service_context()    { service_field "$1" 6; }
service_sources()    { service_field "$1" 7; }

# Fails loudly rather than building, publishing or deploying against a table that
# no longer matches the repo. Called at the top of build.sh, publish.sh and
# deploy.sh — the registry is upstream of all three, so a drift caught here is
# caught before any image or cluster state moves.
assert_service_registry()
{
  local PROBLEMS
  PROBLEMS=()
  local K8S_DIR="${K8S_PROD_DIR:-k8s/prod}"
  local KEY

  local SEEN=""
  for KEY in $(service_keys); do
    case "$KEY" in
      *[!a-z0-9-]*|"")
        PROBLEMS+=("key '$KEY' must match ^[a-z0-9-]+\$ — it is round-tripped through the VERSIONS.txt ledger")
        ;;
    esac

    case "$SEEN" in
      *"|$KEY|"*) PROBLEMS+=("key '$KEY' appears more than once") ;;
    esac
    SEEN="$SEEN|$KEY|"

    local DOCKERFILE
    DOCKERFILE="$(service_dockerfile "$KEY")"
    if [ ! -f "$DOCKERFILE" ]; then
      PROBLEMS+=("$KEY names a Dockerfile that does not exist: $DOCKERFILE")
    fi

    local DEPLOYMENT
    DEPLOYMENT="$(service_deployment "$KEY")"
    if [ ! -f "$K8S_DIR/$DEPLOYMENT.yaml" ]; then
      PROBLEMS+=("$KEY names a Deployment with no manifest: $K8S_DIR/$DEPLOYMENT.yaml")
    else
      # The container name is what `kubectl set image` addresses. Getting it wrong
      # makes `set image` a no-op-shaped error rather than a rollout.
      if ! grep -qE "^[[:space:]]+- name: $(service_container "$KEY")\$" "$K8S_DIR/$DEPLOYMENT.yaml"; then
        PROBLEMS+=("$KEY names container '$(service_container "$KEY")', which $DEPLOYMENT.yaml does not define")
      fi
    fi

    local SOURCE
    for SOURCE in $(service_sources "$KEY"); do
      if [ ! -e "$SOURCE" ]; then
        PROBLEMS+=("$KEY lists a source path that does not exist: $SOURCE")
      fi
    done
  done

  # The direction that actually bit: a Deployment running a therrapp/ image with
  # no registry row is a service nothing in CI will ever deploy.
  local MANIFEST
  for MANIFEST in "$K8S_DIR"/*-deployment.yaml; do
    [ -f "$MANIFEST" ] || continue
    grep -qE '^[[:space:]]+image: therrapp/' "$MANIFEST" || continue

    local NAME
    NAME="$(basename "$MANIFEST" .yaml)"

    local MATCHED=false
    for KEY in $(service_keys); do
      if [ "$(service_deployment "$KEY")" = "$NAME" ]; then
        MATCHED=true
      fi
    done

    if [ "$MATCHED" = "false" ]; then
      PROBLEMS+=("$NAME runs a therrapp/ image but has no entry in THERR_SERVICES — it would never be built or deployed")
    fi
  done

  # Migration ownership is a subset of the registry, not its own list.
  local MIGRATABLE
  for MIGRATABLE in $THERR_MIGRATABLE_SERVICES; do
    if ! service_field "$MIGRATABLE" 1 >/dev/null 2>&1; then
      PROBLEMS+=("THERR_MIGRATABLE_SERVICES names '$MIGRATABLE', which is not a registry key")
    fi
  done

  if [ "${#PROBLEMS[@]}" -gt 0 ]; then
    echo "Invalid service registry in _bin/lib/service-registry.sh:" >&2
    local PROBLEM
    for PROBLEM in "${PROBLEMS[@]}"; do
      echo "  - $PROBLEM" >&2
    done
    return 1
  fi

  return 0
}

# Running this file directly checks the table without building or deploying.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  if assert_service_registry; then
    echo "Service registry is valid ($(service_keys | wc -l | tr -d ' ') services)."
    for KEY in $(service_keys); do
      printf '  %-28s -> therrapp/%s  [%s / %s]\n' \
        "$KEY" "$(service_image "$KEY")" "$(service_deployment "$KEY")" "$(service_container "$KEY")"
    done
  else
    exit 1
  fi
fi
