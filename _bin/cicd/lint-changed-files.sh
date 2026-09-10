#!/bin/bash
# Lint changed TypeScript/JavaScript files on feature branches.
# Groups changed files by package and runs eslint with the correct config.
# Runs directly on the host (Node.js executor), not inside Docker.

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh

# Locale dictionary parity check — zero-dep Node script, runs before `npm ci`
# so it fails fast on translation drift without waiting for dependency install.
printMessageNeutral "=== Locale dictionary parity check ==="
node scripts/locale-check/index.js

# Mirrored-file drift check — same rationale as above: zero-dep Node script, runs before
# `npm ci`. Catches a fix applied to only one copy of a deliberately duplicated module.
printMessageNeutral "=== Mirrored file drift check ==="
node scripts/mirrored-files/index.js

# Diff against the next branch down the promotion chain (see resolve_diff_base).
# On a feature branch that is `general`; on `general` it is `stage`; on `stage`, `main`.
DIFF_BASE=$(resolve_diff_base)
printMessageNeutral "Comparing against origin/${DIFF_BASE}"
git fetch origin "$DIFF_BASE"

# Get changed .ts and .js source files relative to the diff base
# --diff-filter=d excludes deleted files (which don't exist in the working tree)
# Exclude build artifacts, config files, and non-source directories
# NOTE: the compiled-library exclusion is scoped to therr-public-library on purpose.
# A bare `grep -v '/lib/'` also swallowed `_bin/lib/**`, which holds the deploy
# pipeline's decision logic and its tests — so those files were never linted here even
# once `_bin` had a config. The two library `lib/` trees are gitignored anyway, so they
# cannot appear in a `git diff --name-only` in the first place; this stays only as a
# guard against a build artifact that is ever committed by accident.
CHANGED_FILES=$(git diff --name-only --diff-filter=d "origin/${DIFF_BASE}" -- '*.ts' '*.tsx' '*.js' '*.jsx' \
  | grep -v node_modules \
  | grep -v 'therr-public-library/[^/]*/lib/' \
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

# Unit tests for eslint-plugin-therr. These rules are the repo's architectural invariants
# (brand-scoped table access, Knex builder footguns, migration idempotency) and nothing else
# exercises them — a rule that silently stops matching keeps passing every lint run it is
# part of. Runs here rather than in its own job because it needs the root install and
# nothing else, so it is effectively free at this point in the script.
printMessageNeutral "=== ESLint custom rule tests ==="
npm run test:lint-rules
printMessageSuccess "Custom rule tests passed"

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
  # The CI/CD helper scripts and their tests. `_bin/.eslintrc.js` (root: true) exists
  # so these are lintable at all — before it, eslint aborted on them with "couldn't
  # find a configuration file".
  "_bin"
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

  # TherrMobile keeps its React Native toolchain in an isolated package.json that the
  # root `npm ci` above does not install. Its .eslintrc.js does `extends: ['@react-native']`,
  # which resolves @react-native/eslint-config from TherrMobile/node_modules — so without
  # this install eslint fails with "couldn't find the config @react-native to extend from".
  # Install (deps only; --ignore-scripts skips native postinstall) before linting it.
  # Other packages resolve their eslint config/plugins from the hoisted root install.
  if [ "${PKG}" = "TherrMobile" ]; then
    printMessageNeutral "Installing TherrMobile isolated dependencies for linting..."
    (cd TherrMobile && npm ci --legacy-peer-deps --ignore-scripts)
    printMessageSuccess "TherrMobile dependencies installed"
  fi

  # Convert package-relative paths for eslint (strip package prefix)
  # Use newline-safe conversion to space-separated args
  ESLINT_ARGS=$(echo "$PKG_FILES" | sed "s|^${PKG}/||")

  # Run eslint from the package directory so .eslintrc.js resolves correctly.
  # For most packages node_modules are in the repo root (hoisted) and eslint plugins
  # resolve from there; TherrMobile additionally uses its own install (see above).
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
