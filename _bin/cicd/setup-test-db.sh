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
# Note: The container has a 30s start_period before healthcheck failures count
printMessageWarning "Waiting for PostgreSQL healthcheck to pass..."
RETRY_COUNT=0
MAX_HEALTH_RETRIES=60

# Show initial container logs to help diagnose startup issues
echo "=== Initial Postgres Container Logs ==="
docker logs therr-postgres-ci 2>&1 | tail -30 || echo "Could not retrieve logs"
echo ""

until [ "$(docker inspect --format='{{.State.Health.Status}}' therr-postgres-ci 2>/dev/null)" = "healthy" ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' therr-postgres-ci 2>/dev/null || echo 'unknown')

  if [ $RETRY_COUNT -ge $MAX_HEALTH_RETRIES ]; then
    printMessageError "PostgreSQL healthcheck failed after $MAX_HEALTH_RETRIES attempts"
    echo ""
    echo "=== HEALTHCHECK FAILURE DIAGNOSTICS ==="
    echo "Container health status: $HEALTH_STATUS"
    echo ""
    echo "--- Last 5 health check results ---"
    docker inspect --format='{{range $i, $h := .State.Health.Log}}Check {{$i}}: ExitCode={{$h.ExitCode}} Output={{$h.Output}}{{end}}' therr-postgres-ci 2>/dev/null || echo "No health logs available"
    echo ""
    echo "--- Full Postgres Container Logs ---"
    docker logs therr-postgres-ci 2>&1 || echo "Could not retrieve logs"
    echo ""
    echo "--- Container State ---"
    docker inspect --format='Running={{.State.Running}} ExitCode={{.State.ExitCode}} Error={{.State.Error}}' therr-postgres-ci 2>/dev/null || echo "Could not inspect state"
    echo ""
    echo "--- Manual pg_isready test from host ---"
    docker exec therr-postgres-ci pg_isready -h 127.0.0.1 -p 5432 -U therr 2>&1 || echo "pg_isready failed"
    exit 1
  fi

  # Every 10 attempts, show more detailed info
  if [ $((RETRY_COUNT % 10)) -eq 0 ]; then
    echo ""
    echo "--- Health check log at attempt $RETRY_COUNT ---"
    docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' therr-postgres-ci 2>/dev/null | tail -3 || true
    echo "--- Recent container logs ---"
    docker logs --tail 5 therr-postgres-ci 2>&1 || true
    echo ""
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
# Ignore errors if database already exists
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

# Give PostgreSQL a moment to stabilize
sleep 2

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

# Now test Postgres connectivity from a test container (simulates how tests will connect)
printMessageWarning "Verifying network connectivity to postgres-ci..."
RETRY_COUNT=0

# Get the container's IP address as a fallback for DNS issues
POSTGRES_IP=$(docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' therr-postgres-ci 2>/dev/null || echo "")
echo "Postgres container IP: ${POSTGRES_IP:-unknown}"

until docker run --rm --network therr-ci-network postgres:15-alpine pg_isready -h postgres-ci -p 5432 -U therr 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))

  # On failure, also try direct IP connection for diagnosis
  if [ -n "$POSTGRES_IP" ]; then
    echo "Trying direct IP connection to $POSTGRES_IP..."
    if docker run --rm --network therr-ci-network postgres:15-alpine pg_isready -h "$POSTGRES_IP" -p 5432 -U therr 2>&1; then
      echo "Direct IP connection succeeded! This indicates a DNS resolution issue."
      echo "Continuing with IP-based connection..."
      break
    fi
  fi

  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    printMessageError "Network connectivity to postgres-ci failed after $MAX_RETRIES attempts"
    echo ""
    echo "=== FAILURE DIAGNOSTICS ==="
    echo "--- Container Status ---"
    docker ps -a --filter "name=therr-postgres-ci"
    echo ""
    echo "--- Postgres Container Logs ---"
    docker logs --tail 50 therr-postgres-ci 2>&1 || echo "Could not retrieve logs"
    echo ""
    echo "--- Network Inspection ---"
    docker network inspect therr-ci-network 2>&1 || echo "Could not inspect network"
    exit 1
  fi

  echo "Waiting for postgres-ci connectivity... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done
printMessageSuccess "Postgres network connectivity verified!"

printMessageSuccess "CI test infrastructure is ready!"
