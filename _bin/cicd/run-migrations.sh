#!/bin/bash

# Automated database migrations on production deploy.
#
# Runs `npm run migrations:run` (knex `migrate:latest`) inside the freshly
# rolled-out service pod for every backend service whose migration files
# changed in this deploy. It reuses the already-running pod because that pod
# already has the Cloud SQL Auth Proxy sidecar and DB secrets wired up — so no
# separate Job, sidecar-lifecycle juggling, or DB credentials in the CI runner
# are required.
#
# Ordering: this runs AFTER deploy.sh has applied the rendered manifests (i.e.
# the new image is already rolling out). Migrations MUST therefore be additive /
# expand-contract — the long-standing convention in this repo — so the new
# code tolerates the pre-migration schema during the brief rollout window, and
# old code (if any lingers) tolerates the post-migration schema. This mirrors
# the previous manual process, which also ran `migrations:run` after deploy.
#
# Scope: only runs on `main` (production). Stage and feature branches are
# untouched. Only the services that own knex migrations are considered — see
# THERR_MIGRATABLE_SERVICES in _bin/lib/service-registry.sh — and each is skipped
# unless its own `src/store/migrations` directory changed across the version range
# the service actually moved through in this deploy. `migrate:latest` is
# idempotent, so a re-run is always safe.
#
# WHY NOT `git diff HEAD^1`
#
# That range describes the merge, not the service. A deploy that skipped a service
# — because a previous run aborted, or because stage->main was fast-forwarded —
# left its migrations unrun, and the next deploy's HEAD^1 range no longer contained
# the commit that added them, so they stayed unrun with a green build. deploy.sh
# now hands over the tags each service moved between, and the range is taken from
# those: whatever the service is actually catching up on gets migrated, however
# many deploys ago it landed.
#
# The HEAD^1 behaviour remains as the fallback for when the plan file is absent
# (running this script by hand, or from an older deploy.sh).
#
# WHY ONE SERVICE'S FAILURE NO LONGER ENDS THE RUN
#
# Under `set -e` a single failing `kubectl rollout status` used to kill this script
# outright, so a service that was merely slow to come up also took the migrations of
# every service after it in the loop. Each service is now isolated: its failure is
# recorded and the loop continues, and the script exits non-zero at the end with all
# of them named. Nothing is skipped because something unrelated broke first.
#
# WHY THERE IS A VERIFY PASS
#
# The in-range diff above answers "did this deploy add migrations", which is not the
# same question as "is the schema caught up with the code now running". On 2026-09-20
# they diverged: deploy_waves failed on an unrelated ImagePullBackOff, `set -e` ended
# the deploy job before it reached this script at all, and users-service sat on the
# savings build against a pre-savings schema. Every Friends with Habits check-in 500'd
# on `column "savedAmount" of relation "habit_checkins" does not exist` for two days,
# and the deploy that caused it had already reported red for a reason that named none
# of this. `verify_no_pending_migrations` asks each running pod directly, whatever the
# plan says and whichever deploy left the work behind.
#
# Opt-out: set RUN_MIGRATIONS_ON_DEPLOY=false in the CI environment to skip
# entirely and fall back to running `npm run migrations:run` by hand.
#
# STANDALONE USE
#
#   ./_bin/cicd/run-migrations.sh --all
#   ./_bin/cicd/run-migrations.sh --service users-service
#
# Runs against whatever cluster kubectl currently points at, with no plan file and
# no branch gate, which is the supported recovery path when a deploy died before its
# migration step. `--verify-only` reports what is outstanding without applying it.

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh
source ./_bin/lib/service-registry.sh

CURRENT_BRANCH=${CICD_BRANCH:-$CIRCLE_BRANCH}
ROLLOUT_TIMEOUT="${MIGRATION_ROLLOUT_TIMEOUT:-180s}"
DEPLOY_PLAN_FILE="${DEPLOY_PLAN_FILE:-.deploy-plan.tsv}"

