# Cross-Repo Integration

`therr-app` is the product monorepo, but it is not the whole system. Four sibling
repositories in the `rili-live` GitHub org participate in production, and two of them
**read and write this repository's database directly** — bypassing the API gateway.

This document covers only what crosses a repo boundary and what that means for changes
made *here*. Internal architecture is in [ARCHITECTURE.md](./ARCHITECTURE.md).

> **No CI system in any of the five repos checks these couplings.** This repo's CI cannot
> see the consumers; theirs cannot see this schema. Every rule below is prose, enforced by
> whoever is reading it. When you can turn one into a gate (lint rule, test, hook), do.

---

## 1. The five repos

| Repo | What it is | Touches therr-app how |
|---|---|---|
| **therr-app** (this repo) | API gateway, 6 microservices, 2 web clients, React Native mobile | — |
| **therr-messaging-automator** | GCP Cloud Function (nodejs22): lifecycle email via AWS SES, push notifications, HABITS daily digest | **Direct Knex reads** on users/maps/reactions DBs + **HTTP call into users-service** over the VPC |
| **therr-ai-automator** | GCP Cloud Function (nodejs22): scheduled AI content generation (thoughts, replies, reactions) via Anthropic/OpenAI | **Direct Knex reads and writes** on users/maps/reactions DBs |
| **therr-infra-terraform** | GCP infra: Cloud Functions, Cloud Scheduler, VPC connector, Cloud SQL, reserved internal IPs, Secret Manager | Provisions the DB this repo's services use; owns the internal IP that `k8s/prod` pins |
| **therr-landing** | Marketing site (therr.app), React 18 + Vite SSG behind nginx | Public API only — `POST /v1/users-service/subscribers/signup` — plus a **build-time content export** that produces `therr-client-web/src/data/habitsBlogPosts.json` here (see § Habits blog cross-posts). Not coupled at runtime; changes there cannot break the backend |

All four are separate deploy pipelines. Both automators auto-deploy on merge to their
`main` (GitHub Actions → artifacts committed into `therr-infra-terraform` → `repository_dispatch`
→ Terraform Apply). Nothing about a therr-app deploy redeploys them, and nothing about their
deploys re-validates this schema.

If a `~/Code/therr-workspace` checkout exists locally, it symlinks all five under `repos/`
and carries the cross-repo operational runbook (`docs/OPERATIONS.md`) and the full
architecture writeup (`docs/CROSS_REPO_ARCHITECTURE.md`).

---

## 2. Coupling 1 — Two Cloud Functions query this database directly

Both automators open Knex connections to the same Cloud SQL Postgres instance the services
own, using this repo's read/write pool pattern. They do **not** go through
`therr-api-gateway`, so API-level versioning discipline does not protect them.

Coupling surface, regenerated 2026-07-30:

| Table | messaging | ai |
|---|:-:|:-:|
| `main.users` | ✅ | ✅ |
| `main.userConnections` | ✅ | ✅ |
| `main.userGroups` | ✅ | ✅ |
| `main.userOrganizations` | ✅ | ✅ |
| `main.organizations` | ✅ | ✅ |
| `main.socialSyncs` | ✅ | ✅ |
| `main.moments` | ✅ | ✅ |
| `main.momentReactions` | ✅ | ✅ |
| `main.spaces` | ✅ | — |
| `main.invites` | ✅ | — |
| `main.userStatsAggregations` | ✅ | — |
| `main.notifications` | ✅ | — |
| `main.userAchievements` | ✅ | — |
| `main.thoughts` / `main.thoughtReactions` | — | ✅ (writes) |
| `main.userLocations` | — | ✅ (declared homes of bot accounts) |
| `habits.habit_phases` | ✅ (**writes**) | — |
| `habits.habit_goals` / `habits.streaks` | ✅ | — |

Regenerate it — do this rather than trusting the table above, it ages:

```bash
grep -rhoE "'main\.[A-Za-z]+'" ~/Code/therr-messaging-automator/src/store \
                               ~/Code/therr-ai-automator/src/store | sort -u
```

### Rule: migrations are expand/contract, never a bare rename

A column rename merged to `general` flows to `main`, runs automatically via
`_bin/cicd/run-migrations.sh`, deploys green — and then breaks a Cloud Function hours later
at its next Cloud Scheduler firing, with no alert (telemetry is item #1 in
[AUTOMATION_ROADMAP.md](./AUTOMATION_ROADMAP.md), not yet built).

Before any migration that renames or drops a column on a table above:

