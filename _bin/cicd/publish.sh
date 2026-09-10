#!/bin/bash

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh
source ./_bin/lib/service-registry.sh
source ./_bin/lib/versions-ledger.sh
source ./_bin/lib/build-scope.sh
source ./_bin/lib/build-manifest.sh

assert_service_registry

CURRENT_BRANCH=${CICD_BRANCH:-$CIRCLE_BRANCH}
echo "Current branch is $CURRENT_BRANCH"

GIT_SHA="${GIT_SHA:-$(git rev-parse HEAD)}"
echo "Publishing at $GIT_SHA"

# Only publish the docker images when the source branch is stage or main
if [[ ("$CURRENT_BRANCH" != "stage") && ("$CURRENT_BRANCH" != "main") ]]; then
  echo "Skipping post build stage."
  exit 0
fi

[[ "$CURRENT_BRANCH" = "stage" ]] && SUFFIX="-stage" || SUFFIX=""

# Start from what is already recorded so that services untouched by this merge keep
# the SHA of the build that *does* contain them. Overwriting the whole file with one
# SHA — what this script used to do — is what made a second merge to stage point
# every service at a tag only the second merge's services were built for. See the
# header of versions-ledger.sh.
ledger_load VERSIONS.txt

# build.sh runs earlier in this same job and writes the manifest before its loop, so
# an absent file means the build step did not run at all — never that nothing was
# built. Pushing on the changed-files predicate alone is what let this script send a
# tag no build had produced; it no longer decides that on its own.
if ! manifest_exists; then
  printMessageError "No build manifest at $BUILD_MANIFEST_FILE."
  printMessageError "  publish.sh pushes what build.sh recorded building, so build.sh must have run"
  printMessageError "  earlier in this job over this checkout. Re-run the whole stage pipeline"
  printMessageError "  rather than this job alone."
  exit 1
fi

PUBLISHED_KEYS=()

for KEY in $(service_keys); do
  if manifest_has "$KEY"; then
    WAS_BUILT=true
  else
    WAS_BUILT=false
  fi

  # The same predicate build.sh used, over the same checkout and the same ledger —
  # the disagreement branch below is only meaningful while that stays true.
  if ! service_needs_build "$KEY"; then
    if [ "$WAS_BUILT" = "false" ]; then
      # ledger_resolve is empty for a service that has never been published. Say so
      # rather than printing a bare "ledger keeps ", which reads like a lost SHA.
      KEPT="$(ledger_resolve "$KEY")"
      echo "Skipping $KEY publish (No Changes) — ledger keeps ${KEPT:-no row yet}"
      continue
    fi

    # The manifest is the authority on what exists, so a service built despite
    # reporting no changes still ships — leaving a built image unpushed would put
    # the ledger and the image store out of step for no gain.
    printMessageWarning "$KEY reports no changes but was built in this job — publishing it."
  elif [ "$WAS_BUILT" = "false" ]; then
    printMessageError "$KEY changed since its published image but build.sh never built it."
    printMessageError "  Both steps evaluate the same changed-files predicate over the same checkout,"
    printMessageError "  so this means they disagreed — usually because git could not answer the diff"
    printMessageError "  during the build step and the failure was read as 'no changes'."
    printMessageError "  Read the build step's log for a git error; do not re-run this job alone."
    exit 1
  fi

  LATEST_TAG="$(manifest_tag_latest "$KEY")"
  SHA_TAG="$(manifest_tag_sha "$KEY")"

  assert_image_exists "$SHA_TAG" "recorded in $BUILD_MANIFEST_FILE by build.sh"

  printMessageNeutral "Publishing $SHA_TAG"
  docker push "$LATEST_TAG"
  docker push "$SHA_TAG"

  # Recorded only after both pushes succeed. A ledger row is a promise to the deploy
  # that this exact tag is pullable; writing it before the push would turn a failed
  # push into a missing-image abort one job later, at the cluster, instead of here.
  #
  # Taken off the tag that was actually pushed rather than off GIT_SHA, so the row
  # cannot name a tag the push never sent.
  ledger_set "$KEY" "${SHA_TAG##*:}"
  PUBLISHED_KEYS+=("$KEY")
done

if [[ "$CURRENT_BRANCH" == "stage" && ${#PUBLISHED_KEYS[@]} -gt 0 ]]; then
  LEDGER_LAST_PUBLISHED="$GIT_SHA"
  ledger_write VERSIONS.txt

  printMessageSuccess "Published: ${PUBLISHED_KEYS[*]}"
  echo "--- VERSIONS.txt ---"
  cat VERSIONS.txt
  echo "--------------------"

  git config user.email "rili.main@gmail.com"
  git config user.name "Rili Admin"
  git add VERSIONS.txt

  # Re-publishing a SHA the ledger already records leaves VERSIONS.txt byte-identical,
  # and `git commit` exits non-zero on an empty index under `set -e` — failing the job
  # over a publish that in fact succeeded. Reachable when GIT_SHA is pinned to a value
  # already recorded, e.g. re-running this step by hand in a rerun-with-SSH session.
  # (--quiet returns 2 on an internal error, which lands in the else and commits: the
  # safe direction.)
  #
  # NOTE: this does NOT make a CI rerun safe on its own. A rerun starts from a fresh
  # checkout at CIRCLE_SHA1, so the working tree holds the PRE-publish VERSIONS.txt
  # while origin/stage already carries the ledger commit the first run pushed. The file
  # therefore looks changed, a sibling commit is made, and the push below is rejected
  # as non-fast-forward. That is pre-existing behaviour, not something this guard
  # introduced — see the reconciliation follow-up in docs/WORK_IN_PROGRESS.md.
  if git diff --cached --quiet -- VERSIONS.txt; then
    printMessageNeutral "VERSIONS.txt already records ${GIT_SHA:0:7} for these services — nothing to commit."
  else
    git commit -m "[skip ci] Publish ${PUBLISHED_KEYS[*]} at ${GIT_SHA:0:7}"
  fi

  # Outside the guard so that a commit made by an earlier attempt in this same
  # container still gets sent. A push with nothing new is a no-op.
  git push --set-upstream origin stage --no-verify
fi

echo "Docker publish complete for all services with changes"
