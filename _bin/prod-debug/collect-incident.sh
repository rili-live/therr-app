#!/usr/bin/env bash
#
# collect-incident.sh — Concise, redacted production incident digest for Claude.
#
# Purpose
#   When a bug or bad deploy is discovered in production, run this ONE command
#   to produce a small, self-contained Markdown digest of "what's going wrong"
#   right now — pod health, deploy/rollout events, deployed image SHAs, and the
#   recent error/warning logs across every service (deduplicated and capped).
#   Then point Claude at the resulting file:  .prod-debug/incident-<ts>.md
#
# Design goals (see docs/PROD_DEBUG_CLAUDE.md)
#   - Zero new infrastructure. Reads logs that GKE already ships to Google
#     Cloud Logging (free tier) plus live `kubectl`. Nothing runs continuously.
#   - Zero added runtime cost / perf overhead on the cluster. Read-only queries.
#   - Secure: the operator runs it with their OWN existing gcloud/kubectl
#     credentials. Claude never holds production credentials. Output is
#     redacted (JWTs, emails, tokens, secrets) before it is written to disk.
#   - Concise: deduplicated, grouped by service, hard line cap so the digest
#     fits comfortably in a Claude context window.
#
# Usage
#   _bin/prod-debug/collect-incident.sh                 # last 30m, default mode
#   _bin/prod-debug/collect-incident.sh 2h              # widen the time window
#   _bin/prod-debug/collect-incident.sh 15m --live      # add live pod log tails
#   _bin/prod-debug/collect-incident.sh 1h --deploy     # focus on latest rollout
#   _bin/prod-debug/collect-incident.sh --cloud-run     # ALSO digest the GCP
#                                                       # Cloud Run functions
#   _bin/prod-debug/collect-incident.sh 6h --cloud-run=messaging-automator
#
# Cloud Run functions (--cloud-run)
#   The two automators (ai-automator, messaging-automator) run OUTSIDE the GKE
#   cluster, fired by Cloud Scheduler — daily-ish, not continuously. So the
#   default 30m window almost never contains an invocation. This section
#   therefore does NOT go quiet when the window is empty: it falls back to the
#   most recent invocation within THERR_CLOUD_RUN_LOOKBACK (default 30d, the
#   Cloud Logging _Default retention) and says how long ago that was. A missing
#   run is itself the signal you usually came looking for.
#
# Backends (auto-detected, degrades gracefully)
#   - gcloud   -> Google Cloud Logging (history survives pod restarts; preferred
#                 for post-deploy debugging where the crashed pod is already gone),
#                 plus Cloud Run function logs and Cloud Scheduler job state
#   - kubectl  -> live cluster state, pod status, rollout events, log tails
#
set -uo pipefail

# ----------------------------------------------------------------------------
# Config (override via env)
# ----------------------------------------------------------------------------
GCP_PROJECT="${THERR_GCP_PROJECT:-therr-app}"
GCP_REGION="${THERR_GCP_REGION:-us-central1}"
NAMESPACE="${THERR_K8S_NAMESPACE:-default}"
MAX_LOG_LINES="${THERR_MAX_LOG_LINES:-120}"   # cap on deduped error lines emitted
OUT_DIR="${THERR_PROD_DEBUG_DIR:-.prod-debug}"

# Cloud Run functions (--cloud-run). These are scheduled, not continuous, so
# they get their own lookback: how far back to hunt for the LAST invocation when
# the incident window turns up nothing.
CLOUD_RUN_FUNCTIONS="${THERR_CLOUD_RUN_FUNCTIONS:-ai-automator messaging-automator}"
CLOUD_RUN_LOOKBACK="${THERR_CLOUD_RUN_LOOKBACK:-30d}"  # _Default log bucket retention
CLOUD_RUN_TAIL="${THERR_CLOUD_RUN_TAIL:-80}"           # log lines kept per invocation

WINDOW="30m"
MODE="incident"   # incident | live | deploy
INCLUDE_CLOUD_RUN=false

for arg in "$@"; do
  case "$arg" in
    --live)   MODE="live" ;;
    --deploy) MODE="deploy" ;;
    # --cloud-run is ADDITIVE — it appends a section, it does not replace the
    # cluster ones, so one digest can correlate a function failure with what the
    # in-cluster services were doing at the same moment.
    --cloud-run|--cloud-functions|--gcf) INCLUDE_CLOUD_RUN=true ;;
    --cloud-run=*|--cloud-functions=*|--gcf=*)
      INCLUDE_CLOUD_RUN=true
      CLOUD_RUN_FUNCTIONS="${arg#*=}"
      CLOUD_RUN_FUNCTIONS="${CLOUD_RUN_FUNCTIONS//,/ }" ;;
    --*)      echo "Unknown flag: $arg" >&2; exit 2 ;;
    *)        WINDOW="$arg" ;;   # first bare arg is the time window (e.g. 30m, 2h)
  esac
