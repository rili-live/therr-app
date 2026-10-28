#!/bin/bash
# Pass cache and failure record for the per-package check loop in _bin/apply-to-changed.sh.
#
# Why this exists: `test:changed` and the pre-push hook run `npm test` in every package
# that changed versus the base branch, fail-fast. Fixing the one package that failed and
# pushing again re-ran every package before it too, minutes of suites that had already
# passed on the same content. A failed check should replay from the failure, not from
# the start.
#
# How: a package that passes a cacheable command is recorded under a key that hashes
#   - the command,
#   - the package's committed tree, its uncommitted diff and its untracked files,
#   - the same three for every shared input (libraries, root config, the lockfile),
#   - the Node version.
# Any change to any of them is a different key and a cache miss, so a hit means "this
# exact content already passed this exact command here". Misses are always safe.
#
# Scope:
#   - Only pure checks are cached (`npm test`, `npm run lint`). A build is never skipped:
#     its output can be deleted while its inputs stay the same.
#   - Disabled when CI is set and when THERR_CHECK_CACHE=0. CI must always run every check.
#   - Stored under the git common dir, so it is per clone, shared by worktrees, and can
#     never be committed.
#
# Callers source this file after colorize.sh.

# Inputs every package's result can depend on. Deliberately broad: an extra entry only
# costs a cache miss, a missing one can serve a stale pass.
CHECK_CACHE_SHARED_INPUTS=(
  "therr-public-library"
  "eslint-config"
  "global-config.js"
  "package.json"
  "package-lock.json"
  "tsconfig.base.json"
  "tsconfig.service.json"
  "tsconfig.strict.json"
  "babel.config.json"
  "jest.config.js"
  "jest.setup.js"
)

check_cache_enabled() {
  [ "${THERR_CHECK_CACHE:-1}" != "0" ] && [ -z "${CI:-}" ]
}

check_cache_cacheable() {
  case "$1" in
    "npm test" | "npm run test" | "npm run lint") return 0 ;;
    *) return 1 ;;
  esac
}

check_cache_dir() {
  local common
  common=$(git rev-parse --git-common-dir 2>/dev/null) || return 1
  # --git-common-dir is relative to the cwd when it is the default `.git`.
  (cd "$common" && pwd)
}

_check_cache_sha() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | cut -d' ' -f1
  else
    shasum -a 256 | cut -d' ' -f1
  fi
}

# check_cache_key <command> <package_dir>  — run from the repo root.
check_cache_key() {
  local cmd=$1 pkg=$2 path
  {
    printf 'cmd=%s\nnode=%s\n' "$cmd" "$(node --version 2>/dev/null || echo none)"
    for path in "$pkg" "${CHECK_CACHE_SHARED_INPUTS[@]}"; do
      printf 'path=%s tree=%s\n' "$path" "$(git rev-parse "HEAD:$path" 2>/dev/null || echo absent)"
      git diff HEAD --binary -- "$path" 2>/dev/null
      git ls-files -o --exclude-standard -z -- "$path" 2>/dev/null \
        | sort -z \
        | while IFS= read -r -d '' file; do
            printf 'untracked=%s %s\n' "$file" "$(_check_cache_sha < "$file")"
          done
    done
  } | _check_cache_sha
}

_check_cache_json_string() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\t'/\\t}
  printf '"%s"' "$s"
}

# check_cache_run <package_dir> <command>
# Runs <command> inside <package_dir> (relative to the repo root, which must be the cwd),
# unless the same command already passed on identical content. Returns the command's
# exit status. On failure, writes last-failure.json next to the cache.
check_cache_run() {
  local pkg=$1 cmd=$2 dir key log status

  if ! check_cache_enabled || ! check_cache_cacheable "$cmd" || ! dir=$(check_cache_dir); then
    printMessageNeutral "Running command '${cmd}': ${pkg}"
    (cd "$pkg" && eval "$cmd")
    return $?
  fi

  mkdir -p "$dir/therr-check-cache/pass" "$dir/therr-check-cache/logs"
  # Bounded: entries are a few bytes each, but there is one per package per content state.
  find "$dir/therr-check-cache/pass" -type f -mtime +14 -delete 2>/dev/null || true

  key=$(check_cache_key "$cmd" "$pkg")
  if [ -f "$dir/therr-check-cache/pass/$key" ]; then
    printMessageNeutral "Skipping command '${cmd}': ${pkg} (already passed on identical content — THERR_CHECK_CACHE=0 to force)"
    CHECK_CACHE_SKIPPED=$(( ${CHECK_CACHE_SKIPPED:-0} + 1 ))
    return 0
  fi

  log="$dir/therr-check-cache/logs/$(printf '%s' "$pkg" | tr '/' '_').log"
  printMessageNeutral "Running command '${cmd}': ${pkg}"
  local errexit=0
  case $- in *e*) errexit=1 ;; esac
  set +e
  (cd "$pkg" && eval "$cmd") 2>&1 | tee "$log"
  status=${PIPESTATUS[0]}
  [ "$errexit" -eq 1 ] && set -e

  if [ "$status" -eq 0 ]; then
    printf '%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$pkg" "$cmd" > "$dir/therr-check-cache/pass/$key"
    # A record of this package's failure is stale once it passes.
    if grep -qF "\"package\": $(_check_cache_json_string "$pkg")," "$dir/therr-check-cache/last-failure.json" 2>/dev/null; then
      rm -f "$dir/therr-check-cache/last-failure.json"
    fi
  else
    {
      printf '{\n'
      printf '  "package": %s,\n' "$(_check_cache_json_string "$pkg")"
      printf '  "command": %s,\n' "$(_check_cache_json_string "$cmd")"
      printf '  "exitCode": %s,\n' "$status"
      printf '  "head": %s,\n' "$(_check_cache_json_string "$(git rev-parse HEAD 2>/dev/null)")"
      printf '  "at": %s,\n' "$(_check_cache_json_string "$(date -u +%Y-%m-%dT%H:%M:%SZ)")"
      printf '  "log": %s,\n' "$(_check_cache_json_string "$log")"
      printf '  "tail": %s\n' "$(_check_cache_json_string "$(tail -n 40 "$log")")"
      printf '}\n'
    } > "$dir/therr-check-cache/last-failure.json"
    printMessageError "'${cmd}' failed in ${pkg}. Record: $dir/therr-check-cache/last-failure.json"
    printMessageError "Re-running replays from here: packages that already passed on identical content are skipped."
  fi
  return "$status"
}
