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

# Wait for PostgreSQL healthcheck to pass (ensures init scripts have completed)
printMessageWarning "Waiting for PostgreSQL healthcheck to pass..."
RETRY_COUNT=0
MAX_HEALTH_RETRIES=30
until [ "$(docker inspect --format='{{.State.Health.Status}}' therr-postgres-ci 2>/dev/null)" = "healthy" ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_HEALTH_RETRIES ]; then
    printMessageError "PostgreSQL healthcheck failed after $MAX_HEALTH_RETRIES attempts"
    echo "Container health status: $(docker inspect --format='{{.State.Health.Status}}' therr-postgres-ci 2>/dev/null || echo 'unknown')"
    echo "Last health check log:"
    docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' therr-postgres-ci 2>/dev/null || echo "No health logs available"
    exit 1
  fi
  echo "Waiting for healthcheck... (attempt $RETRY_COUNT/$MAX_HEALTH_RETRIES) - Status: $(docker inspect --format='{{.State.Health.Status}}' therr-postgres-ci 2>/dev/null || echo 'checking')"
  sleep 2
done
printMessageSuccess "PostgreSQL healthcheck passed!"

# Give PostgreSQL a moment to complete initialization after healthcheck
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

# Debug: Show postgres container status
echo "=== Postgres Container Status ==="
docker ps -a --filter "name=therr-postgres-ci" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Debug: Show container health status
echo "=== Container Health Check ==="
docker inspect --format='{{.State.Health.Status}}' therr-postgres-ci 2>/dev/null || echo "Health status not available"
echo ""

# Debug: Show postgres logs (last 20 lines)
echo "=== Postgres Container Logs (last 20 lines) ==="
docker logs --tail 20 therr-postgres-ci 2>&1 || echo "Could not retrieve logs"
echo ""

# Debug: Test DNS resolution within the network
echo "=== Testing DNS Resolution for postgres-ci ==="
docker run --rm --network therr-ci-network postgres:15-alpine sh -c "getent hosts postgres-ci" 2>&1 || echo "DNS resolution failed"
echo ""

# Debug: Test raw TCP connectivity to port 5432 using nc (netcat)
echo "=== Testing TCP Connectivity to postgres-ci:5432 ==="
docker run --rm --network therr-ci-network alpine:3.18 sh -c "apk add --no-cache netcat-openbsd >/dev/null 2>&1 && nc -zv postgres-ci 5432 2>&1" || echo "TCP test failed or container issue"
echo ""

# Get the container's IP address as a fallback for DNS issues
POSTGRES_IP=$(docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' therr-postgres-ci 2>/dev/null || echo "")
echo "Postgres container IP: ${POSTGRES_IP:-unknown}"

# Try connectivity using hostname first, fall back to IP if needed
until docker run --rm --network therr-ci-network postgres:15-alpine pg_isready -h postgres-ci -p 5432 -U therr 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))

  # On failure, also try direct IP connection for diagnosis
  if [ -n "$POSTGRES_IP" ]; then
    echo "Trying direct IP connection to $POSTGRES_IP..."
    if docker run --rm --network therr-ci-network postgres:15-alpine pg_isready -h "$POSTGRES_IP" -p 5432 -U therr 2>&1; then
      echo "Direct IP connection succeeded! This indicates a DNS resolution issue."
      echo "Continuing with IP-based connection..."
      # Use IP for remaining operations
      export POSTGRES_CI_HOST="$POSTGRES_IP"
      break
    fi
  fi

  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    printMessageError "Network connectivity to postgres-ci failed after $MAX_RETRIES attempts - Redis worked, so this is Postgres-specific"

    # Final diagnostic dump on failure
    echo ""
    echo "=== FAILURE DIAGNOSTICS ==="
    echo "--- Full Postgres Logs ---"
    docker logs therr-postgres-ci 2>&1 || echo "Could not retrieve logs"
    echo ""
    echo "--- Network Inspection ---"
    docker network inspect therr-ci-network 2>&1 || echo "Could not inspect network"
    echo ""
    echo "--- All Container Status ---"
    docker ps -a
    echo ""
    echo "--- Attempting psql connection for detailed error ---"
    docker run --rm --network therr-ci-network postgres:15-alpine psql -h postgres-ci -p 5432 -U therr -d therr -c "SELECT 1" 2>&1 || true
    exit 1
  fi
  echo "Waiting for postgres-ci connectivity... (attempt $RETRY_COUNT/$MAX_RETRIES)"

  # Show pg_isready output on each retry for debugging
  echo "pg_isready output:"
  docker run --rm --network therr-ci-network postgres:15-alpine pg_isready -h postgres-ci -p 5432 -U therr 2>&1 || true
  echo ""

  sleep 2
done
printMessageSuccess "Postgres network connectivity verified!"

printMessageSuccess "CI test infrastructure is ready!"
