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
# therr-ci-network), and both users-service + maps-service migrations have
# been applied to their respective DBs.

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

# build-changed-services.sh tags the gateway unsuffixed on every branch, so this
# is the only tag that step ever produces.
GATEWAY_IMAGE="therrapp/api-gateway:latest"

# That step only builds the gateway when therr-api-gateway, therr-js-utilities or
# global-config.js changed, so on a PR touching only another package the image is
# absent here. Without this guard `docker run` silently PULLS whatever
# therrapp/api-gateway:latest happens to be on DockerHub and the suite reports
# green against code that is not the code under review.
if ! docker image inspect "$GATEWAY_IMAGE" > /dev/null 2>&1; then
  printMessageNeutral "No locally-built $GATEWAY_IMAGE; building it so the suite runs against this commit"
  docker build -t "$GATEWAY_IMAGE" -f ./therr-api-gateway/Dockerfile \
    --build-arg NODE_VERSION="${NODE_VERSION:-24.12.0}" ./therr-api-gateway
fi

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