```bash
grep -rn "columnName" ~/Code/therr-messaging-automator/src/store \
                      ~/Code/therr-ai-automator/src/store
```

Then: add the new column → backfill → ship the consumer repos → *only then* drop the old one.

### Rule: a bot's home city lives here, its local colour lives there

> **Status (2026-08-22): the automator half is not built yet.** This repo's side has shipped —
> the columns, the seeded bots with declared homes, and the distributor's local query. But
> `therr-ai-automator` currently has no `src/config/locales.ts`, does not read
> `main.userLocations`, and never writes `main.thoughts.latitude/longitude/locality`. Until it
> does, the only location-tagged posts come from `detectLocality` on human posts. Read the rest
> of this section as the contract to build against, not as a description of what runs today.

Location-aware bots (seeded by `therr-services/users-service/src/store/seeds/006_local_bot_users.js`)
have a declared home in `main.userLocations`. `therr-ai-automator` reads those coordinates
each run and matches them against its own metro catalog (`src/config/locales.ts`) **by
proximity, within 80km** — there is no shared city key, deliberately, so neither repo has to
be redeployed because the other reworded a city name.

What that means in practice:

- Moving or deleting a seeded bot's `userLocations` row silently turns its local posts off.
  Nothing errors; the bot just goes back to writing generic content.
- Adding a metro takes **both** halves: a catalog entry there and a seeded bot with a home
  inside its radius here. Either alone does nothing.
- The automator writes `main.thoughts.latitude/longitude/locality` only on posts that are
  actually about the city, and always as a complete coordinate pair. The distributor's local
  candidate query filters on `latitude IS NOT NULL` and computes distance from both columns,
  so a half pair would be a row claiming to be from somewhere while matching nothing.
- **Bot posts do not go through the author-proximity check.** Human posts are only tagged
  when the author is within 60km of the city they named (`detectLocality`), because post
  text is user-controlled. The automator writes `main.thoughts` directly and never touches
  `ThoughtsStore.create`, so that gate does not apply to it — its bots are trusted content
  and are seeded with a declared home matching the city they write about anyway.
- **The `locality` label must read the same on both sides.** Human posts get theirs from
  `detectLocality` (`${name}, ${stateAbbr}` off the `Cities` catalog); bot posts get theirs
  from the automator's `locales.ts` `name` field. Both spell it `"Chicago, IL"`. If one
  repo restyles that label, the feed shows two spellings of one place — there is a parity
  test in `therr-js-utilities/tests/detect-locality.test.ts`, but it can only see this repo.

### Rule: brand-scoping must be mirrored by hand

`eslint-config/brand-scoped-tables.js` + `therr/no-direct-brand-scoped-table` enforce that
brand-scoped tables are only read through a `BrandScopedStore`. **That lint rule cannot see
another repository.** `main.notifications` and `main.userAchievements` are both in that list
*and* read by the messaging automator.

