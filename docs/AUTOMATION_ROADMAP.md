# Automation Roadmap — Dev → Deploy → Debug → Market

**Last Updated:** July 2026
**Audience:** Zack + coding agents
**Status:** Living document — the strategic companion to `docs/WORK_IN_PROGRESS.md`

> **Why this doc exists.** The goal is to automate as much of the company as
> possible — from writing code to shipping it to debugging it in production,
> plus marketing — so a deliberately small team spends less time babysitting
> each step. `WORK_IN_PROGRESS.md` is the tactical backlog (individual code
> TODOs + post-deploy manual steps). This file is the **higher-altitude
> roadmap**: the handful of automation investments that compound, ranked by
> leverage, each annotated with a rough **cost/effort** read because several
> of them carry real recurring spend.
>
> Items already scheduled as backlog tasks live in `WORK_IN_PROGRESS.md`
> **§ 3.5 CI/CD & deploy automation**; this doc keeps the full picture
> (including the items that are valuable but potentially expensive) in one
> place so they don't get lost.

---

## Ranking at a glance

| # | Investment | Leverage | Cost / effort | Where tracked |
|---|-----------|----------|---------------|---------------|
| 1 | Telemetry + alerting backbone (Sentry/Datadog) | Highest — prerequisite for automated debugging | **Recurring $$** + medium setup | This doc |
| 2 | Automated DB migrations on deploy | High — kills a recurring manual step & silent-failure class | Low, **done** | `WIP` §3.5 ✅ |
| 3 | Staging smoke tests + auto-rollback | High — bad deploy → minutes, not a scramble | Medium | `WIP` §3.5 |
| 4 | Unified CI/CD + CD for cloud functions & infra | High — removes manual zip/apply toil | Medium | `WIP` §3.5 |
| 5 | Observability → auto-filed GitHub issue → agent PR | High payoff, **the self-healing loop** | Low-medium build; **usage-based agent $** | This doc |
| 6 | Dependabot/Renovate + auto-merge on green | Medium — removes 5-repo dependency tax | Low | This doc |
| 7 | Closed-loop marketing automation | Medium-high — automates growth toil | Low build; **usage-based LLM/API $** | This doc |
| 8 | Resilience hardening (SPOFs) | Medium — fewer 3am pages | Medium, opportunistic | `WIP` §3.4 |

**Sequencing:** 1 → 2 → 3 are the foundation (see failures, deploy safely,
catch regressions). 4 removes manual deploy toil. 5 is the payoff that makes
the agent loop autonomous — **and it depends on 1 existing first**. 6–8 are
parallelizable once the base is solid.

---

## 1. Telemetry + alerting backbone (Sentry / Datadog)

**The single highest-leverage move, and the prerequisite for "automated
debugging."** Today failures are largely invisible until a user reports them —
the open observability TODOs in `WIP` §4.5 (send events to GA/Datadog, better
error logging) confirm the gap. An agent literally cannot debug what isn't
instrumented, so this unblocks #5.

**What it involves**
- Wire a structured error/exception capture SDK into every backend service
  (`therr-api-gateway`, all `therr-services/*`) and both cloud functions
  (`therr-ai-automator`, `therr-messaging-automator`).
- Tag events with **release/version** (reuse `VERSIONS.txt` / the deploy
  `GIT_SHA`) so a spike maps to a specific deploy.
- The cluster already runs an OpenTelemetry collector
  (`k8s/prod/open-telemetry-collector.yaml`) and services carry a
  `HONEYCOMB_API_KEY` — so some tracing plumbing exists to build on rather
  than start cold.
- Route alerts (Slack/email/PagerDuty-lite) on error-rate spikes and on
  smoke-test / healthcheck failures.

**Cost read:** Sentry and Datadog are **recurring paid services** that scale
with event/host volume — the main reason this is flagged as "can get
expensive." Mitigate with sampling, error-only capture, and starting on a
lower tier. Honeycomb is already in the stack and may cover tracing without a
second vendor.

---

## 2. Automated DB migrations on deploy — ✅ DONE

Implemented in `_bin/cicd/run-migrations.sh` (invoked by `_bin/cicd/deploy.sh`).
On a `main` deploy it runs `npm run migrations:run` inside the freshly
rolled-out pod for each of the five migration-owning services
(users / maps / messages / reactions / push-notifications) **whose
`src/store/migrations` directory changed** in that deploy. It reuses the
running pod because that pod already has the Cloud SQL Auth Proxy sidecar and
DB secrets, so no separate Job or CI-side DB credentials are needed.

- **Ordering:** runs after `kubectl set image`, so migrations must stay
  **additive / expand-contract** (already the repo convention).
- **Opt-out:** `RUN_MIGRATIONS_ON_DEPLOY=false`.
- **Idempotent:** `knex migrate:latest` is a no-op when nothing is pending.

