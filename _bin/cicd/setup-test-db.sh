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

# Verify DNS resolution is working from a test container
printMessageWarning "Verifying network DNS resolution..."
MAX_DNS_RETRIES=10
DNS_RETRY_COUNT=0
until docker run --rm --network therr-ci-network alpine:3.18 nslookup postgres-ci > /dev/null 2>&1; do
  DNS_RETRY_COUNT=$((DNS_RETRY_COUNT + 1))
  if [ $DNS_RETRY_COUNT -ge $MAX_DNS_RETRIES ]; then
    printMessageError "DNS resolution for postgres-ci failed after $MAX_DNS_RETRIES attempts"
    exit 1
  fi
  echo "Waiting for DNS resolution... (attempt $DNS_RETRY_COUNT/$MAX_DNS_RETRIES)"
  sleep 2
done
printMessageSuccess "DNS resolution verified!"

printMessageSuccess "CI test infrastructure is ready!"
