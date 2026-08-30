#!/bin/bash

set -e

source ./_bin/lib/colorize.sh

# Cache fetched branches to avoid redundant network calls
_FETCHED_BRANCHES=""

_fetch_once()
{
    local BRANCH=$1
    if [[ "$_FETCHED_BRANCHES" != *"|$BRANCH|"* ]]; then
        git fetch origin "$BRANCH"
        _FETCHED_BRANCHES="${_FETCHED_BRANCHES}|$BRANCH|"
    fi
}

# Resolve the branch to diff against for "what changed here?" checks.
#
# The promotion chain is feature -> general -> stage -> main, so the meaningful
# comparison is always against the NEXT branch down the chain. Hardcoding
# `general` breaks on the general branch itself: `git diff origin/general` while
# on general is empty, so every changed-files check silently finds nothing and
# passes. That reads as a working gate while checking nothing at all.
resolve_diff_base()
{
    local CURRENT_BRANCH=${CICD_BRANCH:-${CIRCLE_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}}

    case "$CURRENT_BRANCH" in
        general) echo "stage" ;;
        stage)   echo "main" ;;
        *)       echo "general" ;;
    esac
}

# Whether the checkout can answer anything about history above HEAD.
#
# CircleCI's checkout can hand a job a shallow clone, and `attach_workspace` replays
# whatever depth the job that persisted the workspace was given. In a depth-1 clone
# HEAD has no parent locally, so `git diff HEAD^1` dies with "unknown revision" —
# which _count_diff_files below then, correctly, turns into a failed job rather than
# a silent "no changes". That is the right verdict on the diff and the wrong one for
# the pipeline: the history is a fetch away, so go and get it.
#
# One deepen covers every HEAD^1/HEAD^2 question these scripts ask (depth 2 pulls in
# both parents of a merge), and it is a no-op on a full clone, where the probe is
# false.
#
# Everything it says goes to stderr: its callers run inside `$(...)`, and a warning on
# stdout would be captured as part of the SHA they are resolving.
#
# The "already tried" flag is a file rather than a shell variable for the same reason —
# a variable set inside a command substitution dies with that subshell, so a fetch that
# fails outright would otherwise be retried once per service, per script.
_deepen_once()
{
    local MARKER
    MARKER="$(git rev-parse --git-dir 2>/dev/null)/therr-deepen-attempted"

    if [ -e "$MARKER" ]; then
        return 0
    fi
    : > "$MARKER" 2>/dev/null || true

    if [ "$(git rev-parse --is-shallow-repository 2>/dev/null)" != "true" ]; then
        return 0
    fi

    local BRANCH=${CICD_BRANCH:-${CIRCLE_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}}

    {
        printMessageWarning "Shallow checkout — deepening so HEAD's parents are resolvable."
        git fetch --deepen=1 origin "$BRANCH" \
            || git fetch --unshallow origin "$BRANCH" \
            || printMessageWarning "Could not deepen the checkout (git's error is above)."
    } >&2

    return 0
}

# Fetch the whole history, once, when the checkout is shallow.
#
# _deepen_once buys one commit, which is all HEAD^1/HEAD^2 need. A SHA recorded in
# VERSIONS.txt by an earlier stage publish can be dozens of commits back, and there is
# no useful depth to guess — so the answer for that case is the whole history or
# nothing. Only paid when the checkout is actually shallow.
_unshallow_once()
{
    local MARKER
    MARKER="$(git rev-parse --git-dir 2>/dev/null)/therr-unshallow-attempted"

    if [ -e "$MARKER" ]; then
        return 0
    fi
    : > "$MARKER" 2>/dev/null || true

    if [ "$(git rev-parse --is-shallow-repository 2>/dev/null)" != "true" ]; then
        return 0
    fi

    {
        printMessageWarning "Shallow checkout — fetching full history to resolve a recorded SHA."
        git fetch --unshallow origin \
            || printMessageWarning "Could not unshallow the checkout (git's error is above)."
    } >&2

    return 0
}

