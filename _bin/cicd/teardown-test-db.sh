#!/bin/bash
# Teardown test databases after CI integration testing

set -e

source ./_bin/lib/colorize.sh

printMessageWarning "Tearing down CI test infrastructure..."

docker-compose -f docker-compose.ci.yml down -v --remove-orphans 2>/dev/null || true

printMessageSuccess "CI test infrastructure has been torn down"
