#!/bin/bash

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh
source ./_bin/lib/service-registry.sh
source ./_bin/lib/build-manifest.sh

# The registry is upstream of build, publish and deploy alike, so a drift between
# it and k8s/prod is caught here rather than three jobs later at the cluster.
assert_service_registry

CURRENT_BRANCH=${CICD_BRANCH:-$CIRCLE_BRANCH}
echo "Current branch is $CURRENT_BRANCH"

# CircleCI injects GIT_SHA from the pipeline revision; fall back to the checkout so
# that running this by hand tags images with a real SHA instead of an empty string.
GIT_SHA="${GIT_SHA:-$(git rev-parse HEAD)}"
echo "Building at $GIT_SHA"

# Only build the docker images when the source branch is stage or main
if [[ ("$CURRENT_BRANCH" != "stage") && ("$CURRENT_BRANCH" != "main") ]]; then
  echo "Skipping post build stage."
  exit 0
fi

[[ "$CURRENT_BRANCH" = "stage" ]] && SUFFIX="-stage" || SUFFIX=""

# The per-service source list in the registry already includes the libraries and
# global-config.js that feed each image, so the HAS_ANY_LIBRARY_CHANGES /
# HAS_UTILITIES_LIBRARY_CHANGES / HAS_GLOBAL_CONFIG_FILE_CHANGES flags this file used
# to carry — and had to keep in sync with two other files — are gone.

# Reset before the loop, not inside it: publish.sh reads the file's existence as
# "build.sh reached its loop in this job", so an empty manifest has to mean "built
# nothing" rather than "never ran".
manifest_reset

for KEY in $(service_keys); do
  IMAGE="$(service_image "$KEY")"

  if ! has_prev_diff_changes_any $(service_sources "$KEY"); then
    echo "Skipping $KEY build (No Changes)"
    continue
  fi

  LATEST_TAG="therrapp/$IMAGE$SUFFIX:latest"
  SHA_TAG="therrapp/$IMAGE$SUFFIX:$GIT_SHA"

  printMessageNeutral "Building $KEY -> $SHA_TAG"
  docker build \
    -t "$LATEST_TAG" \
    -t "$SHA_TAG" \
    -f "$(service_dockerfile "$KEY")" \
    --build-arg NODE_VERSION=${NODE_VERSION} \
    "$(service_context "$KEY")"

  # Both tags, because publish.sh pushes both. Verified here rather than trusted:
  # docker build's exit status does not by itself promise a loaded image.
  assert_image_exists "$SHA_TAG" "just built for $KEY"
  assert_image_exists "$LATEST_TAG" "just built for $KEY"

  manifest_add "$KEY" "$LATEST_TAG" "$SHA_TAG"
done

echo "Docker build complete for all services with changes"
echo "--- $BUILD_MANIFEST_FILE ---"
cat "$BUILD_MANIFEST_FILE"
echo "----------------------------"
