#!/bin/bash

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh

CURRENT_BRANCH=${CICD_BRANCH:-$CIRCLE_BRANCH}
echo "Current branch is $CURRENT_BRANCH"

DESTINATION_BRANCH="main"
echo "Destination branch is $DESTINATION_BRANCH"

# Only build the docker images when the source branch is stage or main
if [[ ("$CURRENT_BRANCH" != "stage") && ("$CURRENT_BRANCH" != "main") ]]; then
  echo "Skipping post build stage."
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
# Start PostgreSQL and Redis for integration tests
printMessageSuccess "Setting up test infrastructure..."
./_bin/cicd/setup-test-db.sh

# Ensure cleanup on exit
cleanup() {
  printMessageWarning "Cleaning up test infrastructure..."
  ./_bin/cicd/teardown-test-db.sh
}
trap cleanup EXIT

# =============================================================================
# Service Test Configuration
# =============================================================================
# Database environment variables for CI
CI_DB_HOST="postgres-ci"
CI_DB_PORT="5432"
CI_DB_USER="therr"
CI_DB_PASSWORD="testpassword"
CI_REDIS_HOST="redis-ci"
CI_REDIS_PORT="6379"

# Common environment variables for all services
get_common_env_vars() {
  echo "-e DB_HOST_MAIN_READ=$CI_DB_HOST \
    -e DB_HOST_MAIN_WRITE=$CI_DB_HOST \
    -e DB_PORT_MAIN_READ=$CI_DB_PORT \
    -e DB_PORT_MAIN_WRITE=$CI_DB_PORT \
    -e DB_USER_MAIN_READ=$CI_DB_USER \
    -e DB_USER_MAIN_WRITE=$CI_DB_USER \
    -e DB_PASSWORD_MAIN_READ=$CI_DB_PASSWORD \
    -e DB_PASSWORD_MAIN_WRITE=$CI_DB_PASSWORD \
    -e REDIS_GENERIC_HOST=$CI_REDIS_HOST \
    -e REDIS_GENERIC_PORT=$CI_REDIS_PORT \
    -e REDIS_PUB_HOST=$CI_REDIS_HOST \
    -e REDIS_PUB_PORT=$CI_REDIS_PORT \
    -e REDIS_EPHEMERAL_HOST=$CI_REDIS_HOST \
    -e REDIS_EPHEMERAL_PORT=$CI_REDIS_PORT"
}

# Run migrations for a specific service
run_migrations() {
  local SERVICE_NAME=$1
  local DB_NAME=$2
  local IMAGE_NAME=$3

  printMessageWarning "Running migrations for $SERVICE_NAME (database: $DB_NAME)..."

  docker run --rm \
    --network therr-ci-network \
    -e DB_HOST_MAIN_WRITE=$CI_DB_HOST \
    -e DB_PORT_MAIN_WRITE=$CI_DB_PORT \
    -e DB_USER_MAIN_WRITE=$CI_DB_USER \
    -e DB_PASSWORD_MAIN_WRITE=$CI_DB_PASSWORD \
    -e ${SERVICE_NAME}_DATABASE=$DB_NAME \
    $IMAGE_NAME /bin/sh -c "npm run migrations:run" || {
      printMessageError "Migration failed for $SERVICE_NAME"
      return 1
    }

  printMessageSuccess "Migrations complete for $SERVICE_NAME"
}

# Run unit tests for a service (no database required)
run_unit_tests() {
  local SERVICE_NAME=$1
  local IMAGE_NAME=$2

  printMessageWarning "Running unit tests for $SERVICE_NAME..."

  docker run --rm \
    --network therr-ci-network \
    $(get_common_env_vars) \
    $IMAGE_NAME /bin/sh -c 'npm run test:unit' || {
      printMessageError "Unit tests failed for $SERVICE_NAME"
      return 1
    }

  printMessageSuccess "Unit tests passed for $SERVICE_NAME"
}

