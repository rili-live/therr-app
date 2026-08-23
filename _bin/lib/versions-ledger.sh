#!/bin/bash

# VERSIONS.txt: which published image each service should be running.
#
# WHAT WENT WRONG WITH ONE SHA
#
# VERSIONS.txt used to hold a single line, LAST_PUBLISHED_GIT_SHA, rewritten
# wholesale by every stage publish. That is only correct when stage receives
# exactly one merge per promotion to main, because the publish job builds *only
# the services that changed in that merge* and then stamps the file as if the SHA
# spoke for all eight.
#
# Two merges to stage before a promotion, and it breaks:
#
#   merge 1  users-service changes    -> publishes users-service-stage:A, file = A
#   merge 2  maps-service changes     -> publishes maps-service-stage:B,  file = B
#   stage -> main                     -> deploy sees both services changed and
#                                        pulls users-service-stage:B, which was
#                                        never built.
#
# `docker pull` on a tag that does not exist is a non-zero exit under `set -e`, and
# it happened before `deploy_waves` ran — so the whole deploy aborted and *nothing*
# rolled, including the services whose images were fine. That is the "can't find
# the sha and the corresponding images" failure.
#
# The file is now a per-service ledger. Each service carries the SHA of the last
# stage build that actually contained it, so merge order stops mattering and the
# tag a service deploys at is always a tag that was built for that service.
#
# WHY main NO LONGER WRITES THIS FILE
#
# deploy.sh used to truncate VERSIONS.txt and push the empty file to main. stage
# kept its SHA, main kept an empty file, and every main->stage and main->general
# back-merge then had a genuine three-way conflict on a file nobody reads by hand.
# Resolving one toward the wrong side silently re-pointed the next deploy at an
# arbitrary SHA. `origin/general` still carries a stale
# LAST_PUBLISHED_GIT_SHA=eef996d from one of those resolutions, and commit f038f64
# ("fix(mobile): lift the thought reply composer...") is a feature commit that
# picked up deploy state as collateral.
#
# Only publish.sh, only on stage, writes this file now. main reads it. With one
# writer the file never diverges between branches, so the merge conflict and the
# mis-resolution it invited both stop existing. deploy.sh does not need the
# truncation to stay idempotent — it converges on cluster state instead (see
# deploy-plan.sh).
#
# FORMAT
#
#   LAST_PUBLISHED_GIT_SHA=<sha>     most recent stage publish, any service.
#                                    Kept as the fallback for a service with no
#                                    row yet, and for backwards compatibility.
#   PUBLISHED_<KEY>=<sha>            per-service. <KEY> is the registry key
#                                    upper-cased with '-' mapped to '_'.
#
# Rows are written sorted, one key per line, so that the file merges by line and
# two services published on different branches do not collide.

# Parallel arrays rather than an associative array: this is sourced by scripts
# people also run on macOS, whose default bash is 3.2 and has no `declare -A`.
LEDGER_KEYS=()
LEDGER_SHAS=()
LEDGER_LAST_PUBLISHED=""

ledger_reset()
{
  LEDGER_KEYS=()
  LEDGER_SHAS=()
  LEDGER_LAST_PUBLISHED=""
}

ledger_var_from_key()
{
  printf 'PUBLISHED_%s' "$(printf '%s' "$1" | tr 'a-z-' 'A-Z_')"
}

# The exact inverse of ledger_var_from_key, prefix included. Leaving the prefix for
# the caller to strip is how the two drift: '_' and '-' are swapped by the same `tr`,
# so a caller that strips "PUBLISHED_" afterwards is stripping a string that no
# longer exists, and gets a key with a spurious "published-" on the front.
ledger_key_from_var()
{
  printf '%s' "${1#PUBLISHED_}" | tr 'A-Z_' 'a-z-'
}

