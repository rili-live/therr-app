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
# arbitrary SHA. One of those resolutions is still visible in the history: f038f64
# ("fix(mobile): lift the thought reply composer...") is a feature commit that
# restored the truncated file to LAST_PUBLISHED_GIT_SHA=eef996d as collateral.
#
# Only publish.sh, only on stage, writes this file now. main reads it. With one
# writer the file never diverges between branches, so the merge conflict and the
# mis-resolution it invited both stop existing. deploy.sh does not need the
# truncation to stay idempotent — it converges on cluster state instead (see
# deploy-plan.sh).
#
# A later stage publish has since overwritten eef996d, and general, stage and main
# now all read the same SHA — so there is no divergence left for this change to
# resolve, only the per-service rows to accumulate.
#
# FORMAT
#
#   LAST_PUBLISHED_GIT_SHA=<sha>     most recent stage publish, any service. A
#                                    human-readable watermark and the file's
#                                    backwards-compatible first line — NOT a
#                                    per-service tag. Nothing resolves through it;
#                                    see ledger_resolve for what happened when it
#                                    did.
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

# The tag a service should actually deploy at: its own row, or nothing.
#
# WHY THERE IS NO LONGER A FALLBACK TO LAST_PUBLISHED_GIT_SHA
#
# This used to return LEDGER_LAST_PUBLISHED for a service with no row, to carry the
# transition from the single-SHA era. That fallback deadlocked production for three
# promotions, and the shape of it is worth keeping written down.
#
# LAST_PUBLISHED_GIT_SHA means "most recent stage publish, ANY service". It is a
# watermark, not a per-service promise. But publish.sh is incremental — it pushes
# only the services whose sources changed in the merge, and then bumps the watermark
# regardless. So a stage merge touching one service pushes one image and
# simultaneously re-points every OTHER service at that same new SHA:
#
#   stage merge  users-service changes  -> pushes users-service-stage:A
#                                          writes LAST_PUBLISHED_GIT_SHA=A
#   stage -> main                       -> maps-service has no row, resolves to A,
#                                          and therrapp/maps-service-stage:A was
#                                          never built -> missing-image -> BLOCKS
#
# missing-image is blocking, so the whole deploy is refused and nothing rolls —
# including the one service whose image was fine.
#
# plan_verdict's up-to-date-before-the-registry-probe ordering was supposed to
# absorb this, on the reasoning that an unrowed service is "already running exactly
# the right image". That only holds while the cluster's running tag equals the
# watermark. It never did: when the ledger landed the watermark was 3f1d5ba and the
# cluster was on eef996d, so every service fell straight through to the probe.
#
# Worse, it ratchets. Each attempt to force a deploy by touching one service bumps
# the watermark to a NEWER absent tag for the other seven, so every retry widens the
# gap instead of closing it. The prescribed recovery ("re-run the stage pipeline so
# it publishes and writes rows") cannot work either, because a re-run republishes
# only the services that changed in that merge.
#
# So: a row is a promise that the tag is pullable, and only publish.sh can make it,
# only after both pushes succeed. Absent a row there is no promise, and guessing one
# is what wedged the pipeline. Returning empty routes the service into the verdicts
# that already exist for exactly this state — `unresolved` (warn, left as-is) when
# the merge did not touch it, `unpublished` (blocking) when it did, which is correct
# because a service that changed and was not published IS work being dropped.
#
# Always returns 0 — "no row yet" is an ordinary state, and callers distinguish it
# by testing for the empty string.
ledger_resolve()
{
  ledger_get "$1"
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
