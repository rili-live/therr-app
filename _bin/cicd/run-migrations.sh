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
# untouched. Only the five services that own knex migrations are considered,
# and each is skipped unless its own `src/store/migrations` directory changed
# in this deploy (detected via the same `has_prev_diff_changes` helper the
# build/deploy scripts already use). `migrate:latest` is idempotent, so a
# re-run is always safe.
#
# Opt-out: set RUN_MIGRATIONS_ON_DEPLOY=false in the CI environment to skip
# entirely and fall back to running `npm run migrations:run` by hand.

set -e

source ./_bin/lib/colorize.sh
source ./_bin/lib/has_diff_changes.sh

CURRENT_BRANCH=${CICD_BRANCH:-$CIRCLE_BRANCH}
ROLLOUT_TIMEOUT="${MIGRATION_ROLLOUT_TIMEOUT:-180s}"

# Services that own knex migrations.
# Format: "<service-dir>|<deployment-name>|<container/component>"
MIGRATABLE_SERVICES=(
  "therr-services/users-service|users-service-deployment|server-users"
  "therr-services/maps-service|maps-service-deployment|server-maps"
  "therr-services/messages-service|messages-service-deployment|server-messages"
  "therr-services/reactions-service|reactions-service-deployment|server-reactions"
  "therr-services/push-notifications-service|push-notifications-service-deployment|server-push-notifications"
)

run_service_migrations()
{
  local SERVICE_DIR=$1
  local DEPLOYMENT=$2
  local COMPONENT=$3

  # Only run when this service's migration files changed in the deploy.
  if ! has_prev_diff_changes "$SERVICE_DIR/src/store/migrations"; then
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

  local ENTRY SERVICE_DIR DEPLOYMENT COMPONENT
  for ENTRY in "${MIGRATABLE_SERVICES[@]}"; do
    IFS='|' read -r SERVICE_DIR DEPLOYMENT COMPONENT <<< "$ENTRY"
    run_service_migrations "$SERVICE_DIR" "$DEPLOYMENT" "$COMPONENT"
  done

  printMessageSuccess "All applicable service migrations complete."
}

main