This already caused a real bug: the automator read both tables with no `brandVariation`
predicate, so a Friends With Habits user's "you have N unread" push counted their Therr
notifications. Fixed in
[therr-messaging-automator#7](https://github.com/rili-live/therr-messaging-automator/pull/7)
(2026-07-29); that repo now carries its own `no-restricted-syntax` rule and store tests
asserting the predicate reaches the emitted SQL.

**When you add a table to `BRAND_SCOPED_TABLES`:** run the regeneration grep above. If an
automator already reads it, open a PR there mirroring the table into
`src/store/brandScoped.ts` in the same batch of work. Neither repo will warn you.

### Rule: `main.thoughts` rows can be dated in the future

`therr-ai-automator` deliberately writes thoughts and replies with `createdAt` up to
`config.numHours` (default 30) **ahead of now**, to drip one run's output out until the next
run. To this repo, `main.thoughts` is partly a publish queue, not a table of past events.

> This caused an 8-day production feed outage (2026-07-22 → 2026-07-30). The hot score in
> `ThoughtsStore` computed `POWER(EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600 + 2, 1.5)`.
> For a future-dated row the base goes negative and Postgres *errors*
> (`a negative number raised to a non-integer power yields a complex result`) rather than
> returning NULL — aborting the entire candidate query, which
> `runThoughtDistributorAlgorithm` swallowed in a `.catch`. Zero thoughts activated for
> anyone, and `searchActiveThoughts` only returns activated rows, so every feed froze.

Any SQL doing arithmetic on `NOW() - thoughts."createdAt"` must assume a negative result.
The current guard is `HOT_SCORE_EXPRESSION` in
`therr-services/users-service/src/store/ThoughtsStore.ts` (a `GREATEST(..., 0)` clamp, plus
`createdAt <= NOW()` on the candidate pool) with regression coverage in
`therr-services/users-service/tests/unit/ThoughtsStore.test.ts`.

---

## 3. Coupling 2 — The HABITS daily digest crosses three repos

`therr-messaging-automator` calls `POST /v1/habits/pacts/digest/run-daily` on users-service
(`therr-services/users-service/src/routes/pactsRouter.ts`). That route is **internal-only** —
it is not exposed through `therr-api-gateway` and must never be. The request path:

Cloud Scheduler → messaging-automator (GCF) → VPC connector → GKE internal LB `:7771` → users-service

| Piece | Repo | File |
|---|---|---|
| Reserved static internal IP + `VPC_INTERNAL_USERS_LB_IP` env var | infra | `production/projects/therr-app/CloudFunction/users-service-ilb-address.tf`, `messaging-automator.tf` |
| Root output passthrough (child-module outputs are invisible without it) | infra | `production/outputs.tf` |
| k8s Service pinning that IP (`10.128.15.235`) | **this repo** | `k8s/prod/users-service-internal-loadbalancer-service.yaml` |
| NetworkPolicy allowing the GKE node subnet `10.128.0.0/20` | **this repo** | `k8s/prod/users-service-network-policy.yaml` |
| The caller | messaging | `src/api/habitsDigest.ts` |

Two internal LBs exist (7775 push-notifications, 7771 users-service) because a k8s Service
routes all of its ports to one pod selector — 7775 could not be reused.

**The digest's response shape is a coupling too.** `IHabitsDigestCounters` in the messaging
repo mirrors what this handler returns, and every field there is optional so the two can be
deployed independently — a new counter here logs as `undefined` on an older automator rather
than breaking it. That only holds in one direction: *renaming* or repurposing an existing
counter silently changes what that repo's Cloud Function logs, with nothing failing. The
reminder-pass counters (`habitsEvaluated`, `dailyRemindersSent`, `remindersNotDue`) were added
this way.

**The `ipBlock` must be the node subnet, not the VPC connector range (`10.6.0.0/28`)**: the LB
runs `externalTrafficPolicy: Cluster`, which SNATs the client to a node IP. Tightening it
requires switching to `externalTrafficPolicy: Local`.

**Diagnostic:** if the digest hangs ~127 seconds and fails with `ETIMEDOUT`, the LB or the
NetworkPolicy `ipBlock` is missing — packets are dropped, not refused. `ECONNREFUSED` means
something else (wrong port, pod down). The ~2-minute hang is the Linux SYN-retry budget.

**The digest now dedups server-side.** It queues into `main.notificationQueue` with
period-stamped dedupe keys (`streak-at-risk:<pactId>:<YYYY-MM-DD>`) behind a UNIQUE
(brandVariation, userId, dedupeKey) constraint, so a retry, an overlapping firing or a
timeout continuation costs a wasted read pass rather than a double-send to real users.
The single Cloud Scheduler job (`0 9 * * *` America/Chicago) is still the intended trigger,
but it is no longer the *only* thing standing between a retry and duplicate pushes.

Two consequences for the automator side:

- `triggerHabitsDailyDigest`'s "do NOT retry" comment and its `dispatched-pending` status
  predate this. A retry after a timeout is now safe; whatever the first call already queued
  will conflict rather than re-send.
- Delivery is asynchronous. The counters in the response say what was *queued*, not what was
  sent — `deduped` is the new field, and a run that queued nothing because everything was
  already queued looks identical to a run with nothing to do apart from that counter. The
  actual send happens on the users-service worker, which only runs when
  `NOTIFICATION_QUEUE_WORKER_ENABLED=true`.

---

## 4. Scheduling constraints that land on this repo

| Job | Schedule (America/Chicago) | Target |
|---|---|---|
| `ai-automator-scheduler` | `0 0 */5 * *` | ai-automator |
| `messaging-automator-scheduler` | `25 18,20 * * *` | messaging-automator (default pass) |
| `habits-daily-digest-scheduler` | `0 9 * * *` | messaging-automator, `{"task":"habits-daily-digest"}` |

Cloud Scheduler's free tier is **3 jobs per billing account and all 3 are in use** (paused jobs
still bill). New scheduled backend work should multiplex onto an existing function via the
request-body `task` field rather than assuming a 4th job can be added for free.

