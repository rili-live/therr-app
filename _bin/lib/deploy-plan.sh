#!/bin/bash

# What the deploy decides, per service, and why.
#
# THE SHAPE OF THE OLD BUG
#
# The deploy used to be a *delta*: `git diff HEAD^1` on main picked which services
# roll, and a single VERSIONS.txt SHA picked what version they roll to. Two halves
# derived independently, nothing checking they agree, and both of them assuming the
# previous delta was applied in full.
#
# Every way that assumption breaks leaves a service stale with a green build:
#
#   - A deploy that aborts partway (the missing-image `docker pull` under `set -e`)
#     leaves the un-rolled services behind. The next merge's HEAD^1 range no longer
#     contains their commits, so they are skipped as "No Changes" forever.
#   - stage -> main squashed or fast-forwarded makes HEAD^1 the previous *stage*
#     commit — usually the "[skip ci] Updated VERSIONS.txt" one — so the diff shows
#     a single file and every service is skipped. Silently, and green.
#   - A stage publish that never ran leaves VERSIONS.txt pointing at an older build
#     than the code being promoted, so the diff says "changed", the pull succeeds,
#     and yesterday's image deploys as if it were today's.
#
# WHAT REPLACES IT
#
# A desired-state comparison. The tag a service *should* run is its row in the
# ledger; the tag it *does* run is read from the Deployment. Anything that differs
# rolls. That is convergent: it does not care how many merges happened, whether the
# merge was a merge commit, or whether the previous deploy finished — a service left
# behind by an aborted run is simply still different from its desired tag, so the
# next deploy picks it up.
#
# The git range keeps two jobs, neither of them "should this deploy":
#
#   BUILD_STALE      commits touching the service's sources between the tag we are
#                    about to deploy and the stage tip being promoted. Non-empty
#                    means the published image predates the code in this merge —
#                    the publish job did not run, or ran before the last push. This
#                    is the check that catches under-deploying, and nothing in the
#                    old script looked for it.
#   CHANGED_IN_MERGE  only sets severity. A service that cannot be resolved and did
#                    not change in this merge is pre-existing drift: reported, not
#                    fatal. One that did change is this promotion silently dropping
#                    work, so it is fatal.
#
# VERDICTS
#
#   deploy         roll it: image exists, build is current, running tag differs
#   up-to-date     running tag already equals the desired tag. Decided before the
#                  registry probe, because a service that will not be pulled must
#                  not be blocked by whether its tag is still pushed.
#   behind         desired tag is an ancestor of the running tag — a rollback.
#                  Skipped unless DEPLOY_ALLOW_ROLLBACK=true, because reaching it
#                  by accident (a re-run of an old pipeline) should not quietly
#                  downgrade production.
#   stale-build    published image predates the code being promoted (blocking)
#   missing-image  desired tag is not in the registry (blocking)
#   unpublished    no desired tag, and the service changed in this merge (blocking)
#   unresolved     no desired tag, and the service did not change (warn only)

# plan_verdict <desired> <running> <image_exists> <build_stale> <would_roll_back> <changed_in_merge>
#
# Booleans are the literal strings "true"/"false".
plan_verdict()
{
  local DESIRED=$1
  local RUNNING=$2
  local IMAGE_EXISTS=$3
  local BUILD_STALE=$4
  local WOULD_ROLL_BACK=$5
  local CHANGED_IN_MERGE=$6

  if [ -z "$DESIRED" ]; then
    if [ "$CHANGED_IN_MERGE" = "true" ]; then
      echo "unpublished"
    else
      echo "unresolved"
    fi
    return 0
  fi

  # Checked ahead of image existence on purpose: when the publish job never ran,
  # the *previous* image usually still exists, so the existence probe passes and
  # says nothing useful. "the build is older than the code" is the real diagnosis
  # and the one that tells you to re-run stage.
  if [ "$BUILD_STALE" = "true" ]; then
    echo "stale-build"
    return 0
  fi

  # Ahead of the existence probe on purpose. A service already on its desired tag is
  # never pulled, so whether that tag is still in the registry decides nothing about
  # this run — and missing-image is blocking, so probing first would let an absent
  # tag for a service with nothing to do abort the whole deploy.
  #
  # That is not hypothetical: until the ledger has a row per service everything
  # resolves through LAST_PUBLISHED_GIT_SHA, and that SHA was only ever pushed for
  # the services the publish job actually rebuilt. Every other service points at a
  # tag that was never created, while already running exactly the right image.
  if [ "$RUNNING" = "$DESIRED" ]; then
    echo "up-to-date"
    return 0
  fi

  if [ "$IMAGE_EXISTS" != "true" ]; then
    echo "missing-image"
    return 0
  fi

  if [ "$WOULD_ROLL_BACK" = "true" ] && [ "$DEPLOY_ALLOW_ROLLBACK" != "true" ]; then
    echo "behind"
    return 0
  fi

  echo "deploy"
}

# Verdicts that must stop the deploy before it touches the cluster.
verdict_is_blocking()
{
  case "$1" in
    unpublished|stale-build|missing-image) return 0 ;;
    *) return 1 ;;
  esac
}

# Verdicts worth a warning but not a failure.
verdict_is_warning()
{
  case "$1" in
    unresolved|behind) return 0 ;;
    *) return 1 ;;
  esac
}

# One line of explanation per verdict, printed next to the service in the plan so
# the CI log is self-explanatory without anyone opening this file.
verdict_explanation()
{
  case "$1" in
    deploy)        echo "running tag differs from the published tag" ;;
    up-to-date)    echo "already running the published tag" ;;
    behind)        echo "published tag is older than what is running — set DEPLOY_ALLOW_ROLLBACK=true to force" ;;
    stale-build)   echo "sources changed after this image was published — re-run the stage build" ;;
    missing-image) echo "published tag is not in the registry — the stage publish did not complete" ;;
    unpublished)   echo "changed in this merge but has never been published" ;;
    unresolved)    echo "no published tag on record; unchanged in this merge, so left as-is" ;;
    *)             echo "unknown verdict" ;;
  esac
}
