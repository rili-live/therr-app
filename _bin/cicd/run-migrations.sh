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
# Ordering: this runs AFTER `kubectl set image` in deploy.sh (i.e. the new
# image is already rolling out). Migrations MUST therefore be additive /
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
# Opt-out: set RUN_MIGRATIONS_ON_DEPLOY=false in the CI environment to skip
# entirely and fall back to running `npm run migrations:run` by hand.

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh
source ./_bin/lib/service-registry.sh

CURRENT_BRANCH=${CICD_BRANCH:-$CIRCLE_BRANCH}
ROLLOUT_TIMEOUT="${MIGRATION_ROLLOUT_TIMEOUT:-180s}"
DEPLOY_PLAN_FILE="${DEPLOY_PLAN_FILE:-.deploy-plan.tsv}"

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

run_service_migrations()
{
  local KEY=$1
  local SERVICE_DIR
  local DEPLOYMENT
  local COMPONENT

  SERVICE_DIR="$(printf '%s' "$(service_sources "$KEY")" | cut -d' ' -f1)"
  DEPLOYMENT="$(service_deployment "$KEY")"
  COMPONENT="$(service_container "$KEY")"

  if ! migrations_pending_for "$KEY" "$SERVICE_DIR"; then
    printMessageNeutral "No migration changes for $SERVICE_DIR — skipping."
    return 0
  fi

  printMessageNeutral "Waiting for $DEPLOYMENT rollout before migrating..."
  kubectl rollout status "deployment/$DEPLOYMENT" --timeout="$ROLLOUT_TIMEOUT"

  local POD
  POD=$(kubectl get pods -l "component=$COMPONENT" \
    --field-selector=status.phase=Running \
    -o jsonpath='{.items[0].metadata.name}')

  if [ -z "$POD" ]; then
    printMessageError "No running pod found for $COMPONENT — cannot run migrations."
    return 1
  fi

  printMessageNeutral "Running migrations for $SERVICE_DIR in pod $POD..."
  kubectl exec "$POD" -c "$COMPONENT" -- npm run migrations:run
  printMessageSuccess "Migrations complete for $SERVICE_DIR."
}

main()
{
  if [ "$RUN_MIGRATIONS_ON_DEPLOY" = "false" ]; then
    printMessageWarning "RUN_MIGRATIONS_ON_DEPLOY=false — skipping automated migrations."
    return 0
  fi

  if [ "$CURRENT_BRANCH" != "main" ]; then
    printMessageNeutral "Not on main ($CURRENT_BRANCH) — skipping automated migrations."
    return 0
  fi

  printMessageNeutral "Starting automated database migrations..."

  local KEY
  for KEY in $THERR_MIGRATABLE_SERVICES; do
    run_service_migrations "$KEY"
  done

  printMessageSuccess "All applicable service migrations complete."
}

main
