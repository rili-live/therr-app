# Notification queue — design

**Status:** live — the habits digest is the first producer, and the worker is enabled
(`NOTIFICATION_QUEUE_WORKER_ENABLED=true` in `k8s/prod`)
**Scope:** all brands; the immediate driver is HABITS send frequency
**Companion docs:** [`PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md`](./PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md) (what to send), [`PUSH_NOTIFICATIONS_DEBUGGING.md`](./PUSH_NOTIFICATIONS_DEBUGGING.md) (why one didn't arrive)

---

## Why

The goal is Duolingo-style engagement cadence. The obstacle is not the pipes —
delivery works — it is that today a notification is **sent inline at the moment
its triggering event happens, with no record that it happened.** Three
consequences, each of which independently blocks raising frequency:

**1. No dedup.** The habits digest re-sends everything if it runs twice. Root
`CLAUDE.md` carries a standing rule — *"the habits digest has no server-side
dedup. Once-a-day is a property of there being a single Cloud Scheduler job, not
of the code. Never add a second trigger path."* That rule is a convention
enforced by nothing. A `UNIQUE (brandVariation, userId, dedupeKey)` index
replaces it with a constraint, which is what makes it safe to have more than one
producer at all.

**2. No scheduling.** "Send in the evening" means one global Cloud Scheduler
firing — evening in exactly one timezone. There is no user timezone column
anywhere in the schema. `scheduledFor` decouples *deciding* to notify from
*notifying*, which is the prerequisite for send-time personalization (roadmap
item #2, 15–40% on opens).

**3. No cross-type rate limit.** `MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS` guards
only location/area pushes inside push-notifications-service. Nothing counts what
a user received today across all types. The roadmap caps at 3–5/day and warns
that past that point frequency *reduces* DAU — a cap with no enforcement point
is a hope. A single queue is the only place that check can exist.

Raising frequency without these is a one-way bet on user tolerance, where the
opt-out is uninstall.

---

## Shape

```
producers                  queue                     worker                sender
─────────                  ─────                     ──────                ──────
handlers, digest  ──►  main.notificationQueue  ──►  users-service  ──►  push-notifications
enqueueNotification()   (dedup + scheduledFor)      30s interval         -service
                                                    daily cap +
                                                    15-min spacing
      ▲
      │
Cloud Scheduler ──► therr-messaging-automator ──► POST /habits/pacts/digest/run-daily
                    (a clock, nothing more)
```

### The automator stays a clock

It must not send. Sending needs the copy, all three locales, the per-brand
Firebase app, Android channel routing and brand intent actions — all in
push-notifications-service. A Cloud Function sending directly would duplicate
that surface in a repo with **no CI checking the coupling**
([`CROSS_REPO_INTEGRATION.md`](./CROSS_REPO_INTEGRATION.md)). It already pokes
users-service over the internal LB; that is the right role.

### Why not pg-boss

pg-boss is a good library and its `sendOnce`/cron would give dedup and
scheduling for free. Two things ruled it out here:

- **It self-migrates its own `pgboss` schema at boot**, outside the Knex
  migration system that `therr/require-idempotent-migration` and the
  expand/contract discipline exist to protect — in a database two sibling repos
  read directly. That is precisely the coupling hazard this repo has already
  been bitten by.
- **What we needed from it is small**: dedup (a unique index), delayed
  scheduling (a timestamp column), bounded retry and `SKIP LOCKED`. That is
  ~150 lines in `NotificationQueueStore`, in our migration system, greppable by
  the automators.

pg-boss also wants a long-running process, which rules out hosting it in the
Cloud Function regardless. Revisit if job types multiply or multi-step workflows
appear.

### Why the worker lives in users-service

It is long-running, runs at `replicas: 1`, and already owns
`sendEmailAndOrPushNotification`. `SKIP LOCKED` is insurance against a future
scale-up rather than a present requirement.

---

## Data model

`main.notificationQueue` — brand-scoped from birth, registered in
`eslint-config/brand-scoped-tables.js` with `NotificationQueueStore` as its
sanctioned accessor.

| Column | Notes |
|---|---|
| `brandVariation` | **No default**, unlike other brand-scoped tables. They default to `'therr'` so backfilled rows stay visible; this table has no legacy rows, so a default would only let a caller that forgot the brand silently file under Therr. |
| `dedupeKey` | Caller-supplied. The entire dedup mechanism — see below. |
| `payload` | `jsonb`. Carries the `ISendPushNotification` extras (habitName, streakCount, …), which vary per type and change with copy. Never queried on, so nothing to gain from columns and a schema change per notification type to lose. |
| `status` | `pending` / `sent` / `failed` / `skipped`. `skipped` = deliberately not sent (cap, preference, no token) — distinct from `failed` so suppression is measurable rather than looking like breakage. |
| `scheduledFor` | Defaults to `now()`. The send-time personalization hook. |

Indexes: the claim index is **partial** (`WHERE status = 'pending'`) — the table
will be overwhelmingly `sent` rows awaiting retention, and the hot path should
scale with the backlog, not with history.

### dedupeKey is the one thing callers must get right

It must encode everything that makes the notification distinct **including its
period**:

- once-per-day → `pact-expiring:<pactId>:2026-08-08`
- once-per-event → `pact-accepted:<pactId>:<memberId>`
- once-per-user-per-day → `checkin-nudge:2026-08-08`, with no id at all: the
  recipient is already half of the unique constraint, so an id here can only
  *widen* the key and let a duplicate through
- **never** interpolate `Date.now()` or a random value — that makes every
  enqueue unique, which silently turns dedup off

A key that is too narrow is the failure mode worth watching for. Check-in
nudges were keyed per pact *and* per habit — `streak-at-risk:<pactId>:<date>`
from the pact loop, `streak-at-risk:habit:<habitGoalId>:<date>` and
`daily-habit-reminder:<habitGoalId>:<date>` from the reminder pass. Every key
deduped correctly against itself and the user still received up to five copies
of the same sentence, because the keys named different things. Deduplication
cannot fix a producer that genuinely intends several notifications; the fix was
to make the producer intend one (see `checkinNudgeRollup.ts`).

Enqueue is `ON CONFLICT DO NOTHING` (not `DO UPDATE`): a re-run must not reset
`scheduledFor` or resurrect a row already sent.

### Claim semantics

`claimDue` flips rows straight to `failed` with `attempts + 1`, not to a
`processing` state. A worker that crashes mid-batch therefore leaves rows in a
terminal, *visible* state with the attempt counted, instead of a limbo needing
its own reaper. The happy path overwrites with `sent` moments later;
`requeueFailed` is the explicit, bounded retry (`MAX_ATTEMPTS = 3`).

---

## Producers

### The habits digest (live)

`habitsDigest.ts` queues all three of its types instead of sending inline:

| Type | dedupeKey | `scheduledFor` |
|---|---|---|
| `pactExpiring` | `pact-expiring:<pactId>:<YYYY-MM-DD>` | now |
| `streakAtRisk` / `dailyHabitReminder` | `checkin-nudge:<YYYY-MM-DD>` | the user's local morning |
| `eveningCheckIn` (the "last chance" nudge) | `last-chance:<YYYY-MM-DD>` | the user's local evening |
| `partnerMissedDay` | `partner-missed-day:<pactId>:<missingMemberId>:<YYYY-MM-DD>` | now |

The check-in nudge is one row per **user** per day, whichever of the two types
it ends up as. Both the pact loop and the reminder pass record into an
accumulator keyed on the habit goal, and the run drains it once at the end: the
framing (`streakAtRisk` when any habit has a live streak, citing the longest
one; `dailyHabitReminder` otherwise) can only be chosen after every habit at
stake for that user is known. A nudge naming exactly one habit carries
`habitGoalId`, which is what lets the notification offer a one-press check-in.

Two things in that table are load-bearing and neither is obvious:

- **`pactExpiring` is keyed on the date, not on `daysRemaining`**, even though
  `daysRemaining` also changes once a day. A run either side of midnight would
  compute a different `daysRemaining` for the same calendar day and queue a
  second warning.
- **`partnerMissedDay` names the member who slipped, not the recipient.** The
  recipient is already half of the unique constraint, so leaving it out of the
  key costs nothing — but leaving out the *slipping* member means a pact where
  two partners both missed yesterday notifies the third member about only the
  first of them.

### Send-time personalization (live)

The digest is poked once a day at 14:00 UTC and used to queue everything with
`scheduledFor = now()`, so its own comment — *"run it in the evening"* — was
true in `America/Chicago` and nowhere else. Berlin got its *morning* nudge at
16:00; Auckland got "check in before midnight" at 02:00, six hours after the
midnight in question.

`utilities/localReminderSchedule.ts` now turns one firing into two per-user
instants, from `main.users.settingsTimezone` (written by the mobile client on
every push registration) plus the three preference columns that had never been
read by anything: `settingsPreferredReminderTime`, `settingsQuietHoursStart`,
`settingsQuietHoursEnd`. Four rules, each of which is a case that would
otherwise produce a bad push:

1. **Never schedule into the past.** A slot whose local time has passed becomes
   "as soon as possible", not "tomorrow" — a day's deferral would make the
   streak counts stale before they were ever sent.
2. **Never schedule inside quiet hours.** A morning slot that lands there moves
   to the *end* of quiet hours: bounded by half a day, not a full one.
3. **The evening slot may be dropped.** "Last chance to keep today's streak"
   delivered tomorrow morning is nonsense, so when the local day has no room
   left the correct output is no notification at all.
4. **At least four hours between the two slots**, so a user whose morning nudge
   was itself deferred to 18:00 is not told "last chance" at 19:30.

A user with no stored timezone falls back to `America/Chicago` — the zone the
scheduler already fires in — so they keep exactly the delivery time they have
today, and the change is strictly additive.

### Relevance expires: the send-time gate

Deciding hours before sending creates a failure the queue had not had before.
Every other row here is a fact — a partner checked in, a pact ended — and is
still true tonight. A check-in nudge is a claim about something the user has
**not yet done**, and in the hours between the digest and the evening slot most
people do it. Sending "your 12-day streak is on the line" to someone who checked
in at lunchtime teaches them the app does not know what they have done, which is
how notifications get turned off for good.

Nothing upstream can catch it: the producer was right when it queued the row and
the send succeeds. So `utilities/checkinNudgeFreshness.ts` re-reads
`habits.habit_checkins` in the worker, before the daily cap is consulted, and
marks the row `skipped` with `already-checked-in` when every habit it names is
done. Ordering matters — a row that no longer needs sending must not spend one
of the user's five daily sends.

Two properties keep it honest. It **fails open**: a read failure sends, because
silence on the feature whose purpose is not being silent is invisible, while an
extra push is visible and recoverable. And it only acts on rows carrying
`habitGoalIds` + `checkinDate`, so a row queued before the stamp existed passes
through unchanged rather than being suppressed for lack of evidence.

The handler still evaluates every pact on a re-run; dedup is the queue's job,
not a short-circuit in the producer. So a second run of the same day does the
same reads, attempts the same enqueues, inserts nothing, and reports the whole
lot under a new `deduped` counter. `tests/unit/handlers-habits-digest.test.ts`
runs the handler twice against a fake queue that enforces the same constraint
Postgres does, and asserts on the keys — including that none of them carries a
clock reading.

The digest's `*Sent` counters keep their names because
`therr-messaging-automator` logs that exact shape, but they now count rows
*queued*. What was actually delivered is in the table.

`enqueueNotification` returns `'queued' | 'duplicate' | 'failed'` rather than a
boolean for one reason: a producer must be able to separate "already queued for
this period" from "the queue is broken". Both insert nothing, but only the first
is healthy — and since the automator reads *"all `*Sent` zero + `deduped` > 0"*
as *"already ran today"*, a failed enqueue counted as a dedup would make a
missing table or an exhausted write pool report as a clean re-run while
notifying nobody. Failures land in `errors`. Any new producer should map the
three outcomes the same way.

## What is NOT built yet

### Blockers to clear before raising frequency

**1. Most push preferences are still not honored server-side.**
`settingsPushMarketing`, `settingsPushBackground`, `settingsPushInvites`,
`settingsPushLikes`, `settingsPushMentions`, `settingsPushTopics` all exist as
columns, are settable through the API, and flow through `therr-react`.
`sendEmailAndOrPushNotification` reads exactly one thing: `isUnclaimed`. And
`ManageNotifications.tsx` renders **email** toggles only — there is no push
category UI at all, so a user's only control over most types is the OS switch.

The habits reminders are the exception and the template: the digest reads
`settingsPushHabitReminders` (suppresses both daily slots) and
`settingsPushStreakAlerts` (suppresses only the evening escalation), counting
each so the suppression is measurable. Both default `true`, and **no client
writes either of them yet** — the columns work, the UI does not exist. That UI
is the next thing worth building here; everything else stays uncontrollable
until it does.

**2. ~~No user timezone~~ — done.** `main.users.settingsTimezone` is written by
the mobile client on every push registration and read by
`utilities/localReminderSchedule.ts`. Until installs update, most users are on
the `America/Chicago` fallback; the digest's `usersWithoutTimezone` counter is
how that adoption is tracked, and a flat line means the mobile release never
shipped.

**3. More producers.** The digest is the only one. Everything still sending
inline through `sendEmailAndOrPushNotification` is uncapped and undeduped, and
none of it is counted against the 5/day budget the worker enforces — so the cap
is currently a cap on queued notifications, not on notifications.

### Where the frequency actually is

- **Five types are delivery-half-only** — `morningMotivation`, `streakBroken`,
  `newPersonalRecord`, `partnerCelebrated`, `pactCompleted`. Copy in three
  locales, channels, intent actions, tests, and no caller anywhere.
  `dailyHabitReminder` was the seventh and gained a producer with the digest's
  reminder pass; `eveningCheckIn` was the sixth and is now the evening
  "last chance" nudge — reused rather than replaced with a new type precisely
  because a new type is inert until a fresh Android build ships from
  `niche/HABITS-general`, while this one is already wired on installs that
  exist.
- **Silent reward moments** — `habitCheckins.ts` awards a streak freeze at every
  7+ day milestone and says nothing. Exactly the loss-aversion mechanic Duolingo
  leans on, with the state already persisted.
- **`habits.proofs` / `habits.pact_activities`** — partner-visible events with no
  notification path.
- **`main.thoughts`** — ai-automator already drips content over ~30h, with no
  notification attached.

Note what a solo tester can trigger. This used to be essentially nothing: every
live type needed a second human or the digest, and the digest iterated
`activePacts`, so an account with no pact generated zero sends — the only
self-triggered push was `streakMilestone`, at exactly 3/7/14/30/… consecutive
days. The digest's reminder pass now also walks `habits.user_habits`, so a solo
account with one tracked habit and no check-in gets a `dailyHabitReminder` (or
`streakAtRisk`, once it has a streak) on the next run. That pass is the first
producer with a row for nearly every active user, which makes it the first thing
likely to press against the 5/day cap.

---

## Suggested sequence

1. Queue + worker land dark. **(done)**
2. Migrate the digest's three types to `enqueueNotification`; enable the worker;
   confirm dedup by running the digest twice. **(done)**
3. Honor `settingsPush*` in the worker; add the push category UI.
4. Add user timezone; start setting `scheduledFor` per user.
5. Wire the remaining orphaned types and the silent reward moments.
   `dailyHabitReminder` is done — see `habitsDigest.ts`, gated on
   `HABIT_DAILY_REMINDERS_ENABLED` (defaults on).
6. Revisit the 5/day cap with real data.

Steps 3 and 4 are what earn the right to step 5. Doing 5 first is how you find
the frequency cap by hitting it.

---

## Operational notes

- **`NOTIFICATION_QUEUE_WORKER_ENABLED=true`** on users-service turns the worker
  on. Absent = inert. It is set in `k8s/prod`, and in both `.env`
  templates for local runs. Note that unsetting it is no longer a way back to
  the old behavior: the digest queues rather than sends, so with the flag off it
  fills the table and delivers nothing.
- Tunables (`TICK_INTERVAL_MS` 30s, `CLAIM_BATCH_SIZE` 25, `MAX_ATTEMPTS` 3,
  `MAX_SENDS_PER_USER_PER_DAY` 5, `MIN_GAP_BETWEEN_SENDS_MS` 15min,
  `MAX_DEFERRAL_WINDOW_MS` 6h) are module constants, not env vars — there is
  no production experience to configure against yet, and an env var implies a
  knob someone has a reason to turn.
- **The daily cap does not space anything.** It bounds how many notifications a
  user gets, not when, and a tick sends a whole claimed batch within a few
  hundred milliseconds — so four due rows arrived in the same second. The worker
  therefore also enforces a minimum gap per user, *deferring* rather than
  dropping (unlike the cap: a reminder a day late is worse than none, but
  everything hitting the spacing rule is still fine fifteen minutes from now).
  `defer` decrements `attempts`, because `claimDue` increments on claim and a
  deferral must not spend a retry; `MAX_DEFERRAL_WINDOW_MS` stops a busy user
  holding a low-priority row back forever. Deferred rows show `spaced: …` in
  `lastError` — that is a status, not a failure.
- **Batch order is by type, not just `scheduledFor`.** A digest run stamps every
  row with the same `scheduledFor`, so with spacing in play the ordering decides
  which of a user's notifications actually goes out tonight.
  `TYPE_SEND_PRIORITY` puts the time-sensitive nudge ahead of the celebration;
  unlisted types sort last.
- **Rows with no reachable device are skipped, not retried.** `sendOne` resolves
  the device token up front (brand-scoped table, falling back to the legacy
  `users.deviceMobileFirebaseToken` column) and marks `skipped: no-device-token`
  when there is none. Before this, those rows burned all three attempts daily —
  36 production errors in 30 days — and buried real failures in noise.
- Sends are sequential within a batch. A burst of 25 concurrent sends from a
  `replicas: 1` pod is a good way to exhaust the write pool, and throughput is
  not the constraint: 30s × 25 is ~3,000/hour/brand.
- **Retention runs on the worker's own slow cadence** — `sweepRetention` self-throttles
  to roughly hourly (one tick in 120) and deletes in bounded batches, so an untended
  table is worked down over hours rather than in one long DELETE holding the write pool.
  'sent'/'skipped' rows go at 30 days, comfortably outside the 24h rate-limit window that
  `countSentSince` reads. Rows that exhausted `MAX_ATTEMPTS` go at 90 days via
  `deleteExhaustedFailedBefore` — they are the only record of a send that was attempted
  and lost, and leaving them forever would also pin their `(brandVariation, userId,
  dedupeKey)` slot, permanently blocking re-enqueue of a once-per-event key.
- **Send failures reach the row.** `sendEmailAndOrPushNotification` swallows errors by
  default, which is right for inline callers inside a user-facing request but would mark
  every queued row 'sent' regardless of outcome. The worker opts into
  `shouldThrowOnError`, so a failed send lands in `markFailed` and becomes eligible for
  `requeueFailed` — without it the retry budget only ever covered crashes.
- If the automator ever needs to *read* this table, mirror the entry into its
  `src/store/brandScoped.ts` — the lint rule cannot see across repos
  ([`CROSS_REPO_INTEGRATION.md`](./CROSS_REPO_INTEGRATION.md) rule 2). Under this
  design it does not read it.