# Set by deploy.sh to the migratable services that actually reached their desired
# tag. A partial rollout failure leaves the rest on their previous image, and
# migrating underneath those is the one thing the deploy's wave ordering exists to
# avoid.
#
# Set-but-empty and unset mean opposite things, so they are distinguished here
# rather than collapsed with `${VAR:-}`. deploy.sh always exports it, and an empty
# value from deploy.sh means *nothing* rolled — the case where migrating everything
# would be exactly wrong. Unset (a standalone run, or an older deploy.sh) means
# there is no restriction to apply.
MIGRATE_SCOPE_RESTRICTED="${MIGRATE_ONLY_SERVICES+true}"
MIGRATE_ONLY_SERVICES="${MIGRATE_ONLY_SERVICES:-}"

usage()
{
  cat <<'EOF'
Usage: ./_bin/cicd/run-migrations.sh [options]

With no options, behaves as the deploy step: runs only on `main`, and migrates
each service the deploy plan says moved through new migration files.

  --service <key>   Migrate one service by registry key (repeatable). Implies
                    standalone mode: no branch gate, no deploy plan.
  --all             Migrate every service in THERR_MIGRATABLE_SERVICES, whether
                    or not this deploy moved it. Implies standalone mode.
  --verify-only     Report services with pending migrations; apply nothing.
  --help            Show this message.

Standalone mode runs against the cluster kubectl currently points at. Use it to
recover when a deploy failed before reaching its migration step:

  ./_bin/cicd/run-migrations.sh --service users-service
EOF
}

# Echoes "<previous-tag>|<desired-tag>|<verdict>" for a service from the deploy
# plan, or nothing when there is no plan file / no row for it.
plan_row_for()
{
  [ -f "$DEPLOY_PLAN_FILE" ] || return 0

  # Re-emitted '|'-separated rather than joined on whitespace. The running tag is
  # legitimately empty — a Deployment that does not exist yet, or a `kubectl get`
  # that failed while the plan was computed — and `read` discards leading empty
  # fields for any IFS made only of whitespace, tabs included. Joined on a space or
  # a tab the row then parses one column short: the verdict lands in $DESIRED,
  # $VERDICT comes back empty, and the service is silently handed back to the HEAD^1
  # merge diff this script exists to stop using. '|' cannot occur in a SHA or a
  # verdict, so it survives the round trip.
  awk -F'\t' -v key="$1" '$1 == key { printf "%s|%s|%s\n", $2, $3, $4; exit }' "$DEPLOY_PLAN_FILE"
}

# Whether this service has migrations to run in this deploy.
migrations_pending_for()
{
  local KEY=$1
  local SERVICE_DIR=$2
  local MIGRATIONS_DIR="$SERVICE_DIR/src/store/migrations"

  local ROW PREVIOUS DESIRED VERDICT
  ROW="$(plan_row_for "$KEY")"
  IFS='|' read -r PREVIOUS DESIRED VERDICT <<< "$ROW"

  if [ -z "$VERDICT" ]; then
    printMessageWarning "No deploy plan row for $KEY — falling back to the merge diff."
    has_prev_diff_changes "$MIGRATIONS_DIR"
    return $?
  fi

  # A service the deploy did not move cannot have new migrations to run: whatever
  # it is running now, it was already running before this deploy started.
  if [ "$VERDICT" != "deploy" ]; then
    return 1
  fi

  # A first-ever rollout, or a previous tag no longer resolvable, leaves no range
  # to inspect. `migrate:latest` is idempotent, so the safe direction is to run.
  if [ -z "$PREVIOUS" ] || ! git cat-file -e "${PREVIOUS}^{commit}" 2>/dev/null; then
    printMessageWarning "No resolvable previous version for $KEY — running migrations to be safe."
    return 0
  fi

  sources_changed_between "$PREVIOUS" "$DESIRED" "$MIGRATIONS_DIR"
}

# Whether deploy.sh cleared this service to be migrated. With no restriction in
# force, every migratable service is in scope; with one, only those named are —
# including when none are.
service_in_scope()
{
  local KEY=$1
  local ALLOWED

  [ "$MIGRATE_SCOPE_RESTRICTED" = "true" ] || return 0

  for ALLOWED in $MIGRATE_ONLY_SERVICES; do
    [ "$ALLOWED" = "$KEY" ] && return 0
  done

  return 1
}

