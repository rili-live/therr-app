#!/bin/bash
# Lint changed TypeScript/JavaScript files on feature branches.
# Groups changed files by package and runs eslint with the correct config.
# Runs directly on the host (Node.js executor), not inside Docker.

set -e

source ./_bin/lib/colorize.sh

# Locale dictionary parity check — zero-dep Node script, runs before `npm ci`
# so it fails fast on translation drift without waiting for dependency install.
printMessageNeutral "=== Locale dictionary parity check ==="
node scripts/locale-check/index.js

# Fetch general branch for comparison
git fetch origin general

# Get changed .ts and .js source files relative to general
# --diff-filter=d excludes deleted files (which don't exist in the working tree)
# Exclude build artifacts, config files, and non-source directories
CHANGED_FILES=$(git diff --name-only --diff-filter=d origin/general -- '*.ts' '*.tsx' '*.js' '*.jsx' \
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

FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')
printMessageNeutral "Found ${FILE_COUNT} changed file(s) to lint"

# Install dependencies (eslint and plugins are in root package.json devDependencies)
printMessageNeutral "Installing dependencies for linting..."
npm ci --legacy-peer-deps --ignore-scripts
printMessageSuccess "Dependencies installed"

# Build shared libraries so eslint can resolve therr-react/* and therr-js-utilities/* imports
# (lib/ directories are gitignored and must be built before linting consumers)
printMessageNeutral "Building shared libraries for import resolution..."
(cd therr-public-library/therr-js-utilities && npm run build) || {
  printMessageError "Failed to build therr-js-utilities"
  exit 1
}
(cd therr-public-library/therr-react && npm run build) || {
  printMessageError "Failed to build therr-react"
  exit 1
}
printMessageSuccess "Shared libraries built"

# Define packages and their root directories
# Each package has its own .eslintrc.js
# NOTE: therr-client-web-dashboard is excluded because its local lint script
# is a no-op (linting not yet configured for that package).
# TherrMobile is included to match the local lint:changed behavior.
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
  "TherrMobile"
)

LINT_ERRORS=0

for PKG in "${PACKAGES[@]}"; do
  # Filter changed files belonging to this package
  PKG_FILES=$(echo "$CHANGED_FILES" | grep "^${PKG}/" || true)

  if [ -z "$PKG_FILES" ]; then
    continue
  fi

  PKG_FILE_COUNT=$(echo "$PKG_FILES" | wc -l | tr -d ' ')
  printMessageNeutral "=== Linting ${PKG_FILE_COUNT} file(s) in ${PKG} ==="

  # Convert package-relative paths for eslint (strip package prefix)
  # Use newline-safe conversion to space-separated args
  ESLINT_ARGS=$(echo "$PKG_FILES" | sed "s|^${PKG}/||")

  # Run eslint from the package directory so .eslintrc.js resolves correctly
  # node_modules are in the repo root (hoisted), eslint plugins resolve from there
  (cd "${PKG}" && npx eslint $ESLINT_ARGS) || {
    printMessageError "Lint errors found in ${PKG}"
    LINT_ERRORS=$((LINT_ERRORS + 1))
  }
done

if [ $LINT_ERRORS -gt 0 ]; then
  printMessageError "Linting failed in ${LINT_ERRORS} package(s)"
  exit 1
fi

printMessageSuccess "All changed files passed linting"
