#!/bin/bash

# What build.sh actually built, handed to publish.sh.
#
# WHY THIS EXISTS
#
# build.sh and publish.sh run as two steps of one job over one checkout, and each
# used to answer "should this service ship?" by evaluating the changed-files
# predicate independently. Two evaluations of the same question have two answers
# available to them, and when they disagreed the disagreement surfaced four steps
# later as `docker push` reporting "An image does not exist locally with the tag" —
# a message about the registry, for a fault in the build step, which had gone green.
# That is what happened on the stage merge at e4790de8: build skipped all eight
# services, publish found therr-client-web changed, and pushed a tag nothing built.
#
# So the predicate is no longer the thing publish acts on. build.sh records the tags
# it produced, and publish.sh pushes that list. The predicate stays in publish only
# as a cross-check: if it says a service should have shipped and the manifest does
# not carry it, the two steps disagreed, and publish says so in those words instead
# of failing at the registry.
#
# The file is job-local and gitignored, same as `.deploy-plan.tsv` — it describes one
# container's image store, and means nothing outside the job that wrote it.

BUILD_MANIFEST_FILE="${BUILD_MANIFEST_FILE:-.build-manifest.tsv}"

# Truncate. Called once by build.sh before its loop, so that "the file exists" means
# "build.sh ran to the loop in this job" and an empty file means "built nothing" —
# a distinction publish.sh depends on to tell a legitimate no-op apart from a build
# step that never ran.
manifest_reset()
{
    : > "$BUILD_MANIFEST_FILE"
}

# manifest_add <key> <latest-tag> <sha-tag>
manifest_add()
{
    printf '%s\t%s\t%s\n' "$1" "$2" "$3" >> "$BUILD_MANIFEST_FILE"
}

manifest_exists()
{
    [ -f "$BUILD_MANIFEST_FILE" ]
}

# Echoes the row for <key>; non-zero when the key was not built.
manifest_row()
{
    manifest_exists || return 1
    awk -F'\t' -v key="$1" '$1 == key { print; found = 1 } END { exit !found }' "$BUILD_MANIFEST_FILE"
}

manifest_has()
{
    manifest_row "$1" >/dev/null
}

manifest_tag_latest()
{
    manifest_row "$1" | cut -f2
}

manifest_tag_sha()
{
    manifest_row "$1" | cut -f3
}

# Fails the script when <tag> is not in the local image store.
#
# A `docker build` that exits 0 without leaving its tags behind is not a
# hypothetical: under a buildx container driver the result stays in the build cache
# unless `--load` is passed, and the only symptom is a push that cannot find the
# image. Asserting right after the build puts the error on the step that caused it.
assert_image_exists()
{
    local TAG=$1
    local CONTEXT=$2

    if docker image inspect "$TAG" >/dev/null 2>&1; then
        return 0
    fi

    printMessageError "$TAG is not in the local docker image store ($CONTEXT)."
    printMessageError "  A 'docker build' that exits 0 without loading its tags means the build ran"
    printMessageError "  under a driver that only writes the build cache. Check the docker version"
    printMessageError "  and builder driver on this executor before re-running."
    exit 1
}
