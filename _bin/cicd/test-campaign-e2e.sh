#!/bin/bash
# Run campaign E2E tests against the shared test DB.
#
# This suite covers the 7 Treasure Hunt launch flows (referral, QR check-in,
# space incentive, event creation, moment proximity, achievement unlock,
# onboarding). It runs the api-gateway docker image with env vars pointing at
# both the users and maps databases so fixtures can seed across schemas.
#
# Unlike per-service integration tests, this suite runs once and exercises
# cross-service state (e.g. a user in therr_dev_users + a space in
# therr_dev_maps), which is where campaign-blocking bugs hide.
#
# Prereqs: setup-test-db.sh has been run (sets up postgres-ci + redis-ci +
# therr-ci-network). setup-test-db.sh CREATES the databases but does not migrate
# them, so this script applies both services' migrations itself — without that the
# suite connects successfully to an empty schema and every test fails on a missing
# relation.

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh
source ./_bin/lib/test-helpers.sh

CURRENT_BRANCH=${CICD_BRANCH:-$CIRCLE_BRANCH}
echo "Current branch is $CURRENT_BRANCH"

# Critical-path only for PR builds; full suite on stage/main. The workflow filter
# currently keeps this job off stage/main entirely, so the full branch only fires
# when the script is invoked by hand — keep it working rather than assuming.
MODE="${1:-critical}"
if [[ "$CURRENT_BRANCH" = "stage" ]] || [[ "$CURRENT_BRANCH" = "main" ]]; then
  MODE="full"
fi

if [[ "$MODE" = "full" ]]; then
  CMD="npm run test:e2e"
  printMessageNeutral "Running FULL campaign E2E suite (all 7 flows)"
else
  CMD="npm run test:e2e:critical"
  printMessageNeutral "Running CRITICAL-path campaign E2E (referral + qrCheckin + spaceIncentive)"
fi

# build-changed-services.sh tags every image unsuffixed on every branch, so these
# are the only tags that step ever produces.
GATEWAY_IMAGE="therrapp/api-gateway:latest"
USERS_IMAGE="therrapp/users-service:latest"
MAPS_IMAGE="therrapp/maps-service:latest"

# That step only builds a service when that service, therr-js-utilities or
# global-config.js changed, so on a PR touching only another package the image is
# absent here. Without this guard `docker run` silently PULLS whatever tag happens
# to be on DockerHub and the suite reports green against code that is not the code
# under review.
ensure_image()
{
  local IMAGE=$1
  local DOCKERFILE=$2
  local CONTEXT=$3

  if docker image inspect "$IMAGE" > /dev/null 2>&1; then
    return 0
  fi

  printMessageNeutral "No locally-built $IMAGE; building it so the suite runs against this commit"
  docker build -t "$IMAGE" -f "$DOCKERFILE" \
    --build-arg NODE_VERSION="${NODE_VERSION:-24.12.0}" "$CONTEXT"
}

ensure_image "$GATEWAY_IMAGE" ./therr-api-gateway/Dockerfile ./therr-api-gateway
ensure_image "$USERS_IMAGE" ./therr-services/users-service/Dockerfile ./therr-services/users-service
ensure_image "$MAPS_IMAGE" ./therr-services/maps-service/Dockerfile ./therr-services/maps-service

# Migrate both databases. The suite reads main.users out of therr_dev_users and
# main.spaces / moments / events / spaceIncentives out of therr_dev_maps, and
# setup-test-db.sh leaves both empty — `SELECT 1` still succeeds against an empty
# database, so nothing upstream of here notices.
run_migrations "USERS_SERVICE" "therr_dev_users" "$USERS_IMAGE"
run_migrations "MAPS_SERVICE" "therr_dev_maps" "$MAPS_IMAGE"

# No `cd` before the command: the image's final WORKDIR is already
# /app/therr-api-gateway (see therr-api-gateway/Dockerfile), so `cd therr-api-gateway`
# resolves to a path that does not exist and `&&` swallows the test run entirely.
# This matches how run_integration_tests in _bin/lib/test-helpers.sh invokes a service image.
# shellcheck disable=SC2046
docker run --rm \
  --network therr-ci-network \
  $(get_common_env_vars) \
  -e USERS_SERVICE_DATABASE=therr_dev_users \
  -e MAPS_SERVICE_DATABASE=therr_dev_maps \
  -e NODE_ENV=test \
  -e CI=true \
  $GATEWAY_IMAGE /bin/sh -c "$CMD" || {
    printMessageError "Campaign E2E suite failed"
    exit 1
  }

printMessageSuccess "Campaign E2E suite passed ($MODE mode)"