done

HAS_GCLOUD=false; command -v gcloud  >/dev/null 2>&1 && HAS_GCLOUD=true
HAS_KUBECTL=false; command -v kubectl >/dev/null 2>&1 && HAS_KUBECTL=true
HAS_JQ=false;      command -v jq      >/dev/null 2>&1 && HAS_JQ=true

if ! $HAS_GCLOUD && ! $HAS_KUBECTL; then
  echo "ERROR: neither gcloud nor kubectl found on PATH. Install/authenticate one." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$OUT_DIR/incident-$TS.md"

# ----------------------------------------------------------------------------
# Redaction — applied to EVERYTHING written to the digest.
# Masks credentials/PII that may appear in log lines. The app already redacts
# known body keys server-side; this is defense-in-depth for anything that slips
# through (stack traces, ad-hoc console.error, connection strings, etc.).
# ----------------------------------------------------------------------------
redact() {
  sed -E \
    -e 's/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/[REDACTED_JWT]/g' \
    -e 's/(Bearer|bearer|Basic)[[:space:]]+[A-Za-z0-9._~+\/=-]{12,}/\1 [REDACTED_TOKEN]/g' \
    -e 's/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/[REDACTED_EMAIL]/g' \
    -e 's/(password|passwd|secret|api[_-]?key|token|authorization|access[_-]?token|refresh[_-]?token|idtoken|client[_-]?secret|signing[_-]?secret)([\"'"'"']?[[:space:]]*[:=][[:space:]]*[\"'"'"']?)[^\",'"'"'[:space:]]+/\1\2[REDACTED]/gI' \
    -e 's/(postgres|postgresql|redis|mongodb|mysql):\/\/[^[:space:]"]*/\1:\/\/[REDACTED_CONN_STRING]/g' \
    -e 's/\b[A-Za-z0-9._%+-]{0,8}(sk_live|rk_live|whsec|AKIA)[A-Za-z0-9]{6,}/[REDACTED_SECRET]/g'
}

# Collapse near-duplicate log lines: strip volatile tokens (timestamps, ids,
# uuids, long numbers) so the same error from many requests groups into one row
# with a count, newest-first, then hard-capped.
dedup_top() {
  awk '{ n=$0;
         gsub(/[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9:.,Z+-]+/,"<ts>",n);
         gsub(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,"<uuid>",n);
         gsub(/[0-9]{5,}/,"<n>",n);
         print n }' \
    | sort | uniq -c | sort -rn | head -n "$MAX_LOG_LINES"
}

section() { printf '\n## %s\n\n' "$1" >>"$OUT"; }
subsection() { printf '\n### %s\n\n' "$1" >>"$OUT"; }
codeblock_start() { printf '```%s\n' "${1:-}" >>"$OUT"; }
codeblock_end()   { printf '```\n' >>"$OUT"; }

# `gcloud logging read --order=desc` gives newest-first, which is right for a
# dedup roll-up but backwards for reading a single invocation start-to-finish.
# `tac` is GNU-only and `tail -r` is BSD-only; awk is neither.
reverse_lines() { awk '{ a[NR] = $0 } END { for (i = NR; i > 0; i--) print a[i] }'; }

# RFC3339 (2026-08-07T12:34:56.789Z) -> epoch seconds. GNU date first, then BSD
# date (macOS, where most operators run this). Empty on failure; callers degrade.
epoch_of() {
  local ts="${1%%.*}"; ts="${ts%Z}"
  date -u -d "${ts}Z" +%s 2>/dev/null \
    || date -u -j -f '%Y-%m-%dT%H:%M:%S' "$ts" +%s 2>/dev/null \
    || echo ""
}

human_age() {
  local secs="${1:-}"
  [ -z "$secs" ] && { echo "age unknown"; return; }
  local d=$(( secs / 86400 )) h=$(( (secs % 86400) / 3600 )) m=$(( (secs % 3600) / 60 ))
  if   [ "$d" -gt 0 ]; then echo "${d}d ${h}h ago"
  elif [ "$h" -gt 0 ]; then echo "${h}h ${m}m ago"
  else                      echo "${m}m ago"
  fi
}

