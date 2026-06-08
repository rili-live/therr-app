#!/usr/bin/env bash
#
# EAS Build pre-install hook.
#
# Runs on the EAS build runner BEFORE EAS installs this app's dependencies.
# EAS uploads the whole monorepo (the build dir is the repo root, with
# TherrMobile/ as a subdirectory) but only installs npm deps inside this app
# directory. metro.config.js, however, depends on artifacts that live OUTSIDE
# TherrMobile/ and are gitignored, so they are absent on a fresh runner and must
# be produced here:
#
#   1) the repo-root node_modules  -> watchFolders[0], the `shared` alias, axios,
#      and the webpack/sass binaries used by the shared-lib builds below
#   2) the compiled shared libs    -> therr-public-library/{therr-js-utilities,
#      therr-styles,therr-react}/lib  (watchFolders + extraNodeModules)
#
# Without this, the `:app:createBundleReleaseJsAndAssets` Gradle task fails with
#   Failed to construct transformer: ENOENT ... stat '.../build/node_modules'
#
# Build order matters: therr-react imports therr-styles + therr-js-utilities.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
echo "[eas-pre-install] repo root: ${REPO_ROOT}"
cd "${REPO_ROOT}"

# Root deps. The root install does NOT use --legacy-peer-deps (only TherrMobile
# needs that). Skip husky git-hook setup, which is pointless and can be flaky in
# CI.
echo "[eas-pre-install] installing root dependencies..."
HUSKY=0 npm install --no-audit --no-fund

# Build the shared libraries Metro consumes, in dependency order. Each lib has
# (at most) a single devDependency; the actual build tools (webpack/sass) come
# from the root node_modules installed above.
for lib in therr-js-utilities therr-styles therr-react; do
  echo "[eas-pre-install] building therr-public-library/${lib}..."
  ( cd "therr-public-library/${lib}" && npm install --no-audit --no-fund && npm run build )
done

echo "[eas-pre-install] prerequisites ready."