# Echoes the recorded SHA for <key>, or nothing. Always returns 0 — "no row yet"
# is an ordinary state on a service that has not been rebuilt since the ledger
# was introduced, and callers distinguish it by testing for the empty string.
ledger_get()
{
  local TOTAL=${#LEDGER_KEYS[@]}
  local INDEX=0

  while [ "$INDEX" -lt "$TOTAL" ]; do
    if [ "${LEDGER_KEYS[$INDEX]}" = "$1" ]; then
      printf '%s' "${LEDGER_SHAS[$INDEX]}"
      return 0
    fi
    INDEX=$((INDEX + 1))
  done

  return 0
}

# The tag a service should actually deploy at: its own row, else the file-wide
# LAST_PUBLISHED_GIT_SHA.
#
# The fallback is what carries the transition. Before this ledger existed no
# service had a row, so on the first deploy after it lands every service resolves
# through LAST_PUBLISHED_GIT_SHA — exactly the behaviour of the old script — and
# rows accumulate from the next stage publish onward. It is also the honest answer
# for a service whose image predates the ledger.
ledger_resolve()
{
  local SHA
  SHA="$(ledger_get "$1")"

  if [ -n "$SHA" ]; then
    printf '%s' "$SHA"
  else
    printf '%s' "$LEDGER_LAST_PUBLISHED"
  fi
}

ledger_set()
{
  local KEY=$1
  local SHA=$2
  local TOTAL=${#LEDGER_KEYS[@]}
  local INDEX=0

  while [ "$INDEX" -lt "$TOTAL" ]; do
    if [ "${LEDGER_KEYS[$INDEX]}" = "$KEY" ]; then
      LEDGER_SHAS[$INDEX]="$SHA"
      return 0
    fi
    INDEX=$((INDEX + 1))
  done

  LEDGER_KEYS+=("$KEY")
  LEDGER_SHAS+=("$SHA")
}

# Reads VERSIONS.txt into the arrays above.
#
# Parsed line by line rather than with the `export $(cat VERSIONS.txt)` this
# replaces: that form word-splits the whole file through the shell, so a stray
# space or a comment turned into an `export` of something arbitrary, and a file
# with CRLF endings produced a SHA with a trailing carriage return that then
# failed every `docker pull` for reasons invisible in the log.
ledger_load()
{
  local FILE=${1:-VERSIONS.txt}

  ledger_reset

  [ -f "$FILE" ] || return 0

  local LINE NAME VALUE
  while IFS= read -r LINE || [ -n "$LINE" ]; do
    LINE="${LINE%%#*}"
    LINE="$(printf '%s' "$LINE" | tr -d '[:space:]')"

    [ -z "$LINE" ] && continue
    case "$LINE" in
      *=*) ;;
      *) continue ;;
    esac

    NAME="${LINE%%=*}"
    VALUE="${LINE#*=}"

    [ -n "$VALUE" ] || continue

    if [ "$NAME" = "LAST_PUBLISHED_GIT_SHA" ]; then
      LEDGER_LAST_PUBLISHED="$VALUE"
    else
      case "$NAME" in
        PUBLISHED_*) ledger_set "$(ledger_key_from_var "$NAME")" "$VALUE" ;;
      esac
    fi
  done < "$FILE"

  return 0
}

# Writes the ledger back, rows sorted by key.
ledger_write()
{
  local FILE=${1:-VERSIONS.txt}
  local TOTAL=${#LEDGER_KEYS[@]}
  local INDEX=0

  {
    if [ -n "$LEDGER_LAST_PUBLISHED" ]; then
      echo "LAST_PUBLISHED_GIT_SHA=$LEDGER_LAST_PUBLISHED"
    fi

    while [ "$INDEX" -lt "$TOTAL" ]; do
      echo "$(ledger_var_from_key "${LEDGER_KEYS[$INDEX]}")=${LEDGER_SHAS[$INDEX]}"
      INDEX=$((INDEX + 1))
    done | LC_ALL=C sort
  } > "$FILE"
}
