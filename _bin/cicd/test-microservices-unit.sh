#!/bin/bash
# Run unit tests for all microservices with changes
# This script runs tests that don't require database connectivity

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
  echo "Skipping unit tests - not on stage or main branch."
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
# Run Unit Tests for Each Service
# =============================================================================

printMessageNeutral "=========================================="
printMessageNeutral "Running Unit Tests for Microservices"
printMessageNeutral "=========================================="

# API Gateway
if should_test_service "therr-api-gateway"; then
  printMessageNeutral "=== API Gateway ==="
  run_unit_tests "api-gateway" "therrapp/api-gateway$SUFFIX:latest"
fi

# Push Notifications Service
if should_test_service "therr-services/push-notifications-service"; then
  printMessageNeutral "=== Push Notifications Service ==="
  run_unit_tests "push-notifications-service" "therrapp/push-notifications-service$SUFFIX:latest"
fi

# Maps Service
if should_test_service "therr-services/maps-service"; then
  printMessageNeutral "=== Maps Service ==="
  run_unit_tests "maps-service" "therrapp/maps-service$SUFFIX:latest"
fi

# Messages Service
if should_test_service "therr-services/messages-service"; then
  printMessageNeutral "=== Messages Service ==="
  run_unit_tests "messages-service" "therrapp/messages-service$SUFFIX:latest"
fi

# Reactions Service
if should_test_service "therr-services/reactions-service"; then
  printMessageNeutral "=== Reactions Service ==="
  run_unit_tests "reactions-service" "therrapp/reactions-service$SUFFIX:latest"
fi

# Users Service
if should_test_service "therr-services/users-service"; then
  printMessageNeutral "=== Users Service ==="
  run_unit_tests "users-service" "therrapp/users-service$SUFFIX:latest"
fi

# WebSocket Service
if should_test_service "therr-services/websocket-service"; then
  printMessageNeutral "=== WebSocket Service ==="
  run_unit_tests "websocket-service" "therrapp/websocket-service$SUFFIX:latest"
fi

printMessageSuccess "Unit tests complete for all services with changes"