The habit lifecycle emails (`{"task":"habits-milestone-emails"}`) are the worked example.
The task exists and is independently invocable, but rather than assume a 4th job it can also
be chained onto the existing digest firing with `HABITS_MILESTONE_EMAILS_ON_DIGEST=true` —
which is the better order regardless, since the digest is what advances the maintenance
stages the emails mail on. Enable the chained path *or* a dedicated job, never both.

---

## 5. Checklist: does my change need a sibling repo?

| Change here | Also do |
|---|---|
| Migration renaming/dropping a column on a §2 table | Grep both automators; expand/contract; ship consumers before the drop |
| Adding a table to `BRAND_SCOPED_TABLES` | Grep both automators; mirror into `src/store/brandScoped.ts` if read there |
| SQL doing date math on `thoughts."createdAt"` | Clamp for future-dated rows (§2) |
| Changing the shape or auth of `/v1/habits/pacts/digest/run-daily` | Update `therr-messaging-automator/src/api/habitsDigest.ts` |
| Renaming/dropping any `habits.habit_phases` column | Grep `therr-messaging-automator/src/store/HabitPhasesStore.ts`; it reads the row and **writes** `maintenanceEmailedStage` / `lastComebackEmailedAt` |
| Changing how `lastConsistencyPercent` is computed | It is read, not recomputed, by the automator's maintenance email — the number users see in both channels comes from this repo alone |
| Changing `k8s/prod` users-service ports, selector, or NetworkPolicy | Re-check the internal LB path in §3 |
| Needing a new scheduled backend job | Multiplex onto an existing Cloud Function (§4), or budget for a paid job |
| Adding a public API route the marketing site consumes | Coordinate with `therr-landing`; it pins absolute `api.therr.com/v1/...` URLs |
| Editing `therr-client-web/src/data/habitsBlogPosts.json` | Don't — it is generated. Change the `habits` block in `therr-landing`'s `src/data/blog-posts.json` and re-run the export |

Known gaps, in rough value order: no schema contract test (a test in each automator running
its store queries against a migrated schema would be the highest-value gate available), no
shared locale check across repos, no Renovate/Dependabot anywhere, no telemetry — so every
failure above is currently found by a human noticing.

---

## Habits blog cross-posts (therr-landing → this repo)

The only content coupling between the two repos, and the only one that is a
**build-time file handoff rather than a shared database or an HTTP call**.

### Why it exists

therr.app's blog is the only organic channel that grows on its own (+58% over the
60 days to 2026-08-24, from roughly a dozen posts). `habits.therr.com` — the
domain that actually sells Friends with Habits — shipped with a three-URL sitemap
and no content, while the habit-and-accountability posts that rank sat on the
other domain.

### How it works

1. A post in `therr-landing/src/data/blog-posts.json` gains a `habits` block:
   its own slug, title, description, excerpt, keywords, and an **adapted**
   `bodyHtml`.
2. `npm run export:habits-blog -- --out <path>` in therr-landing validates every
   block and writes the consumable JSON.
3. That file is committed here at `therr-client-web/src/data/habitsBlogPosts.json`,
   **on `general`** — habits.therr.com is served by the production therr-client-web
   pod, so a niche branch would never ship it.
4. `therr-client-web/src/utilities/habitsBlog.ts` reads it; the habits middleware
   in `server-client.tsx` serves `/blog` and `/blog/:slug`, and the habits
   `sitemap.xml` is generated from the same list so a post can never be published
   without a sitemap entry.

### The rule that keeps this safe

**A cross-post is not a copy.** Both the therr.app original and the habits version
are self-canonical, so two near-identical pages on two domains compete, Google
picks one, and the loser gets nothing — which would put the therr.app rankings
that currently work at risk. The habits version must carry its own title, framing,
opening and close, written for someone deciding whether to start a pact.

`assertAdapted` in `therr-landing/scripts/export-habits-blog.ts` enforces this
mechanically: it compares 5-word shingles between the two bodies and fails the
export above 50% overlap. Pasting the original in does not "just work".

### Cross-post a post when…

…its subject is habit formation, accountability, streaks, or the friendships that
carry them. Leave it on therr.app when it is about local discovery, businesses,
creators, or privacy. Skip app-roundup listicles outright — Friends with Habits is
one entry among ten in those, so there is no honest habits-first version.

### Gotcha

No CI in either repo checks this. Step 3 is manual, and a `habits` block edited in
therr-landing changes nothing in production until the export is re-run and the
regenerated JSON is committed here.