# Run integration tests for a service (requires database)
run_integration_tests() {
  local SERVICE_NAME=$1
  local IMAGE_NAME=$2
  local DB_NAME=$3
  local SERVICE_ENV_VAR=$4

  printMessageWarning "Running integration tests for $SERVICE_NAME..."

  # shellcheck disable=SC2046
  docker run --rm \
    --network therr-ci-network \
    $(get_common_env_vars) \
    -e ${SERVICE_ENV_VAR}=$DB_NAME \
    $IMAGE_NAME /bin/sh -c 'npm run test:integration' || {
      printMessageError "Integration tests failed for $SERVICE_NAME"
      return 1
    }

  printMessageSuccess "Integration tests passed for $SERVICE_NAME"
}

# =============================================================================
# Run Tests for Each Service
# =============================================================================

# API Gateway (no database, but may need Redis)
if should_test_service "therr-api-gateway"; then
  printMessageNeutral "=== Testing API Gateway ==="
  run_unit_tests "api-gateway" "therrapp/api-gateway$SUFFIX:latest"
fi

# Push Notifications Service (no database)
if should_test_service "therr-services/push-notifications-service"; then
  printMessageNeutral "=== Testing Push Notifications Service ==="
  run_unit_tests "push-notifications-service" "therrapp/push-notifications-service$SUFFIX:latest"
fi

# Maps Service (uses therr_dev_maps database with PostGIS)
if should_test_service "therr-services/maps-service"; then
  printMessageNeutral "=== Testing Maps Service ==="
  run_unit_tests "maps-service" "therrapp/maps-service$SUFFIX:latest"
  run_migrations "MAPS_SERVICE" "therr_dev_maps" "therrapp/maps-service$SUFFIX:latest"
  run_integration_tests "maps-service" "therrapp/maps-service$SUFFIX:latest" "therr_dev_maps" "MAPS_SERVICE_DATABASE"
fi

# Messages Service (uses therr_dev_messages database)
if should_test_service "therr-services/messages-service"; then
  printMessageNeutral "=== Testing Messages Service ==="
  run_unit_tests "messages-service" "therrapp/messages-service$SUFFIX:latest"
  run_migrations "MESSAGES_SERVICE" "therr_dev_messages" "therrapp/messages-service$SUFFIX:latest"
  run_integration_tests "messages-service" "therrapp/messages-service$SUFFIX:latest" "therr_dev_messages" "MESSAGES_SERVICE_DATABASE"
fi

# Reactions Service (uses therr_dev_reactions database)
if should_test_service "therr-services/reactions-service"; then
  printMessageNeutral "=== Testing Reactions Service ==="
  run_unit_tests "reactions-service" "therrapp/reactions-service$SUFFIX:latest"
  run_migrations "REACTIONS_SERVICE" "therr_dev_reactions" "therrapp/reactions-service$SUFFIX:latest"
  run_integration_tests "reactions-service" "therrapp/reactions-service$SUFFIX:latest" "therr_dev_reactions" "REACTIONS_SERVICE_DATABASE"
fi

# Users Service (uses therr_dev_users database)
if should_test_service "therr-services/users-service"; then
  printMessageNeutral "=== Testing Users Service ==="
  run_unit_tests "users-service" "therrapp/users-service$SUFFIX:latest"
  run_migrations "USERS_SERVICE" "therr_dev_users" "therrapp/users-service$SUFFIX:latest"
  run_integration_tests "users-service" "therrapp/users-service$SUFFIX:latest" "therr_dev_users" "USERS_SERVICE_DATABASE"
fi

# WebSocket Service (no database, but may need Redis)
if should_test_service "therr-services/websocket-service"; then
  printMessageNeutral "=== Testing WebSocket Service ==="
  run_unit_tests "websocket-service" "therrapp/websocket-service$SUFFIX:latest"
fi

printMessageSuccess "Testing complete for all services with changes"
