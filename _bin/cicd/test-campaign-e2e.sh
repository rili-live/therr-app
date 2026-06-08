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

# Determine suffix for staging vs production-bound images (matches the
# pattern used by test-microservices-integration.sh).
[[ "$CURRENT_BRANCH" = "stage" ]] && SUFFIX="-stage" || SUFFIX=""

# Critical-path only for PR builds; full suite on stage/main.
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

GATEWAY_IMAGE="therrapp/api-gateway${SUFFIX}:latest"

# shellcheck disable=SC2046
docker run --rm \
  --network therr-ci-network \
  $(get_common_env_vars) \
  -e USERS_SERVICE_DATABASE=therr_dev_users \
  -e MAPS_SERVICE_DATABASE=therr_dev_maps \
  -e NODE_ENV=test \
  $GATEWAY_IMAGE /bin/sh -c "cd therr-api-gateway && $CMD" || {
    printMessageError "Campaign E2E suite failed"
    exit 1
  }

printMessageSuccess "Campaign E2E suite passed ($MODE mode)"
