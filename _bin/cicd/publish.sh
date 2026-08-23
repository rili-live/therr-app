#!/bin/bash

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh
source ./_bin/lib/service-registry.sh
source ./_bin/lib/versions-ledger.sh

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

PUBLISHED_KEYS=()

for KEY in $(service_keys); do
  IMAGE="$(service_image "$KEY")"

  if ! has_prev_diff_changes_any $(service_sources "$KEY"); then
    echo "Skipping $KEY publish (No Changes) — ledger keeps $(ledger_resolve "$KEY")"
    continue
  fi

  printMessageNeutral "Publishing therrapp/$IMAGE$SUFFIX:$GIT_SHA"
  docker push "therrapp/$IMAGE$SUFFIX:latest"
  docker push "therrapp/$IMAGE$SUFFIX:$GIT_SHA"

  # Recorded only after both pushes succeed. A ledger row is a promise to the deploy
  # that this exact tag is pullable; writing it before the push would turn a failed
  # push into a missing-image abort one job later, at the cluster, instead of here.
  ledger_set "$KEY" "$GIT_SHA"
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