# Echoes the name of a running pod for a service, or nothing.
pod_for()
{
  local COMPONENT=$1

  kubectl get pods -l "component=$COMPONENT" \
    --field-selector=status.phase=Running \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true
}

run_service_migrations()
{
  local KEY=$1
  local SERVICE_DIR
  local DEPLOYMENT
  local COMPONENT

  SERVICE_DIR="$(service_dir "$KEY")"
  DEPLOYMENT="$(service_deployment "$KEY")"
  COMPONENT="$(service_container "$KEY")"

  printMessageNeutral "Waiting for $DEPLOYMENT rollout before migrating..."
  if ! kubectl rollout status "deployment/$DEPLOYMENT" --timeout="$ROLLOUT_TIMEOUT"; then
    printMessageError "$DEPLOYMENT never finished rolling out — not migrating $SERVICE_DIR."
    return 1
  fi

  local POD
  POD="$(pod_for "$COMPONENT")"

  if [ -z "$POD" ]; then
    printMessageError "No running pod found for $COMPONENT — cannot run migrations."
    return 1
  fi

  printMessageNeutral "Running migrations for $SERVICE_DIR in pod $POD..."
  if ! kubectl exec "$POD" -c "$COMPONENT" -- npm run migrations:run; then
    printMessageError "Migrations failed for $SERVICE_DIR."
    return 1
  fi

  printMessageSuccess "Migrations complete for $SERVICE_DIR."
}

# Echoes the number of migration files the pod's code carries that the database has
# not applied. Echoes `unsupported` for a pod whose image predates the
# `migrations:status` script, and nothing when the answer could not be determined.
#
# Parsed from `knex migrate:list`, which prints "Found N Pending Migration
# file/files." when work is outstanding and "No Pending Migration files Found." when
# it is not — never "Found 0 ..." (knex 3.x bin/utils/migrationsLister.js). Missing
# the second form would read every caught-up service as unknown and fail every
# deploy. Deliberately fails closed: an unrecognised format echoes
# nothing and the caller treats that as an assertion failure rather than as zero.
# A silent "0 pending" from a parse that stopped matching would be the same shape of
# false green this whole pass exists to catch.
#
# `unsupported` is separated from that on purpose, and is the only one of the three
# that is not a problem. Until this change has rolled everywhere, a service the
# deploy did not move is still serving an image built before `migrations:status`
# existed; npm answers `Missing script` and the pod is telling the truth about its
# own age, not failing a check.
pending_migration_count()
{
  local POD=$1
  local COMPONENT=$2
  local OUTPUT

  OUTPUT="$(kubectl exec "$POD" -c "$COMPONENT" -- npm run migrations:status 2>&1)" || true

  if printf '%s\n' "$OUTPUT" | grep -qi 'missing script'; then
    printf 'unsupported\n'
    return 0
  fi

  printf '%s\n' "$OUTPUT" \
    | sed -n \
      -e 's/.*Found \([0-9][0-9]*\) Pending Migration.*/\1/p' \
      -e 's/.*No Pending Migration files Found.*/0/p' \
    | tail -n 1
}

# Asserts that no migratable service is running code whose migrations are unapplied.
#
# Independent of the deploy plan on purpose. The plan answers "did *this* deploy add
# migrations"; this answers "is the schema caught up with what is running right now",
# which is the question the 2026-09-20 outage turned on — the migrations that were
# missing had been added by a deploy that had already reported done.
#
# Echoes the services still outstanding. Returns non-zero if any could not be checked.
verify_no_pending_migrations()
{
  local KEY
  local UNCHECKED=0

  for KEY in $THERR_MIGRATABLE_SERVICES; do
    local COMPONENT
    COMPONENT="$(service_container "$KEY")"

    local POD
    POD="$(pod_for "$COMPONENT")"

    if [ -z "$POD" ]; then
      # The rollout failure that caused this already fails the deploy; saying the
      # schema is fine because nothing was there to ask would not.
      printMessageWarning "No running pod for $COMPONENT — could not verify its schema is caught up."
      UNCHECKED=1
      continue
    fi

    local COUNT
    COUNT="$(pending_migration_count "$POD" "$COMPONENT")"

    if [ "$COUNT" = "unsupported" ]; then
      printMessageWarning "$COMPONENT is running an image that predates 'migrations:status' — skipping its schema check."
      continue
    fi

    if [ -z "$COUNT" ]; then
      printMessageError "Could not read pending migrations for $KEY (does knex still print 'Found N Pending Migration' / 'No Pending Migration files Found'?)."
      UNCHECKED=1
      continue
    fi

    if [ "$COUNT" -gt 0 ]; then
      printMessageError "$KEY is running code with $COUNT unapplied migration(s)."
      PENDING_SERVICES+=("$KEY ($COUNT)")
      continue
    fi

    printMessageSuccess "$KEY: schema is caught up."
  done

  return $UNCHECKED
}

