# Production Debugging with Claude — Incident Digest

A minimalist, low-cost way to hand Claude concise context about a production
bug or bad deploy, without standing up new observability infrastructure and
without giving Claude any production credentials.

> **TL;DR** — When something breaks in prod, run
> `_bin/prod-debug/collect-incident.sh` on your machine. It writes a small,
> **redacted** Markdown digest to `.prod-debug/incident-<timestamp>.md`. Point
> Claude at that file: _"Read `.prod-debug/incident-…md` and tell me the likely
> root cause."_ That's the whole loop.

---

## Why this design

We already emit three streams of signal in production; the problem was never a
lack of data, it was that pulling **concise, correlated** context together at
2am is tedious:

| Signal | Where it already lives | Cost |
|--------|------------------------|------|
| App logs (`printLogs` → `console.info` / `console.error`) | Container stdout/stderr → **Google Cloud Logging** (GKE ships it automatically) | Free tier: 50 GiB ingest/mo, ~30-day retention |
| Kubernetes/pod state (restarts, OOMKills, crashloops, rollout events) | Live GKE API via `kubectl` | Free |
| Traces + `error.message`/`error.stack` span attributes | Honeycomb (via `HoneycombSDK` per service) | Free tier |

So the cheapest possible solution is **not** a new pipeline — it's a small,
read-only script that queries what's already there, distills it, redacts it,
and drops a single file you can hand to Claude.

### What it deliberately does NOT do
- No always-on log collector, sidecar, or agent (the commented-out
  `k8s/prod/open-telemetry-collector.yaml` stays commented out — we don't need it).
- No new cloud resources, buckets, dashboards, or paid tiers.
- No webhook, no server, no secrets stored anywhere new.
- No production credentials handed to Claude or to this repo's CI.

The result: **zero added infrastructure cost, zero added runtime overhead on
the cluster** (read-only queries, run on demand by a human), and a tight
security boundary.

---

## Security model

The trust boundary is the key design choice:

- **The operator runs the script with their own existing `gcloud` / `kubectl`
  credentials.** Those never leave your machine. Claude is never given cluster
  or GCP access.
- **Output is redacted before it touches disk.** Every line written to the
  digest passes through a `redact()` filter that masks JWTs, `Bearer`/`Basic`
  tokens, emails, `password`/`secret`/`token`/`*_key` assignments, database
  connection strings, and Stripe/AWS-style secret prefixes (`sk_live`, `whsec`,
  `AKIA`, …). This is defense-in-depth on top of the server-side body redaction
  already done in `reqLogDecorator.ts`.
- **The digest is git-ignored** (`.prod-debug/`) so an incident dump — which
  may still contain residual user context in error strings — is never
  accidentally committed or pushed.
- Because a human runs it and reviews the file before sharing, there is a
  natural checkpoint: you can skim the ~1-page digest before pointing Claude at
  it.

> If you ever want Claude to pull the digest itself (e.g. from a web session),
> do it by giving Claude the **file**, not credentials — copy the redacted
> `.prod-debug/incident-*.md` into the session. Keep production access on the
> human side of the boundary.

---

## Usage

```bash
# Default: last 30 minutes, pod health + events + deployed SHAs + top errors
_bin/prod-debug/collect-incident.sh

# Widen the window (accepts anything gcloud --freshness / kubectl --since take)
_bin/prod-debug/collect-incident.sh 2h

# Crashloop / pod-not-starting: add live current+previous container tails
_bin/prod-debug/collect-incident.sh 15m --live

# Just after a deploy went out: focus on rollout status + history
_bin/prod-debug/collect-incident.sh 1h --deploy
```

Then, in a Claude session with this repo:

> "Read `.prod-debug/incident-20260723T101500Z.md` and tell me the likely root
> cause and which service/commit to look at."

Because the digest already lists the **deployed image tag per deployment**
(which equals the git SHA of the running build — see `_bin/cicd/deploy.sh`),
Claude can correlate the errors to a specific commit and jump straight into the
relevant service source in this monorepo.

### What's in the digest
1. **Header** — timestamp, window, kube-context, GCP project, which backends were available.
2. **Pod health** — `kubectl get pods -o wide` (restarts, non-Running states).
3. **Deployed images** — SHA per deployment, ready/desired replicas.
4. **Recent cluster events** — filtered to warnings/errors/crashloops/OOM.
5. **Rollout status** (`--deploy` mode) — per-deployment rollout + history.
6. **Top error/warning log lines** — deduplicated and counted, newest-first,
   hard-capped (`THERR_MAX_LOG_LINES`, default 120). Sourced from Cloud Logging
   when `gcloud` is present (history survives pod restarts — important because
   deployments use `strategy: Recreate` with `replicas: 1`, so the crashed pod's
   logs are gone from `kubectl` after a redeploy), else from live `kubectl logs`.
7. **Live tails** (`--live` mode) — current + `--previous` logs for unhealthy pods.

### Requirements
- `gcloud` authenticated to the `therr-app` project **and/or** `kubectl`
  pointed at the prod cluster. The script auto-detects both and degrades
  gracefully if only one is present. `jq` is optional (richer Cloud Logging
  parsing) but not required.

### Config (env overrides)
| Env var | Default | Meaning |
|---------|---------|---------|
| `THERR_GCP_PROJECT` | `therr-app` | GCP project for Cloud Logging |
| `THERR_K8S_NAMESPACE` | `default` | Namespace to inspect |
| `THERR_MAX_LOG_LINES` | `120` | Cap on deduped error lines (keeps digest context-sized) |
| `THERR_PROD_DEBUG_DIR` | `.prod-debug` | Output directory (git-ignored) |

---

## Cost & performance

- **Infra cost added: $0.** Cloud Logging ingest is already happening and sits
  inside the free tier; `kubectl`/`gcloud read` queries are free. Nothing runs
  continuously.
- **Cluster overhead added: none.** All queries are read-only and on demand.
  `getNodeAutoInstrumentations` already disables the noisy `fs` instrumentation
  (`src/tracing.ts`); this design adds no new per-request work.
- **Human overhead: one command.**

---

## Optional next steps (only if the manual loop isn't enough)

These are intentionally **not** built, to keep things minimalist. Adopt only if
the on-demand script proves insufficient:

- **Post-deploy auto-capture.** Add a step at the end of `_bin/cicd/deploy.sh`
  (main branch only) that runs this collector ~2 minutes after `kubectl set
  image` and uploads the redacted digest as a CircleCI build artifact. Turns
  "point Claude at an output" into "the output is already waiting after every
  deploy." Still zero standing infra.
- **Honeycomb enrichment.** Add a `--honeycomb` mode that pulls the top error
  events for the window via the Honeycomb Query Data API (read-only key) to
  attach trace-level `error.stack` context. Only worth it if stdout stack
  traces prove too shallow.

Keep the default path — human-run, read-only, redacted, one file — as the
primary flow.