Removes the recurring "run unconsumed migrations" manual follow-up and the
silent-500 failure mode of a shipped image hitting an un-migrated schema.

---

## 3. Staging smoke tests + auto-rollback

Tracked in `WIP` §3.5. The `test-e2e-staging` CircleCI job is currently a stub
(`echo "Hello, Integration Tests"`). Replace it with a real synthetic suite on
critical paths, gate `stage → main` promotion on it, and auto-revert
(`kubectl rollout undo`) when post-deploy healthchecks/smoke checks fail.

**Cost read:** mostly engineering time; marginal CI minutes. The GKE auth and
job scaffold already exist.

---

## 4. Unified CI/CD + CD for cloud functions & infra

Tracked in `WIP` §3.5. Standardize on one CI convention and add the missing
continuous-deploy legs for `therr-ai-automator` (no CI at all today), both
automators' manual zip+Terraform deploys, and `therr-infra-terraform`
(`plan` on PR, `apply` on merge).

**Cost read:** low — GitHub Actions minutes + service-account wiring.

---

## 5. Observability → auto-filed GitHub issue → agent PR (self-healing loop)

**The payoff item Zack specifically called out: automatically creating GitHub
issues for bugs.** Once #1 exists, close the loop end-to-end:

1. **Detect:** an alert rule (from #1) fires on a recurring/new production
   error signature.
2. **File:** an integration opens a **GitHub issue** with the stack trace,
   release SHA, affected service, and frequency — de-duplicated by error
   fingerprint so one bug ≠ 50 issues. Reuse the existing
   `.github/ISSUE_TEMPLATE/*` structure (add a `prod-bug` template).
3. **Fix:** a Claude Code (web) session picks the issue up on the repo's
   branch convention, runs the existing skills (`quality-check`,
   `security-review`), and opens a PR.
4. **Verify & ship:** CI (#3/#4) gates it; a human approves. `subscribe_pr_activity`
   already lets a session watch the PR and autofix CI failures.

Most building blocks already exist (skills library, branch strategy, PR
activity subscription) — the missing piece is the **alert → issue** bridge,
which #1 enables.

**Cost read — why this is flagged "can get expensive":**
- **Agent/LLM usage is per-run and usage-based.** An auto-triage loop that
  spawns a coding agent on every filed issue can run up cost fast if issues
  are noisy. **Guardrails before enabling:** strict error de-duplication, a
  rate/volume cap on auto-created issues, a severity threshold (don't spawn an
  agent for low-severity noise), and a human-in-the-loop gate before any
  auto-PR merges. Start with **issue creation only** (cheap), and add the
  agent-PR leg once the issue signal is proven low-noise.

---

## 6. Dependabot / Renovate + auto-merge on green

Five repos of dependency drift is pure small-team tax. Configure Dependabot or
Renovate to auto-merge patch/minor bumps that pass CI, and batch majors for
review. Also feeds the RN New Architecture migration (`WIP` §3.3.1).

**Cost read:** low — free tooling; only CI minutes. Main risk is auto-merging a
bad minor, mitigated by requiring green CI (#3/#4) before merge.

---

## 7. Closed-loop marketing automation

The automators (`therr-ai-automator`, `therr-messaging-automator`) and the
`therr-landing` skills (`/new-blog-post`, `/backlink-outreach`,
`/outreach-followup`, image tooling) already generate content, emails, and
outreach. The gap is the loop's ends. Close it:

- Schedule content generation → auto-publish → **auto-submit sitemap /
  IndexNow to Search Console** (a standing manual follow-up in `WIP`).
- Run outreach + follow-ups on a cadence; feed GA4 results back to pick the
  next topics.
- Automate the unchecked marketing items already sitting in `WIP` §
  *Pending campaign / outreach actions* (unclaimed-space email batches, OSM
  import, etc.), respecting the SES reputation warm-up caps noted there.

**Cost read:** low build cost, but **usage-based LLM + email/API spend** scales
with volume. Gate batch sizes (the SES warm-up caps are already documented) and
cap generation runs.

---

## 8. Resilience hardening (single points of failure)

Tracked in `WIP` §3.4. Removing SPOFs — rate-limiter store fallback
(`therr-api-gateway/src/middleware/rateLimiters.ts`), DB-backed blacklist,
socket→REST fallback — reduces the pages that automation can't prevent. Best
tackled **opportunistically once #1 gives real data** on what actually breaks
in production.

**Cost read:** engineering time only; no new recurring spend.

---

## How to maintain this doc

- When an item ships, mark it ✅ here and reconcile the matching `WIP` §3.5
  entry (or remove it from `WIP` if fully closed).
- When a new compounding automation idea appears, add it here with a
  cost/effort read — keep individual code TODOs in `WIP`, not here.
- Revisit the ranking table quarterly, or whenever the team size or the
  production error/observability picture changes materially.
