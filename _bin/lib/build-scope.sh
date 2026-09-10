#!/bin/bash

# "Does this service need building on this stage/main commit?"
#
# WHY THIS IS NOT JUST THE HEAD^1 RANGE
#
# `git diff HEAD^1` answers "what did this merge bring in", which is the right
# question only while every stage run publishes what it built. When one does not —
# the run at a5ce2eee aborted in build.sh before a single image was pushed — the
# merge carrying a service's change falls behind HEAD^1 permanently. The service then
# reads as unchanged on every later merge, and nothing says so: the build log lists it
# under "No Changes", the publish log agrees, and production keeps running the image
# from before the change. The landing-page update was one merge away from exactly
# that.
#
# VERSIONS.txt already records the SHA of the last build actually published for each
# service, which answers the question that matters: has this service changed since the
# image we last published *for it*? That converges — a service missed by one run is
# picked up by the next — and it is one-directional: it can only ever build more than
# the HEAD^1 range, never less.
#
# REQUIRES colorize.sh, has_diff_changes.sh, service-registry.sh and versions-ledger.sh
# to be sourced, and the ledger to be loaded (`ledger_load VERSIONS.txt`).
#
# build.sh and publish.sh must both decide through this function and nothing else:
# publish.sh treats a disagreement with build.sh as a hard error, which is only a
# useful check while the two evaluate the same predicate.

service_needs_build()
{
    local KEY=$1
    local SOURCES
    SOURCES="$(service_sources "$KEY")" || return 0

    local RECORDED
    RECORDED="$(ledger_resolve "$KEY")"

    if [ -n "$RECORDED" ] && ensure_commit_available "$RECORDED"; then
        if sources_changed_between "$RECORDED" HEAD $SOURCES; then
            printMessageWarning "$KEY: sources changed since its published image ${RECORDED:0:7}"
            return 0
        fi

        return 1
    fi

    # No row yet (never published), or a SHA this checkout cannot reach. Neither is a
    # reason to skip, so ask the question this checkout *can* answer.
    if [ -z "$RECORDED" ]; then
        printMessageWarning "$KEY has no ledger row — falling back to the HEAD^1 range."
    else
        printMessageWarning "$KEY: ledger SHA ${RECORDED:0:7} is unreachable here — falling back to the HEAD^1 range."
    fi

    has_prev_diff_changes_any $SOURCES
}
