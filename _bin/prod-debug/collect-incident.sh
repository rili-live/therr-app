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
#
# Backends (auto-detected, degrades gracefully)
#   - gcloud   -> Google Cloud Logging (history survives pod restarts; preferred
#                 for post-deploy debugging where the crashed pod is already gone)
#   - kubectl  -> live cluster state, pod status, rollout events, log tails
#
set -uo pipefail

# ----------------------------------------------------------------------------
# Config (override via env)
# ----------------------------------------------------------------------------
GCP_PROJECT="${THERR_GCP_PROJECT:-therr-app}"
NAMESPACE="${THERR_K8S_NAMESPACE:-default}"
MAX_LOG_LINES="${THERR_MAX_LOG_LINES:-120}"   # cap on deduped error lines emitted
OUT_DIR="${THERR_PROD_DEBUG_DIR:-.prod-debug}"

WINDOW="30m"
MODE="incident"   # incident | live | deploy

usage() {
  cat <<'USAGE'
collect-incident.sh — concise, redacted production incident digest for Claude.

USAGE:
  collect-incident.sh [WINDOW] [--live | --deploy]

ARGS:
  WINDOW      Time window to look back (default 30m). Anything gcloud
              --freshness / kubectl --since accept: 15m, 2h, 1d, ...
  --live      Also tail current + previous logs of unhealthy pods (crashloops).
  --deploy    Also show per-deployment rollout status + history.
  -h, --help  Show this help.

EXAMPLES:
  collect-incident.sh                 # last 30m
  collect-incident.sh 2h              # last 2 hours
  collect-incident.sh 15m --live      # crashloop investigation
  collect-incident.sh 1h --deploy     # right after a deploy

PREREQUISITES:
  gcloud and/or kubectl on PATH, authenticated to the prod cluster.
  One-time setup and how to add this as a shell command:
  see docs/PROD_DEBUG_CLAUDE.md.

ENV OVERRIDES:
  THERR_GCP_PROJECT   (default: therr-app)
  THERR_K8S_NAMESPACE (default: default)
  THERR_MAX_LOG_LINES (default: 120)
  THERR_PROD_DEBUG_DIR(default: .prod-debug)
USAGE
}

for arg in "$@"; do
  case "$arg" in
    -h|--help) usage; exit 0 ;;
    --live)    MODE="live" ;;
    --deploy)  MODE="deploy" ;;
    --*)       echo "Unknown flag: $arg" >&2; usage >&2; exit 2 ;;
    *)         WINDOW="$arg" ;;   # first bare arg is the time window (e.g. 30m, 2h)
  esac
done

HAS_GCLOUD=false; command -v gcloud  >/dev/null 2>&1 && HAS_GCLOUD=true
HAS_KUBECTL=false; command -v kubectl >/dev/null 2>&1 && HAS_KUBECTL=true
HAS_JQ=false;      command -v jq      >/dev/null 2>&1 && HAS_JQ=true

if ! $HAS_GCLOUD && ! $HAS_KUBECTL; then
  cat >&2 <<'PREREQ'
ERROR: neither `gcloud` nor `kubectl` was found on your PATH.
You need at least one, authenticated to the prod cluster.

Quick setup (macOS/Linux):
  # Google Cloud SDK (bundles gcloud + kubectl):  https://cloud.google.com/sdk/docs/install
  #   macOS:  brew install --cask google-cloud-sdk
  #   Debian: sudo apt-get install google-cloud-cli google-cloud-cli-gke-gcloud-auth-plugin kubectl

  gcloud auth login
  gcloud config set project therr-app
  gcloud config set compute/zone us-central1-a
  export USE_GKE_GCLOUD_AUTH_PLUGIN=True
  gcloud container clusters get-credentials cluster-1 --zone us-central1-a

Full instructions: docs/PROD_DEBUG_CLAUDE.md
PREREQ
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
codeblock_start() { printf '```%s\n' "${1:-}" >>"$OUT"; }
codeblock_end()   { printf '```\n' >>"$OUT"; }

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

section "Top error / warning log lines (deduplicated, newest-first)"
if $HAS_GCLOUD; then
  echo "_Source: Google Cloud Logging (survives pod restarts)._" >>"$OUT"
  codeblock_start
  # severity>=WARNING OR text matches an error shape; k8s container stdout/stderr.
  FILTER="resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"$NAMESPACE\" AND (severity>=WARNING OR textPayload=~\"$ERR_REGEX\" OR jsonPayload.message=~\"$ERR_REGEX\")"
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
# Done
# ----------------------------------------------------------------------------
{
  echo
  echo "---"
  echo "_End of digest. $(wc -l <"$OUT") lines._"
} >>"$OUT"

echo "Wrote incident digest -> $OUT"
echo "Point Claude at it, e.g.:  \"Read $OUT and tell me the likely root cause.\""