# One filter matching a function under BOTH resource types: Gen-1 Cloud Functions
# log as `cloud_function`, while Gen-2 / "Cloud Run functions" log as
# `cloud_run_revision`. Ours are Gen-1 today; this keeps the script working
# through a migration without an edit.
cf_filter() {
  printf '(resource.type="cloud_function" AND resource.labels.function_name="%s") OR (resource.type="cloud_run_revision" AND resource.labels.service_name="%s")' "$1" "$1"
}

# cf_read <filter> <freshness> <limit>  ->  "timestamp | severity | message" lines, newest-first
cf_read() {
  if $HAS_JQ; then
    gcloud logging read "$1" \
        --project="$GCP_PROJECT" --freshness="$2" --order=desc --limit="$3" --format=json 2>/dev/null \
      | jq -r '.[] | [ (.timestamp // "?"), (.severity // "?"),
                       ( .textPayload // .jsonPayload.message // (.jsonPayload|tostring) // "" ) ]
                     | @tsv' 2>/dev/null \
      | sed -E 's/\t/ | /g'
  else
    gcloud logging read "$1" \
        --project="$GCP_PROJECT" --freshness="$2" --order=desc --limit="$3" \
        --format='value(timestamp, severity, textPayload)' 2>/dev/null \
      | sed -E 's/\t/ | /g'
  fi
}

# ----------------------------------------------------------------------------
# Header
# ----------------------------------------------------------------------------
KCTX="$($HAS_KUBECTL && kubectl config current-context 2>/dev/null || echo 'n/a')"
{
  echo "# Production incident digest"
  echo
  echo "- Generated (UTC): $TS"
  echo "- Window: last $WINDOW"
  echo "- Mode: $MODE"
  echo "- GCP project: $GCP_PROJECT"
  echo "- kube-context: $KCTX (namespace: $NAMESPACE)"
  echo "- Backends: gcloud=$HAS_GCLOUD kubectl=$HAS_KUBECTL jq=$HAS_JQ"
  if $INCLUDE_CLOUD_RUN; then
    echo "- Cloud Run functions: $CLOUD_RUN_FUNCTIONS (region $GCP_REGION, lookback $CLOUD_RUN_LOOKBACK)"
  else
    echo "- Cloud Run functions: not included (re-run with --cloud-run)"
  fi
  echo
  echo "> All content below is redacted. Hand this file to Claude:"
  echo "> \"Here is a prod incident digest — $OUT — tell me the likely root cause.\""
} >"$OUT"

# ----------------------------------------------------------------------------
# 1. Pod health (restarts / non-Running) — the fastest signal of a bad deploy
# ----------------------------------------------------------------------------
if $HAS_KUBECTL; then
  section "Pod health"
  codeblock_start
  kubectl get pods -n "$NAMESPACE" -o wide 2>&1 | redact >>"$OUT"
  codeblock_end

  # Deployed image tags (== git SHA of the running build) for correlation.
  section "Deployed images (SHA per deployment)"
  codeblock_start
  kubectl get deployments -n "$NAMESPACE" \
    -o 'custom-columns=DEPLOYMENT:.metadata.name,IMAGE:.spec.template.spec.containers[0].image,READY:.status.readyReplicas,DESIRED:.spec.replicas' \
    2>&1 | redact >>"$OUT"
  codeblock_end
fi

# ----------------------------------------------------------------------------
# 2. Recent cluster events (crashloops, OOMKills, failed scheduling, rollouts)
# ----------------------------------------------------------------------------
if $HAS_KUBECTL; then
  section "Recent cluster events (warnings first)"
  codeblock_start
  kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' 2>&1 \
    | grep -Ei 'warning|error|fail|backoff|oom|killed|unhealthy|evict|crashloop' \
    | tail -n 40 | redact >>"$OUT" \
    || echo "(no warning/error events)" >>"$OUT"
  codeblock_end
fi

# ----------------------------------------------------------------------------
# 3. Deploy focus (--deploy): rollout status per deployment
# ----------------------------------------------------------------------------
if [ "$MODE" = "deploy" ] && $HAS_KUBECTL; then
  section "Rollout status"
  codeblock_start
  for d in $(kubectl get deployments -n "$NAMESPACE" -o name 2>/dev/null); do
    echo "--- $d ---"
    kubectl rollout status "$d" -n "$NAMESPACE" --timeout=5s 2>&1 | redact
    kubectl rollout history "$d" -n "$NAMESPACE" 2>&1 | tail -n 4 | redact
  done >>"$OUT"
  codeblock_end
fi

# ----------------------------------------------------------------------------
# 4. Error/Warning logs — the core context
#    App code logs many errors via printLogs -> console.info (INFO severity),
#    so we match BOTH severity>=WARNING AND error-shaped text, then dedup.
# ----------------------------------------------------------------------------
ERR_REGEX='error|exception|unhandled|rejection|traceback|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EAI_AGAIN|statusCode":5|" 5[0-9][0-9] |FATAL|panic'

# A Cloud Logging filter embeds this pattern inside a double-quoted literal, so a
# bare `"` in the pattern terminates that literal and gcloud rejects the whole
# filter ("Unparseable filter: syntax error"), silently emptying the log section
# of every digest. The `"` in the two HTTP-status alternatives is matched with
# `.` instead, which keeps them working without needing to survive two rounds of
# quoting on the way to gcloud.
ERR_REGEX_REMOTE="${ERR_REGEX//\"/.}"

section "Top error / warning log lines (deduplicated, newest-first)"
if $HAS_GCLOUD; then
  echo "_Source: Google Cloud Logging (survives pod restarts)._" >>"$OUT"
  codeblock_start
  # severity>=WARNING OR text matches an error shape; k8s container stdout/stderr.
  FILTER="resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"$NAMESPACE\" AND (severity>=WARNING OR textPayload=~\"$ERR_REGEX_REMOTE\" OR jsonPayload.message=~\"$ERR_REGEX_REMOTE\")"
  if $HAS_JQ; then
    gcloud logging read "$FILTER" \
        --project="$GCP_PROJECT" --freshness="$WINDOW" \
        --order=desc --limit=1500 --format=json 2>>"$OUT" \
      | jq -r '.[] | [ (.resource.labels.container_name // "?"), (.severity // "?"),
                       ( .textPayload // .jsonPayload.message // (.jsonPayload|tostring) // "" ) ]
                     | @tsv' 2>/dev/null \
      | sed -E 's/\t/ | /g' \
      | redact | dedup_top >>"$OUT"
  else
    gcloud logging read "$FILTER" \
        --project="$GCP_PROJECT" --freshness="$WINDOW" \
        --order=desc --limit=1500 \
        --format='value(resource.labels.container_name, severity, textPayload)' 2>>"$OUT" \
      | redact | dedup_top >>"$OUT"
  fi
  codeblock_end
elif $HAS_KUBECTL; then
  echo "_Source: live kubectl logs (gcloud not available; history limited to current pods)._" >>"$OUT"
  codeblock_start
  # Translate the window (e.g. 30m/2h) into kubectl's --since.
  for p in $(kubectl get pods -n "$NAMESPACE" -o name 2>/dev/null); do
    kubectl logs "$p" -n "$NAMESPACE" --since="$WINDOW" --all-containers=true 2>/dev/null \
      | grep -Ei "$ERR_REGEX" \
      | sed "s|^|${p#pod/} \| |"
  done | redact | dedup_top >>"$OUT"
  codeblock_end
fi

# ----------------------------------------------------------------------------
# 5. Live tails (--live): current + previous container logs for crashloops
# ----------------------------------------------------------------------------
if [ "$MODE" = "live" ] && $HAS_KUBECTL; then
  section "Live tails of unhealthy pods (current + previous)"
  for p in $(kubectl get pods -n "$NAMESPACE" \
              --field-selector=status.phase!=Running -o name 2>/dev/null); do
    printf '\n### %s\n' "${p#pod/}" >>"$OUT"
    codeblock_start
    echo "--- previous container (pre-restart) ---" >>"$OUT"
    kubectl logs "$p" -n "$NAMESPACE" --previous --tail=40 2>/dev/null | redact >>"$OUT" \
      || echo "(no previous container)" >>"$OUT"
    echo "--- current container ---" >>"$OUT"
    kubectl logs "$p" -n "$NAMESPACE" --tail=40 2>/dev/null | redact >>"$OUT"
    codeblock_end
  done
fi

# ----------------------------------------------------------------------------
# 6. Cloud Run functions (--cloud-run): the scheduled work outside the cluster
#    ai-automator and messaging-automator are fired by Cloud Scheduler, so a
#    30m window is almost always empty for them. Rather than emitting nothing,
#    each function falls back to its most recent invocation within
#    CLOUD_RUN_LOOKBACK and reports how stale that is — "last ran 3d ago" is
#    the answer to most "why did the digest not send?" questions.
# ----------------------------------------------------------------------------
if $INCLUDE_CLOUD_RUN; then
  section "Cloud Run functions (GCP, outside the GKE cluster)"

  if ! $HAS_GCLOUD; then
    echo "_Skipped: \`gcloud\` is not on PATH, and these functions have no kubectl equivalent._" >>"$OUT"
  else
    # Scheduler state first: it says whether the trigger even fired, which
    # separates "the function broke" from "nothing invoked it".
    subsection "Cloud Scheduler jobs (triggers)"
    codeblock_start
    gcloud scheduler jobs list \
        --project="$GCP_PROJECT" --location="$GCP_REGION" \
        --format='table(name.basename(), schedule, timeZone, state, status.code, lastAttemptTime)' 2>&1 \
      | redact >>"$OUT"
    codeblock_end

    for FN in $CLOUD_RUN_FUNCTIONS; do
      subsection "$FN"
      FN_FILTER="$(cf_filter "$FN")"

      # Prefer an invocation inside the incident window; otherwise widen to the
      # lookback so a scheduled function is never silently absent from the digest.
      SCOPE="$WINDOW"
      SCOPE_NOTE="within the $WINDOW incident window"
      LAST_TS="$(gcloud logging read "$FN_FILTER" --project="$GCP_PROJECT" \
                   --freshness="$WINDOW" --order=desc --limit=1 \
                   --format='value(timestamp)' 2>/dev/null | head -n 1)"
      if [ -z "$LAST_TS" ]; then
        SCOPE="$CLOUD_RUN_LOOKBACK"
        SCOPE_NOTE="**no activity in the last $WINDOW** — widened to $CLOUD_RUN_LOOKBACK to find the last invocation"
        LAST_TS="$(gcloud logging read "$FN_FILTER" --project="$GCP_PROJECT" \
                     --freshness="$CLOUD_RUN_LOOKBACK" --order=desc --limit=1 \
                     --format='value(timestamp)' 2>/dev/null | head -n 1)"
      fi

      if [ -z "$LAST_TS" ]; then
        {
          echo "- No log entries at all within $CLOUD_RUN_LOOKBACK."
          echo "- That means the function never ran in the retention period, or was renamed/deleted."
          echo "  Cross-check the scheduler table above and \`therr-infra-terraform\`."
        } >>"$OUT"
        continue
      fi

      NOW_EPOCH="$(date -u +%s)"
      LAST_EPOCH="$(epoch_of "$LAST_TS")"
      AGE="unknown"
      [ -n "$LAST_EPOCH" ] && AGE="$(human_age "$(( NOW_EPOCH - LAST_EPOCH ))")"
      {
        echo "- Last invocation: \`$LAST_TS\` ($AGE)"
        echo "- Scope: $SCOPE_NOTE"
      } >>"$OUT"

      # Gen-1 tags every line of one run with the same labels.execution_id, so
      # this isolates a single invocation start-to-finish. Gen-2 has no such
      # label; there we fall back to the most recent CLOUD_RUN_TAIL lines.
      EXEC_ID="$(gcloud logging read "$FN_FILTER" --project="$GCP_PROJECT" \
                   --freshness="$SCOPE" --order=desc --limit=1 \
                   --format='value(labels.execution_id)' 2>/dev/null | head -n 1)"
      if [ -n "$EXEC_ID" ]; then
        echo "- Execution id: \`$EXEC_ID\`" >>"$OUT"
        EXEC_FILTER="($FN_FILTER) AND labels.execution_id=\"$EXEC_ID\""
      else
        EXEC_FILTER="$FN_FILTER"
      fi

      printf '\n_Most recent invocation (chronological, capped at %s lines):_\n' "$CLOUD_RUN_TAIL" >>"$OUT"
      codeblock_start
      cf_read "$EXEC_FILTER" "$SCOPE" "$CLOUD_RUN_TAIL" | reverse_lines | redact >>"$OUT"
      codeblock_end

      printf '\n_Error / warning lines across the last %s (deduplicated, newest-first):_\n' "$SCOPE" >>"$OUT"
      codeblock_start
      ERR_FILTER="($FN_FILTER) AND (severity>=WARNING OR textPayload=~\"$ERR_REGEX_REMOTE\" OR jsonPayload.message=~\"$ERR_REGEX_REMOTE\")"
      CF_ERRORS="$(cf_read "$ERR_FILTER" "$SCOPE" 1000 | redact | dedup_top)"
      if [ -n "$CF_ERRORS" ]; then
        echo "$CF_ERRORS" >>"$OUT"
      else
        echo "(no error/warning entries in the last $SCOPE)" >>"$OUT"
      fi
      codeblock_end
    done
  fi
fi

# ----------------------------------------------------------------------------
# Done
# ----------------------------------------------------------------------------
{
  echo
  echo "---"
  echo "_End of digest. $(wc -l <"$OUT") lines._"
} >>"$OUT"

echo "Wrote incident digest -> $OUT"
echo "Point Claude at it, e.g.:  \"Read $OUT and tell me the likely root cause.\""
