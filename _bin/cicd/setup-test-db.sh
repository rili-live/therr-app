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

# Give PostgreSQL a moment to complete initialization
sleep 3

# Verify network connectivity from test containers (confirms DNS + TCP)
# Test Redis first - if this fails, it's a network/DNS issue, not Postgres-specific
printMessageWarning "Verifying network connectivity to redis-ci..."
MAX_RETRIES=10
RETRY_COUNT=0
until docker run --rm --network therr-ci-network redis:7-alpine redis-cli -h redis-ci ping > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    printMessageError "Network connectivity to redis-ci failed after $MAX_RETRIES attempts - this indicates a Docker network/DNS issue"
    exit 1
  fi
  echo "Waiting for redis-ci connectivity... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done
printMessageSuccess "Redis network connectivity verified!"

# Now test Postgres connectivity
printMessageWarning "Verifying network connectivity to postgres-ci..."
RETRY_COUNT=0
until docker run --rm --network therr-ci-network postgres:15-alpine pg_isready -h postgres-ci -U therr > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    printMessageError "Network connectivity to postgres-ci failed after $MAX_RETRIES attempts - Redis worked, so this is Postgres-specific"
    exit 1
  fi
  echo "Waiting for postgres-ci connectivity... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done
printMessageSuccess "Postgres network connectivity verified!"

printMessageSuccess "CI test infrastructure is ready!"