# Whether <rev> names a commit this checkout can read, fetching it if it cannot.
#
# Returns 1 when the object stays unavailable — an old SHA whose branch is gone, or a
# shallow clone with no remote to complete it. Callers fall back to a range they can
# answer rather than treating "not here" as "not changed".
ensure_commit_available()
{
    local REV=$1

    [ -n "$REV" ] || return 1

    if git cat-file -e "${REV}^{commit}" 2>/dev/null; then
        return 0
    fi

    _unshallow_once

    git cat-file -e "${REV}^{commit}" 2>/dev/null
}

# The tip the branch was at before this merge — HEAD's first parent.
#
# Echoes the resolved SHA and returns 0. Returns 1, silently, when the parent cannot
# be made available even after deepening. Callers must read that as "git cannot tell
# us", which is a fail-open: reporting "no changes" from it is the silent skip this
# whole file exists to prevent.
prev_tip()
{
    local REV
    REV=$(git rev-parse --verify --quiet "HEAD^1" || true)

    if [ -z "$REV" ]; then
        _deepen_once
        REV=$(git rev-parse --verify --quiet "HEAD^1" || true)
    fi

    [ -n "$REV" ] || return 1

    printf '%s' "$REV"
}

# Sets NUM_FILES_CHANGED from `git diff --name-only <rev...> -- <path...>`, and aborts
# the script when git itself fails.
#
# WHY THIS IS NOT `NUM=$(git diff ... | wc -l)`
#
# That form throws away git's exit status — a pipeline reports the status of its last
# element, so `wc` succeeding hides git dying. A git that cannot answer (an
# unresolvable rev, a missing object, a shallow or partial checkout) prints its fatal
# to stderr and contributes zero lines, and `[[ 0 -gt 0 ]]` is false. "git could not
# tell us" and "nothing changed" therefore become the same answer: a silent skip.
#
# Not hypothetical. On the stage merge at e4790de8, build.sh skipped all eight
# services as "No Changes" while publish.sh — the identical predicate, the same
# checkout, later in the same job — found therr-client-web changed and pushed an
# image nothing had built. The job failed at `docker push` with "An image does not
# exist locally", four steps downstream of the step that actually went wrong, and the
# build step itself was green.
#
# stderr is deliberately left attached to the job log rather than captured: git's own
# message is the thing an operator needs to read.
_count_diff_files()
{
    local OUT
    if ! OUT=$(git diff --name-only "$@"); then
        printMessageError "git diff --name-only $* failed (git's error is above)."
        printMessageError "Refusing to report 'no changes' from a git failure — that is a silent skip."
        exit 1
    fi

    NUM_FILES_CHANGED=$(printf '%s' "$OUT" | grep -c . || true)
}

has_diff_changes()
{
    ORIGIN_BRANCH=$1
    DIR=$2

    _fetch_once "$ORIGIN_BRANCH"
    _count_diff_files "origin/$ORIGIN_BRANCH" -- $DIR

    if [[ ${NUM_FILES_CHANGED} -gt 0 ]]; then
        printMessageWarning "Found ${NUM_FILES_CHANGED} files changed w/ 'git diff origin/$ORIGIN_BRANCH:$DIR'"
        return 0
    else
        return 1
    fi
}

