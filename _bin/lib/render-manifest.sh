#!/bin/bash

# Render a Deployment manifest with the image tag it should run, so that a single
# `kubectl apply` both reconciles the manifest and pins the version.
#
# WHY THE TAG IS RENDERED IN, NOT PATCHED AFTER
#
# The manifests in k8s/prod pin `:latest`, and the deploy used to `kubectl apply` the
# manifest as-is and then `kubectl set image` the published SHA on top. That relied
# on client-side apply leaving the live image alone because `:latest` was unchanged
# between the manifest and its last-applied annotation. It does not work that way:
# apply's three-way merge sets every field in the manifest whose *live* value
# differs (only deletions are decided against last-applied), so every apply reset
# the image to `:latest`, and only the `set image` that followed put the SHA back.
#
# The cluster showed it plainly (2026-09-19): every service's ReplicaSet history
# alternated `<sha>`, `:latest`, `<sha>` — two rollouts per deploy for a service with
# a new image, and one silent flip to `:latest` for a service that was already
# up-to-date, because nothing was queued to flip it back. Wave 1 ran on `:latest`
# for ~22 hours between two deploys; the api-gateway was left on it. While a
# Deployment sits on `:latest` the ledger comparison in deploy-plan.sh is blind
# (`latest` is not a SHA to compare against), the pull policy silently becomes
# Always, and the "can this Pod be rescheduled" probe always says yes.
#
# Rendering the tag into a copy of the manifest before apply makes the manifest the
# single source of the image. apply prints `configured` and rolls exactly when the
# image or the spec changed, `unchanged` otherwise, and the live tag is always a
# SHA. `set image` is gone.

# render_deployment_manifest <manifest> <image-name> <image-ref> <out-file>
#
# Copies <manifest> to <out-file> with its `image: therrapp/<image-name>:latest`
# line replaced by `image: <image-ref>`. Exactly one such line must exist: zero
# means this manifest and the service registry disagree about what it runs, more
# than one means the substitution is ambiguous — either way the deploy must stop
# rather than apply a guess. Sidecar images (cloud-sql-proxy) carry their own pinned
# tags and are left alone.
#
# <image-name> is the un-suffixed name the manifest is written with (`api-gateway`);
# <image-ref> is the full reference to run (`therrapp/api-gateway:<sha>`, or the
# `-stage` variant on a stage deploy).
render_deployment_manifest()
{
  local MANIFEST=$1
  local IMAGE_NAME=$2
  local IMAGE_REF=$3
  local OUT=$4

  if [ -z "$MANIFEST" ] || [ -z "$IMAGE_NAME" ] || [ -z "$IMAGE_REF" ] || [ -z "$OUT" ]; then
    echo "render_deployment_manifest: usage: <manifest> <image-name> <image-ref> <out-file>" >&2
    return 1
  fi

  if [ ! -f "$MANIFEST" ]; then
    echo "render_deployment_manifest: $MANIFEST does not exist" >&2
    return 1
  fi

  local PATTERN="^([[:space:]]*(-[[:space:]]+)?image:[[:space:]]+)therrapp/${IMAGE_NAME}:latest[[:space:]]*$"
  local MATCHES
  MATCHES="$(grep -cE "$PATTERN" "$MANIFEST" || true)"

  if [ "$MATCHES" -ne 1 ]; then
    echo "render_deployment_manifest: expected exactly one 'image: therrapp/${IMAGE_NAME}:latest' line in $MANIFEST, found $MATCHES" >&2
    return 1
  fi

  # `|` is the sed delimiter; an image reference never contains one.
  sed -E "s|${PATTERN}|\1${IMAGE_REF}|" "$MANIFEST" > "$OUT"
}
