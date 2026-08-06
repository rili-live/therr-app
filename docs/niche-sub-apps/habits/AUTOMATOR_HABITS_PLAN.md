# Plan: HABITS support in therr-messaging-automator (daily digest cron + brand awareness)

**Target repo:** `rili-live/therr-messaging-automator` (GCP Cloud Function, HTTP-triggered by Cloud Scheduler)
**Written:** 2026-07-22, against automator commit `ee3a590` and therr-app branch `claude/niche-retention-audit-w0t8zh` (backend since cherry-picked to `general`)
**Audience:** This doc is a self-contained prompt for a Claude session running in the
`therr-messaging-automator` repo. All cross-repo facts it needs are restated here.

---

## 1. Goal

Two deliverables, in priority order:

1. **Trigger the HABITS daily partner-activity digest** once per day from the
   automator (the platform's only scheduled-job runner). The digest logic
   itself already lives in users-service — the automator only needs to call it.
2. **Make the automator brand-aware for `habits` users** so they are no longer
   silently excluded from every lifecycle email and push. Today the automator
   filters to `brand === 'therr'` users and hardcodes the `therr` brand header
   on pushes, so HABITS users get nothing (and would get wrong-brand pushes if
   the filter were naively removed).

---

## 2. Context: what already exists

### 2.1 In therr-app users-service (deployed via `general`; do NOT reimplement)

- **Endpoint:** `POST /v1/habits/pacts/digest/run-daily` on users-service
  (port `7771`, same VPC-internal reachability as the push service the
  automator already calls). Handler: `src/handlers/habitsDigest.ts`.
- **Deliberately NOT registered in the API gateway** — it is internal-only and
  reachable only inside the VPC. No end-user auth is required; treat it like
  the automator's existing internal call to push-notifications-service.
- **Required headers:** `x-brand-variation: habits`, `x-localecode: en-us`
  (locale is a fallback; per-recipient locale is resolved server-side).
- **What it does per run:** walks all `active` pacts (capped at 500/run) and
  sends three push types via push-notifications-service:
  - `streak-at-risk` — member has an active streak but no completed check-in
    *today* (so schedule the trigger in the **evening**, ~23:00 UTC).
  - `partner-missed-day` — a member had no completed check-in *yesterday*;
    the other members are notified (members who joined within the last day
    are exempt).
  - `pact-expiring` — pact `endDate` within 3 days.
- **Response body:** JSON counters
  `{ pactsEvaluated, streakAtRiskSent, partnerMissedSent, pactExpiringSent, errors }` —
  log these.
- **Idempotence caveat:** the endpoint has NO internal dedup between runs.
  Calling it twice in one day re-sends the same pushes. The automator MUST
  guarantee at-most-once-per-day triggering (see §3.3).

### 2.2 In the automator (facts verified at commit `ee3a590`)

- Entry point `src/index.ts` → `handleScheduleTrigger(req, res)`; Cloud
  Scheduler POSTs to the function URL; timeout-continuation self-invokes with
  `{ offset, continuationCount }` in the body and an OIDC identity token
  (`getGcpIdentityToken`).
- `paginateAndNotifyAllUsers` (~line 775) filters every page:
  `users.filter((u) => u?.brandVariations?.find((v) => v.brand === 'therr'))`
  with the TODO "Include other brands after making the automator brand
  aware/dynamic". **HABITS users are excluded from all checkpoints today.**
- `sendPushNotification` (~line 90) POSTs to
  `http://${VPC_INTERNAL_LOAD_BALANCER_IP}:${PUSH_NOTIFICATIONS_SERVICE_PORT}/v1/notifications/send`
  with hardcoded `'x-brand-variation': 'therr'` (TODO at line 104). The push
  service resolves device tokens **per brand** (`main.userDeviceTokens`) and
  selects the per-brand Firebase app from that header — sending to a habits
  user with the `therr` header routes through the wrong Firebase project or
  finds no token.
- Users DB is read directly via Knex (`src/store/UsersStore.ts`);
  `users.brandVariations` is a JSONB array of
  `{ brand, firstSeenAt, lastSeenAt, isActive }`.
- Brand/email config lives in `src/utilities/hostContext.ts` keyed by host
  (`therr.com`, `dashboard.therr.com`, `dashboard.appymeal.com`). **No
  `habits` entry exists.**
- Checkpoint dedup state lives in `userStatsAggregation` rows
  (`latestMarketingEmail`, `latestMarketingPushNotification`,
  `latestOnboardingEmail` + date columns) — one row per user, **not per
  brand**.
- Env template: `PUSH_NOTIFICATIONS_SERVICE_PORT=7775`,
  `VPC_INTERNAL_LOAD_BALANCER_IP`, `CLOUD_FUNCTION_URL`, DB creds, SES config.
- Conventions: TypeScript strict, 4-space indent, **no semicolons**, Jest
  tests in `src/__tests__/`, `npm run lint`, `npm test`, `npm run build:local`.

---

## 3. Phase 1 — Habits daily digest trigger (do this first; small and shippable alone)

### 3.1 Task-dispatch pattern in the handler

Add a task discriminator to the request body so one function + two Cloud
Scheduler jobs coexist:

- `handleScheduleTrigger` reads `req.body?.task`.
- `task === 'habits-daily-digest'` → run ONLY the digest trigger (below) and
  return its counters. Do not run the user-pagination passes.
- `task` absent/anything else → existing behavior unchanged (continuations
  keep working because their payload has no `task` field).

### 3.2 The digest trigger implementation

New file `src/api/habitsDigest.ts` (mirrors the `sendPushNotification` axios
pattern):

```ts
const usersServiceEndpoint = `http://${process.env.VPC_INTERNAL_LOAD_BALANCER_IP}:${process.env.USERS_SERVICE_PORT}/v1`

export const triggerHabitsDailyDigest = () => axios({
    method: 'post',
    url: `${usersServiceEndpoint}/habits/pacts/digest/run-daily`,
    headers: {
        'x-brand-variation': 'habits',
        'x-localecode': 'en-us',
    },
    timeout: parseInt(process.env.HABITS_DIGEST_TIMEOUT_MS || '300000', 10),
})
```

- Log the response counters on success; log message + status on failure.
- Return the counters in the function's HTTP response for observability.
- New env vars: `USERS_SERVICE_PORT=7771` (+ optional
  `HABITS_DIGEST_TIMEOUT_MS`). Add both to `.env.template` and note them for
  the Terraform/Secret Manager config.
- The digest can take minutes at scale (it paces through pacts sequentially);
  the 9-minute function timeout is fine at current volume, but set the axios
  timeout generously and treat `ECONNABORTED` the same way
  `triggerContinuation` does (request dispatched = server is processing; log
  and report success-with-caveat rather than failing the run).

### 3.3 Scheduling & at-most-once-per-day

- **New Cloud Scheduler job** (in `therr-infra-terraform`, alongside the
  existing one): daily at `0 23 * * *` UTC, POST to the same function URL,
  body `{"task": "habits-daily-digest"}`, OIDC auth like the existing job.
- Because the only caller of the `habits-daily-digest` task is this
  once-daily job, at-most-once is enforced by scheduling, not code. Do NOT
  wire the digest into the default (possibly more frequent) task path.
- Document in README.md: re-running the digest task manually re-sends pushes.

### 3.4 Tests (Phase 1)

- Unit test the task dispatch: body `{task: 'habits-daily-digest'}` calls the
  digest trigger and does NOT call `paginateAndNotifyAllUsers`; default body
  does the inverse. (Existing tests show the mocking style —
  `src/__tests__/timeout-continuation.test.ts` is the closest template.)
- Unit test `triggerHabitsDailyDigest` header/URL construction and the
  ECONNABORTED tolerance.

---

## 4. Phase 2 — Brand-aware lifecycle messaging for habits users

Ship separately from Phase 1. The two independent changes that make the
existing checkpoint machinery safe for habits users:

### 4.1 Per-user brand resolution + correct push header

- Add a helper `getPrimaryBrand(user): 'therr' | 'habits' | ...` — pick the
  `brandVariations` entry with `isActive !== false` and the most recent
  `lastSeenAt` (fall back to `'therr'`).
- `sendPushNotification` takes the brand as a parameter (from
  `getPrimaryBrand(user)`) instead of hardcoding `'x-brand-variation': 'therr'`.
  This is load-bearing: the push service resolves device tokens and the
  Firebase app per brand.
- Widen the pagination filter from therr-only to
  `users.filter((u) => u?.brandVariations?.length)` — but ONLY together with
  4.2/4.3, otherwise habits users start receiving Therr-branded emails.

### 4.2 Brand-aware email content

- Add a `habits` brand entry to `src/utilities/hostContext.ts` (brand name
  "Friends with Habits", from-email, colors, unsubscribe URL, app link
  `https://play.google.com/store/apps/details?id=com.therr.habits`). Copy the
  email-template config shape from the `therr.com` entry.
- Thread the brand through `sendEmail.ts`/`template.ts` so subject lines,
  logo, links, and footer render per-brand. (The dashboard-vs-consumer split
  already exists; this generalizes it.)
- **Checkpoint applicability:** most retention emails are Therr-specific
  (moments, spaces, rewards explainer). For habits users, start with the
  brand-neutral subset only: `intro` (needs a habits variant of the copy),
  `verify-email`, `complete-profile`, and the engagement push
  `unread-notifications-reminder`. Gate the rest behind
  `getPrimaryBrand(user) === 'therr'` in their `condition()`s. Habits-specific
  lifecycle emails (weekly pact summary — a HABITS MVP item) can be added
  later as new checkpoints gated to `habits`.

### 4.3 Dedup-state collision guard

`userStatsAggregation` markers are per-user, not per-brand. A user active in
both apps must not have their Therr email sequence pointer advanced by a
habits send (or vice versa). For now, resolve ONE primary brand per user
(4.1) and run the sequence only under that brand — do not attempt per-brand
stat rows in this pass. Note this as a known limitation in the README.

### 4.4 Tests (Phase 2)

- `getPrimaryBrand`: most-recent active brand wins; inactive entries ignored;
  missing array → 'therr'.
- Push header: habits user → `x-brand-variation: habits`.
- Checkpoint gating: a habits-only user never matches a Therr-only checkpoint
  condition; a therr user's behavior is byte-for-byte unchanged (regression).

---

## 5. Acceptance criteria

1. Cloud Scheduler job with `{"task":"habits-daily-digest"}` → function calls
   `POST /v1/habits/pacts/digest/run-daily` on users-service with the
   `x-brand-variation: habits` header exactly once, logs and returns the
   digest counters, and skips the user-pagination passes.
2. Default-payload runs (and their continuations) behave exactly as before —
   existing tests all pass unmodified.
3. (Phase 2) Habits users receive brand-correct pushes/emails from the
   applicable checkpoint subset; therr users' sequences are unchanged.
4. `npm run lint`, `npm test`, `npm run build:local` all clean.

## 6. Non-goals / do-nots

- Do NOT reimplement pact/streak/digest logic in the automator — the
  users-service endpoint is the single source of truth (it has its own tests
  in therr-app).
- Do NOT call the digest from the default task path or from continuations.
- Do NOT remove the therr-only filter without the Phase 2 brand plumbing.
- Do NOT introduce per-brand `userStatsAggregation` rows in this pass.
- Terraform (scheduler job, env vars/secrets) is configured in
  `therr-infra-terraform`, not this repo — list the required values in the PR
  description: `USERS_SERVICE_PORT=7771`, optional `HABITS_DIGEST_TIMEOUT_MS`,
  new scheduler job `0 23 * * *` UTC with body `{"task":"habits-daily-digest"}`
  and OIDC auth.