main()
{
  local STANDALONE=false
  local VERIFY_ONLY=false
  local SELECTED=""

  while [ $# -gt 0 ]; do
    case "$1" in
      --service)
        [ -n "$2" ] || { printMessageError "--service needs a registry key."; return 1; }
        SELECTED="$SELECTED $2"
        STANDALONE=true
        shift 2
        ;;
      --all)
        STANDALONE=true
        shift
        ;;
      --verify-only)
        VERIFY_ONLY=true
        STANDALONE=true
        shift
        ;;
      --help|-h)
        usage
        return 0
        ;;
      *)
        printMessageError "Unknown option: $1"
        usage
        return 1
        ;;
    esac
  done

  if [ "$STANDALONE" != "true" ]; then
    if [ "$RUN_MIGRATIONS_ON_DEPLOY" = "false" ]; then
      printMessageWarning "RUN_MIGRATIONS_ON_DEPLOY=false — skipping automated migrations."
      return 0
    fi

    if [ "$CURRENT_BRANCH" != "main" ]; then
      printMessageNeutral "Not on main ($CURRENT_BRANCH) — skipping automated migrations."
      return 0
    fi
  fi

  # A standalone run has no deploy plan to consult and no rollout in flight, so the
  # in-range gate below would have nothing to say. `migrate:latest` is idempotent,
  # so running unconditionally is both correct and the point of the flag.
  local KEYS="${SELECTED:-$THERR_MIGRATABLE_SERVICES}"
  local FAILED=()
  PENDING_SERVICES=()

  if [ "$VERIFY_ONLY" != "true" ]; then
    printMessageNeutral "Starting automated database migrations..."

    local KEY
    for KEY in $KEYS; do
      if [ "$STANDALONE" != "true" ]; then
        if ! service_in_scope "$KEY"; then
          printMessageWarning "$KEY did not reach its intended version in this deploy — not migrating underneath it."
          continue
        fi

        local SERVICE_DIR
        SERVICE_DIR="$(service_dir "$KEY")"

        if ! migrations_pending_for "$KEY" "$SERVICE_DIR"; then
          printMessageNeutral "No migration changes for $SERVICE_DIR — skipping."
          continue
        fi
      fi

      # Isolated deliberately: one service being slow to come up must not take the
      # migrations of every service after it in this loop.
      if ! run_service_migrations "$KEY"; then
        FAILED+=("$KEY")
      fi
    done
  fi

  printMessageNeutral "Verifying every service's schema is caught up with the code it is running..."
  local VERIFY_INCOMPLETE=false
  verify_no_pending_migrations || VERIFY_INCOMPLETE=true

  if [ ${#PENDING_SERVICES[@]} -gt 0 ]; then
    printMessageError "These services are running code ahead of their schema:"
    local PROBLEM
    for PROBLEM in "${PENDING_SERVICES[@]}"; do
      printMessageError "  - $PROBLEM"
    done
    printMessageError "Recover with: ./_bin/cicd/run-migrations.sh --service <key>"
    return 1
  fi

  if [ ${#FAILED[@]} -gt 0 ]; then
    printMessageError "Migrations failed for: ${FAILED[*]}"
    return 1
  fi

  if [ "$VERIFY_INCOMPLETE" = "true" ]; then
    printMessageWarning "Some services could not be verified — see the warnings above."
    return 1
  fi

  printMessageSuccess "All applicable service migrations complete."
}

main "$@"
