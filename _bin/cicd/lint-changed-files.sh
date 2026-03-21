#!/bin/bash
# Lint changed TypeScript/JavaScript files on feature branches.
# Groups changed files by package and runs eslint with the correct config.

set -e

source ./_bin/lib/colorize.sh

# Fetch general branch for comparison
git fetch origin general

# Get changed .ts and .js files (exclude node_modules, build artifacts, config files)
CHANGED_FILES=$(git diff --name-only origin/general -- '*.ts' '*.tsx' '*.js' '*.jsx' \
  | grep -v node_modules \
  | grep -v '/lib/' \
  | grep -v '/build/' \
  | grep -v '.eslintrc' \
  | grep -v 'jest.config' \
  | grep -v 'webpack' \
  || true)

if [ -z "$CHANGED_FILES" ]; then
  printMessageSuccess "No TypeScript/JavaScript source files changed. Skipping lint."
  exit 0
fi

FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l)
printMessageNeutral "Found ${FILE_COUNT} changed file(s) to lint"

# Define packages and their root directories
# Each package has its own .eslintrc.js
declare -a PACKAGES=(
  "therr-api-gateway"
  "therr-services/push-notifications-service"
  "therr-services/maps-service"
  "therr-services/messages-service"
  "therr-services/reactions-service"
  "therr-services/users-service"
  "therr-services/websocket-service"
  "therr-public-library/therr-js-utilities"
  "therr-public-library/therr-react"
  "therr-client-web"
  "therr-client-web-dashboard"
)

LINT_ERRORS=0

for PKG in "${PACKAGES[@]}"; do
  # Filter changed files belonging to this package
  PKG_FILES=$(echo "$CHANGED_FILES" | grep "^${PKG}/" || true)

  if [ -z "$PKG_FILES" ]; then
    continue
  fi

  PKG_FILE_COUNT=$(echo "$PKG_FILES" | wc -l)
  printMessageNeutral "=== Linting ${PKG_FILE_COUNT} file(s) in ${PKG} ==="

  # Run eslint inside the deps Docker container from the package directory
  # The base deps image has all source code and node_modules
  docker run --rm \
    therrapp/service-dependencies /bin/sh -c "cd ${PKG} && npx eslint $(echo $PKG_FILES | sed "s|${PKG}/||g")" || {
      printMessageError "Lint errors found in ${PKG}"
      LINT_ERRORS=$((LINT_ERRORS + 1))
    }
done

if [ $LINT_ERRORS -gt 0 ]; then
  printMessageError "Linting failed in ${LINT_ERRORS} package(s)"
  exit 1
fi

printMessageSuccess "All changed files passed linting"