has_prev_diff_changes()
{
    DIR=$1
    CURRENT_BRANCH=${CICD_BRANCH:-$CIRCLE_BRANCH}

    if [ "$CURRENT_BRANCH" = "stage" ] || [ "$CURRENT_BRANCH" = "main" ]; then
        # On stage/main, changes arrive via merge commits from general/stage.
        # Compare against HEAD^1 (first parent = previous branch tip) to detect
        # everything that was merged in. Using merge-base with the source branch
        # doesn't work here because the source branch tip is an ancestor of the
        # merge commit, making the diff empty for the merged-in changes.
        local BASE
        if ! BASE=$(prev_tip); then
            printMessageWarning "HEAD has no resolvable first parent in this checkout."
            printMessageWarning "  Treating '$DIR' as changed: 'git cannot tell' must build, not skip."
            return 0
        fi

        _count_diff_files "$BASE" -- $DIR
        if [[ ${NUM_FILES_CHANGED} -gt 0 ]]; then
            printMessageWarning "Found ${NUM_FILES_CHANGED} files changed w/ 'git diff ${BASE:0:7} (HEAD^1) -- $DIR'"
            return 0
        else
            return 1
        fi
    else
        # Feature branches: use merge-base with the target branch to detect
        # all changes since the branch diverged
        _fetch_once "general"
        MERGE_BASE=$(git merge-base HEAD origin/general 2>/dev/null || true)
        if [ -z "$MERGE_BASE" ]; then
            _deepen_once
            MERGE_BASE=$(git merge-base HEAD origin/general 2>/dev/null || true)
        fi
        if [ -z "$MERGE_BASE" ]; then
            # Same rule as above: a shallow or grafted checkout with no common
            # ancestor cannot answer, and "cannot answer" is not "unchanged".
            printMessageWarning "No merge-base between HEAD and origin/general in this checkout."
            printMessageWarning "  Treating '$DIR' as changed rather than skipping it."
            return 0
        fi
        _count_diff_files "$MERGE_BASE" -- $DIR
        if [[ ${NUM_FILES_CHANGED} -gt 0 ]]; then
            printMessageWarning "Found ${NUM_FILES_CHANGED} files changed w/ 'git diff $MERGE_BASE -- $DIR'"
            return 0
        else
            return 1
        fi
    fi
}

# Accepts several paths, and returns 0 if any of them changed. `has_prev_diff_changes`
# takes one path and is unquoted at every call site so that a space-separated string
# word-splits into multiple pathspecs — which works, but only by accident, and breaks
# on a path containing a space. Callers that hold a service's full source list should
# use this instead.
has_prev_diff_changes_any()
{
    local PATHSPEC
    for PATHSPEC in "$@"; do
        if has_prev_diff_changes "$PATHSPEC"; then
            return 0
        fi
    done

    return 1
}

# The tip of the branch this commit is promoting.
#
# On a stage->main merge commit, HEAD^2 is the stage tip that was merged in — the
# exact revision whose code this deploy is meant to put into production. That makes
# it the right thing to check published images against, and unlike HEAD^1 it does not
# assume anything about how many merges accumulated on the other side.
#
# Falls back to HEAD when there is no second parent (a fast-forward or squashed
# promotion, or a direct commit), which is also the only correct answer there: HEAD
# *is* the promoted tip in those cases.
promoted_tip()
{
    local REV
    REV=$(git rev-parse --verify --quiet "HEAD^2" 2>/dev/null || true)

    if [ -z "$REV" ]; then
        # A shallow checkout hides the second parent of a real merge, which would
        # send the staleness check off to compare HEAD against itself. Deepen first,
        # and only then treat the absence as genuine.
        _deepen_once
        REV=$(git rev-parse --verify --quiet "HEAD^2" 2>/dev/null || true)
    fi

    if [ -n "$REV" ]; then
        echo "$REV"
    else
        git rev-parse HEAD
    fi
}

# Returns 0 if any commit touching <path...> landed in <from>..<to>.
#
# This is the check the old scripts never made: "is the image we are about to deploy
# built from code at least as new as what we are promoting?" It is independent of
# merge shape and of whether previous deploys succeeded, which is what makes it able
# to catch the silent under-deploy that a HEAD^1 range cannot see.
#
# A <from> that is not present locally (a shallow clone, or a SHA from a branch that
# was since deleted) makes the range unanswerable. That returns 1 — not stale — with
# a warning, because failing the deploy on an unresolvable ancestor would block on
# checkout depth rather than on anything about the code.
sources_changed_between()
{
    local FROM=$1
    local TO=$2
    shift 2

    if ! git cat-file -e "${FROM}^{commit}" 2>/dev/null; then
        printMessageWarning "Cannot resolve $FROM locally — skipping the staleness check for: $*"
        return 1
    fi

    local NUM_COMMITS
    NUM_COMMITS=$(git log --oneline "$FROM..$TO" -- "$@" 2>/dev/null | wc -l | tr -d ' ')

    [ "${NUM_COMMITS:-0}" -gt 0 ]
}
