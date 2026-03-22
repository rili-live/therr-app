#!/bin/bash
# Run unit tests for services that changed relative to the general branch.
# Used on feature branches for fast validation before merging to general.
# This script runs tests that don't require database connectivity.

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh
source ./_bin/lib/test-helpers.sh

HAS_GLOBAL_CONFIG_FILE_CHANGES=false
HAS_ANY_LIBRARY_CHANGES=false
HAS_UTILITIES_LIBRARY_CHANGES=false

if has_diff_changes general "global-config.js"; then
  HAS_GLOBAL_CONFIG_FILE_CHANGES=true
fi

if has_diff_changes general "therr-public-library/therr-styles" || \
  has_diff_changes general "therr-public-library/therr-js-utilities" || \
  has_diff_changes general "therr-public-library/therr-react"; then
  HAS_ANY_LIBRARY_CHANGES=true
fi

if has_diff_changes general "therr-public-library/therr-js-utilities"; then
  HAS_UTILITIES_LIBRARY_CHANGES=true
fi

should_test_service()
{
  SERVICE_DIR=$1
  has_diff_changes general $SERVICE_DIR || "$HAS_UTILITIES_LIBRARY_CHANGES" = true || "$HAS_GLOBAL_CONFIG_FILE_CHANGES" = true
}

# =============================================================================
# Run Unit Tests for Each Service
# =============================================================================

printMessageNeutral "=========================================="
printMessageNeutral "Running Unit Tests for Changed Services"
printMessageNeutral "(comparing against general branch)"
printMessageNeutral "=========================================="

SERVICES_TESTED=0

# API Gateway
if should_test_service "therr-api-gateway"; then
  printMessageNeutral "=== API Gateway ==="
  run_unit_tests "api-gateway" "therrapp/api-gateway:latest"
  SERVICES_TESTED=$((SERVICES_TESTED + 1))
fi

# Push Notifications Service
if should_test_service "therr-services/push-notifications-service"; then
  printMessageNeutral "=== Push Notifications Service ==="
  run_unit_tests "push-notifications-service" "therrapp/push-notifications-service:latest"
  SERVICES_TESTED=$((SERVICES_TESTED + 1))
fi

# Maps Service
if should_test_service "therr-services/maps-service"; then
  printMessageNeutral "=== Maps Service ==="
  run_unit_tests "maps-service" "therrapp/maps-service:latest"
  SERVICES_TESTED=$((SERVICES_TESTED + 1))
fi

# Messages Service
if should_test_service "therr-services/messages-service"; then
  printMessageNeutral "=== Messages Service ==="
  run_unit_tests "messages-service" "therrapp/messages-service:latest"
  SERVICES_TESTED=$((SERVICES_TESTED + 1))
fi

# Reactions Service
if should_test_service "therr-services/reactions-service"; then
  printMessageNeutral "=== Reactions Service ==="
  run_unit_tests "reactions-service" "therrapp/reactions-service:latest"
  SERVICES_TESTED=$((SERVICES_TESTED + 1))
fi

# Users Service
if should_test_service "therr-services/users-service"; then
  printMessageNeutral "=== Users Service ==="
  run_unit_tests "users-service" "therrapp/users-service:latest"
  SERVICES_TESTED=$((SERVICES_TESTED + 1))
fi

# WebSocket Service
if should_test_service "therr-services/websocket-service"; then
  printMessageNeutral "=== WebSocket Service ==="
  run_unit_tests "websocket-service" "therrapp/websocket-service:latest"
  SERVICES_TESTED=$((SERVICES_TESTED + 1))
fi

if [ $SERVICES_TESTED -eq 0 ]; then
  printMessageNeutral "No service changes detected relative to general. Skipping unit tests."
else
  printMessageSuccess "Unit tests complete for ${SERVICES_TESTED} service(s) with changes"
fi
