#!/bin/bash
# Shared helper functions for CI test scripts

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
