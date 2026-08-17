#!/bin/bash
# Type-check every package. Runs directly on the host (Node.js executor), not inside Docker.
#
# Why all packages rather than only changed ones: type errors propagate across package
# boundaries. Editing a return type in therr-js-utilities can break therr-client-web
# without touching a single file under therr-client-web/, so a changed-files filter
# would miss exactly the breakages that matter most in a monorepo.
#
# TherrMobile is handled separately through the baseline script — it carries pre-existing
# errors from the RN 0.83 upgrade, so it gates on "no NEW errors" rather than "zero errors".
# See _bin/check-mobile-tsc-baseline.sh.

set -e

source ./_bin/lib/colorize.sh

printMessageNeutral "Installing dependencies for type-checking..."
npm ci --legacy-peer-deps --ignore-scripts
printMessageSuccess "Dependencies installed"

# Custom ESLint rule tests live here rather than in their own job purely to reuse this
# install — they need only `eslint` and a few seconds. They belong in CI at all because
# the rules encode architectural invariants (brand-scoped table access, Knex migration
# safety) and were previously untested: a typo in a table name produced a rule that
# matched nothing and failed open, with lint still reporting success.
printMessageNeutral "=== Verifying custom ESLint rules ==="
npm run test:lint-rules
printMessageSuccess "Custom ESLint rules verified"

# Same reasoning, same reused install: these cover decision logic inside _bin gate scripts.
# A bug in a gate's own filtering is silent in the direction that matters — it stops failing
# on real problems while still printing success — so the logic is tested rather than trusted.
printMessageNeutral "=== Verifying _bin script logic ==="
npm run test:bin-scripts
printMessageSuccess "_bin script logic verified"

# Consumers import from the compiled lib/ output, which is gitignored. Without this the
# type-check fails on unresolved therr-react/* and therr-js-utilities/* imports rather
# than on anything real.
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

# Matches the pr:typecheck:* scripts in root package.json — keep the two lists in sync.
declare -a TARGETS=(
  "gateway"
  "users"
  "maps"
  "messages"
  "reactions"
  "push"
  "websocket"
  "js-utils"
  "therr-react"
  "web"
  "dashboard"
)

TYPECHECK_FAILURES=0
FAILED_TARGETS=""

for TARGET in "${TARGETS[@]}"; do
  printMessageNeutral "=== Type-checking ${TARGET} ==="
  if npm run "pr:typecheck:${TARGET}"; then
    printMessageSuccess "${TARGET} clean"
  else
    printMessageError "Type errors in ${TARGET}"
    TYPECHECK_FAILURES=$((TYPECHECK_FAILURES + 1))
    FAILED_TARGETS="${FAILED_TARGETS} ${TARGET}"
  fi
done

# TherrMobile keeps its React Native toolchain in an isolated package.json that the root
# `npm ci` above does not install; tsc cannot resolve react-native types without it.
printMessageNeutral "=== Type-checking mobile (baseline mode) ==="
printMessageNeutral "Installing TherrMobile isolated dependencies..."
(cd TherrMobile && npm ci --legacy-peer-deps --ignore-scripts)

if ./_bin/check-mobile-tsc-baseline.sh; then
  printMessageSuccess "mobile clean (no new errors vs baseline)"
else
  printMessageError "New type errors in TherrMobile"
  TYPECHECK_FAILURES=$((TYPECHECK_FAILURES + 1))
  FAILED_TARGETS="${FAILED_TARGETS} mobile"
fi

if [ $TYPECHECK_FAILURES -gt 0 ]; then
  printMessageError "Type-checking failed in ${TYPECHECK_FAILURES} package(s):${FAILED_TARGETS}"
  exit 1
fi

printMessageSuccess "All packages passed type-checking"
