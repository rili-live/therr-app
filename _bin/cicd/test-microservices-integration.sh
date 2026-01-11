#!/bin/bash
# Run integration tests for all microservices with changes
# This script requires database connectivity via Docker network

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh
source ./_bin/lib/test-helpers.sh

CURRENT_BRANCH=${CICD_BRANCH:-$CIRCLE_BRANCH}
echo "Current branch is $CURRENT_BRANCH"

DESTINATION_BRANCH="main"
echo "Destination branch is $DESTINATION_BRANCH"

# Only run tests when the source branch is stage or main
if [[ ("$CURRENT_BRANCH" != "stage") && ("$CURRENT_BRANCH" != "main") ]]; then
  echo "Skipping integration tests - not on stage or main branch."
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
should_test_service()
{
  SERVICE_DIR=$1
  has_prev_diff_changes $SERVICE_DIR || "$HAS_ANY_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

# =============================================================================
# Test Infrastructure Setup
# =============================================================================
printMessageSuccess "Setting up test infrastructure..."
./_bin/cicd/setup-test-db.sh

# Ensure cleanup on exit
cleanup() {
  printMessageWarning "Cleaning up test infrastructure..."
  ./_bin/cicd/teardown-test-db.sh
}
trap cleanup EXIT

# =============================================================================
# Run Integration Tests for Each Service
# =============================================================================

printMessageNeutral "=========================================="
printMessageNeutral "Running Integration Tests for Microservices"
printMessageNeutral "=========================================="

# Maps Service (uses therr_dev_maps database with PostGIS)
if should_test_service "therr-services/maps-service"; then
  printMessageNeutral "=== Maps Service ==="
  run_migrations "MAPS_SERVICE" "therr_dev_maps" "therrapp/maps-service$SUFFIX:latest"
  run_integration_tests "maps-service" "therrapp/maps-service$SUFFIX:latest" "therr_dev_maps" "MAPS_SERVICE_DATABASE"
fi

# Messages Service (uses therr_dev_messages database)
if should_test_service "therr-services/messages-service"; then
  printMessageNeutral "=== Messages Service ==="
  run_migrations "MESSAGES_SERVICE" "therr_dev_messages" "therrapp/messages-service$SUFFIX:latest"
  run_integration_tests "messages-service" "therrapp/messages-service$SUFFIX:latest" "therr_dev_messages" "MESSAGES_SERVICE_DATABASE"
fi

# Reactions Service (uses therr_dev_reactions database)
if should_test_service "therr-services/reactions-service"; then
  printMessageNeutral "=== Reactions Service ==="
  run_migrations "REACTIONS_SERVICE" "therr_dev_reactions" "therrapp/reactions-service$SUFFIX:latest"
  run_integration_tests "reactions-service" "therrapp/reactions-service$SUFFIX:latest" "therr_dev_reactions" "REACTIONS_SERVICE_DATABASE"
fi

# Users Service (uses therr_dev_users database)
if should_test_service "therr-services/users-service"; then
  printMessageNeutral "=== Users Service ==="
  run_migrations "USERS_SERVICE" "therr_dev_users" "therrapp/users-service$SUFFIX:latest"
  run_integration_tests "users-service" "therrapp/users-service$SUFFIX:latest" "therr_dev_users" "USERS_SERVICE_DATABASE"
fi

printMessageSuccess "Integration tests complete for all services with changes"
