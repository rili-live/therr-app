#!/bin/bash
# Run the client-side Jest suites (web, dashboard, mobile).
# Runs directly on the host (Node.js executor), not inside Docker.
#
# These three packages were the largest untested surface in CI: ~1,314 cases across
# 56 files that no job executed. The service suites run under Mocha inside the deps
# image (test_libraries / build_and_test_changed_services); these run under Jest and
# need only Node, so they live in their own job.
#
# All three suites are run every time rather than filtered by changed files: they are
# fast (~35s combined) and they consume the shared libraries, so a change in
# therr-react can break them without touching their own directories.

set -e

source ./_bin/lib/colorize.sh

printMessageNeutral "Installing dependencies for client tests..."
npm ci --legacy-peer-deps --ignore-scripts
printMessageSuccess "Dependencies installed"

# The client suites import from the compiled lib/ output, which is gitignored.
printMessageNeutral "Building shared libraries..."
(cd therr-public-library/therr-js-utilities && npm run build) || {
  printMessageError "Failed to build therr-js-utilities"
  exit 1
}
(cd therr-public-library/therr-react && npm run build) || {
  printMessageError "Failed to build therr-react"
  exit 1
}
printMessageSuccess "Shared libraries built"

TEST_FAILURES=0
FAILED_PACKAGES=""

run_suite() {
  local pkg="$1"
  printMessageNeutral "=== Testing ${pkg} ==="
  if (cd "${pkg}" && npm test); then
    printMessageSuccess "${pkg} passed"
  else
    printMessageError "Test failures in ${pkg}"
    TEST_FAILURES=$((TEST_FAILURES + 1))
    FAILED_PACKAGES="${FAILED_PACKAGES} ${pkg}"
  fi
}

run_suite "therr-client-web"
run_suite "therr-client-web-dashboard"

# TherrMobile's jest.config.js uses `preset: 'react-native'`, which resolves from
# TherrMobile/node_modules — the root `npm ci` above does not install it.
printMessageNeutral "Installing TherrMobile isolated dependencies..."
(cd TherrMobile && npm ci --legacy-peer-deps --ignore-scripts)
run_suite "TherrMobile"

if [ $TEST_FAILURES -gt 0 ]; then
  printMessageError "Client tests failed in ${TEST_FAILURES} package(s):${FAILED_PACKAGES}"
  exit 1
fi

printMessageSuccess "All client test suites passed"
