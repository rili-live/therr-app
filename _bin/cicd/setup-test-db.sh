#!/bin/bash
# Setup test databases for CI integration testing
# This script starts the test infrastructure and runs migrations for all services

set -e

source ./_bin/lib/colorize.sh

printMessageSuccess "Starting CI test infrastructure..."

# Start PostgreSQL and Redis for testing
docker-compose -f docker-compose.ci.yml up -d

# Wait for PostgreSQL to be healthy
printMessageWarning "Waiting for PostgreSQL to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
until docker exec therr-postgres-ci pg_isready -U therr > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    printMessageError "PostgreSQL failed to start after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "Waiting for PostgreSQL... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done
printMessageSuccess "PostgreSQL is ready!"

# Wait for Redis to be healthy
printMessageWarning "Waiting for Redis to be ready..."
RETRY_COUNT=0
until docker exec therr-redis-ci redis-cli ping > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    printMessageError "Redis failed to start after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "Waiting for Redis... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done
printMessageSuccess "Redis is ready!"

# Wait for PostgreSQL healthcheck to pass
printMessageWarning "Waiting for PostgreSQL healthcheck to pass..."
RETRY_COUNT=0
MAX_HEALTH_RETRIES=30
until [ "$(docker inspect --format='{{.State.Health.Status}}' therr-postgres-ci 2>/dev/null)" = "healthy" ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' therr-postgres-ci 2>/dev/null || echo 'unknown')

  if [ $RETRY_COUNT -ge $MAX_HEALTH_RETRIES ]; then
    printMessageError "PostgreSQL healthcheck failed after $MAX_HEALTH_RETRIES attempts (status: $HEALTH_STATUS)"
    docker logs --tail 30 therr-postgres-ci 2>&1 || true
    exit 1
  fi

  echo "Waiting for healthcheck... (attempt $RETRY_COUNT/$MAX_HEALTH_RETRIES) - Status: $HEALTH_STATUS"
  sleep 2
done
printMessageSuccess "PostgreSQL healthcheck passed!"

# =============================================================================
# Initialize Databases
# =============================================================================
# Note: We create databases via docker exec instead of volume-mounted init scripts
# because CircleCI's remote Docker environment doesn't support volume mounts from
# the local filesystem to the remote Docker daemon.

printMessageWarning "Creating test databases..."

# Create databases individually (PostgreSQL doesn't support IF NOT EXISTS for CREATE DATABASE)
for db in therr_dev_users therr_dev_messages therr_dev_maps therr_dev_reactions; do
  echo "Creating database: $db"
  docker exec therr-postgres-ci psql -U therr -d therr -c "CREATE DATABASE $db;" 2>&1 || echo "Database $db may already exist, continuing..."
  docker exec therr-postgres-ci psql -U therr -d therr -c "GRANT ALL PRIVILEGES ON DATABASE $db TO therr;" 2>&1 || true
done

# Enable PostGIS extension on maps database
printMessageWarning "Enabling PostGIS extensions on maps database..."
docker exec therr-postgres-ci psql -U therr -d therr_dev_maps -c "CREATE EXTENSION IF NOT EXISTS postgis;" 2>&1 || true
docker exec therr-postgres-ci psql -U therr -d therr_dev_maps -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;" 2>&1 || true

# Verify databases were created
printMessageWarning "Verifying databases..."
docker exec therr-postgres-ci psql -U therr -d therr -c "\l" | grep therr_dev || {
  printMessageError "Failed to create test databases"
  exit 1
}
printMessageSuccess "Test databases created successfully!"

# Verify network connectivity from test containers
printMessageWarning "Verifying network connectivity..."
MAX_RETRIES=10
RETRY_COUNT=0
until docker run --rm --network therr-ci-network redis:7-alpine redis-cli -h redis-ci ping > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    printMessageError "Network connectivity to redis-ci failed"
    exit 1
  fi
  sleep 2
done

RETRY_COUNT=0
until docker run --rm --network therr-ci-network postgres:15-alpine pg_isready -h postgres-ci -p 5432 -U therr > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    printMessageError "Network connectivity to postgres-ci failed"
    exit 1
  fi
  sleep 2
done
printMessageSuccess "Network connectivity verified!"

printMessageSuccess "CI test infrastructure is ready!"
