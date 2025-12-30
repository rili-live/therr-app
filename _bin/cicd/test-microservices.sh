#!/bin/bash
# Run all microservice tests (unit + integration)
# This script is kept for backward compatibility.
# In CI, prefer using the separate scripts for clearer output:
#   - test-microservices-unit.sh (no database required)
#   - test-microservices-integration.sh (requires database)

set -e

source ./_bin/lib/colorize.sh

printMessageNeutral "Running all microservice tests..."

# Run unit tests first
./_bin/cicd/test-microservices-unit.sh

# Run integration tests
./_bin/cicd/test-microservices-integration.sh

printMessageSuccess "All microservice tests complete"
