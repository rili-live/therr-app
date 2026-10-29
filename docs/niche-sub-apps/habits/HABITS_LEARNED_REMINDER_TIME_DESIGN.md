# Learned Reminder Time — Design

**Status:** Proposed (2026-10-29). Not implemented.
**Lands on:** `general` (all of Phase 1 is `therr-services/users-service`). Phase 3 is mobile UI and
may ride a `niche/HABITS-general` PR.
**Supersedes:** the "Send-time personalization" item (§2) in
[`docs/PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md`](../../PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md)
for habit reminders. That item proposed learning from session-start times; check-in times are a
better signal for this notification, because they tell us when the user *does the habit*, not when
they open the app.

---

## 1. Problem

The check-in nudge (`streakAtRisk` / `dailyHabitReminder`, rolled up to one push per user per day by
`utilities/checkinNudgeRollup.ts`) has two delivery slots, both decided in
`utilities/localReminderSchedule.ts → resolveReminderSchedule()`:

| Slot | Today's target | Source |
|---|---|---|
| Morning (streak status) | `settingsPreferredReminderTime`, else **08:00** local | explicit or default |
| Last chance (evening) | `settingsPreferredEveningReminderTime`, else **19:30** local | explicit or default |

Very few users ever open Settings → Notifications, so in practice almost everyone gets 08:00 and
19:30 (±15 min jitter). That is wrong in both directions for most people:

- Someone who reliably checks in at **06:15** gets a "time to check in" nudge two hours *after*
  they did it. The freshness gate (`utilities/checkinNudgeFreshness.ts`) suppresses it — so for this
  user the morning slot is dead weight that never fires.
- Someone who reliably checks in at **21:45** gets "last chance" at 19:30, two hours before they were
  going to do it anyway. That's the "the app doesn't know what I do" moment the freshness gate
  exists to prevent. It teaches them the warning is noise.
- Someone who checks in at **12:30** gets a morning nudge at 08:00 that is four hours early. Too
  early to act on, so it gets swiped.

We already store everything needed to do better: every completed check-in carries `completedAt`
(server instant, set once and never overwritten on edit — `habitCheckins.ts`) and `localDate`, and
`main.users.settingsTimezone` is reported by the client on every push registration.

## 2. Goal

Derive, per user, **when they typically check in**, and place each reminder **relative to that
time**:

- the morning nudge a little *before* their usual start, so it reaches them as a cue rather than
  an afterthought;
- the last-chance nudge a little *after* their usual latest check-in, so it fires only when the day
  has actually gone differently from normal.

Non-goals for v1: per-habit reminder times (the nudge is one roll-up per user, so the anchor is per
user), weekday/weekend split (Phase 2), ML. This is order statistics over a 4-week window.

## 3. Precedence (the one rule that must not change)

```
explicit user choice  >  learned time  >  env default
```

An explicit `settingsPreferredReminderTime` / `settingsPreferredEveningReminderTime` always wins.
The user told us; their statement beats our inference. Learned times only replace the **default**.

The learned time is treated like the default, **not** like an explicit choice, when
`resolveReminderSchedule` applies quiet hours. Specifically, it never shrinks the default quiet
window the way an explicit choice does (`localReminderSchedule.ts` lines ~496–506). If a learned
target would fall inside quiet hours, the existing rules push it out. Inference is not consent to
being woken up.

## 4. The signal

### 4.1 Which check-ins count

From `habits.habit_checkins`, for each user, over the **last 28 local days**:

- `status = 'completed'` and `completedAt IS NOT NULL`;
- aggregated to **one row per (userId, localDate)**: `MIN(completedAt)` = *first* check-in of the
  day, `MAX(completedAt)` = *last* check-in of the day.

Aggregating per day matters. Without it, a user with six habits who logs them all at 07:00 on one
day outweighs five days of single 07:00 check-ins, and the number of habits a user tracks starts
moving their reminder.

The first and last check-in times answer different questions, and each slot uses the one that
matches what it is for:

| Slot | Question it answers | Statistic |
|---|---|---|
| Morning | "When does this person *start* doing their habits?" | per-day **first** check-in |
| Last chance | "By when have they *usually finished*?" | per-day **last** check-in |

This also handles the bimodal user (a 06:30 run and a 22:00 journal) without any clustering. The
first-check-in distribution sits in the morning and the last-check-in distribution sits at night.

### 4.2 Which check-ins don't count

1. **Backdated check-ins.** `resolveCheckinHabitDate` lets a user log a past day. The time they
   logged "yesterday" says nothing about when they do the habit. Exclude a day-row when the local
   date of `completedAt` is not `localDate`. The one exception is the **late-night spill** in §4.3.
2. **Edits.** Already handled: `completedAt` is only set on the first transition to completed
   (`habitCheckins.ts` ~L1470), so re-saving notes doesn't move the timestamp.
3. **Prompted check-ins (down-weighted, not excluded).** A check-in made within 60 minutes after a
   check-in nudge was *sent* to that user is partly caused by our reminder. If it counted at full
   weight, the system would chase its own tail: remind at 08:00 → check-in at 08:05 → learn 08:05 →
   remind at 07:20 → check-in at 07:25 → … drifting earlier every week. These samples get weight
   **0.35**. They are not excluded, because a user who *wants* to check in when reminded is giving
   us a real signal too. Lookup: `main.notificationQueue` rows with `status = 'sent'` and a type in
   `CHECKIN_NUDGE_TYPES`. That table is brand-scoped, so the read goes through
   `NotificationQueueStore` with the brand predicate, never raw.

### 4.3 Time of day, without the midnight bug

Minute-of-day wraps. A user who checks in at 23:50 and 00:10 does not "average" to noon. Two rules
handle this:

- **Local time per sample.** Each `completedAt` is converted to minutes-of-day with
  `getLocalParts(timeZone, completedAt)` using the user's zone *evaluated at that instant*, so DST
  transitions inside the window are correct.
- **Day anchor at 04:00.** A minute earlier than `DAY_ANCHOR = 04:00` is read as belonging to the
  previous habit-day and is unwrapped to `minute + 1440`. So 00:10 becomes 24:10, and 23:50 and
  00:10 sit 20 minutes apart, as they should. This is also the **late-night spill** exception to
  §4.2.1: a row whose `completedAt` falls on `localDate + 1`, before 04:00, is kept and unwrapped
  rather than discarded as backdated. Night owls are exactly the users the 19:30 default serves
  worst.

### 4.4 Which timezone

v1 uses the user's **current** `settingsTimezone` (fallback `FALLBACK_TIME_ZONE`, as everywhere else
in `localReminderSchedule.ts`). A traveler's check-ins from their previous zone are misread for at
most the 28-day window, and the recency weighting in §5.1 means the new zone dominates within about
a week. That is an acceptable error for v1, and it avoids a migration.

v2 option (only if the metrics in §8 show travelers matter): an additive nullable column
`habits.habit_checkins."completedLocalMinute" smallint`, written by the check-in handler from the
device `timeZone` it already receives in the request body. No backfill, because the read falls back
to computing from `completedAt` when the column is NULL.

> **Forward guard for offline-first.** `completedAt` is the *server's* clock when the request
> arrives. Today there is no offline outbox for check-ins, so that matches the user's action. When
> `docs/OFFLINE_FIRST_PLAN.md`'s optimistic check-ins land, the client must send its own completion
> instant, and the handler must use it (bounded to ≤ now). Otherwise a check-in synced at 09:00
> after a 06:30 run in a tunnel teaches this feature that the user runs at 09:00.

## 5. The algorithm

Pure function, no DB and no clock of its own, in the same style as `localReminderSchedule.ts` and
for the same reason (DST, date-line and wrap cases must be reachable from a test):

```ts
// therr-services/users-service/src/utilities/checkinTimeProfile.ts
learnCheckinTimeProfile(days: ICheckinDaySample[], timeZone: string, now: Date): ICheckinTimeProfile
```

### 5.1 Weights

Each day-sample gets:

```
w = 0.5 ^ (ageInDays / HALF_LIFE_DAYS)        // HALF_LIFE_DAYS = 10
  × (prompted ? PROMPTED_WEIGHT : 1)          // PROMPTED_WEIGHT = 0.35
```

A 10-day half-life means a schedule change (new job, school term) mostly takes over in 1–2 weeks. It
also means one odd Saturday can't swing next Monday's reminder.

### 5.2 Statistics

Weighted quantiles over the unwrapped minutes:

| Output | Definition |
|---|---|
| `typicalStart` | weighted **P25** of per-day *first* check-in |
| `typicalFinish` | weighted **P85** of per-day *last* check-in |
| `startSpread` | weighted IQR (P75 − P25) of first check-in |

Why P25 and P85, not the median: a reminder that lands *after* the user's usual time on half of
days is late on half of days. P25 means the morning nudge precedes the start on roughly three days
in four. P85 means "last chance" only fires once the user is later than they almost always are.

### 5.3 Targets

```
learnedMorning = typicalStart  − LEAD_MINUTES        // LEAD_MINUTES  = 30
learnedEvening = typicalFinish + GRACE_MINUTES       // GRACE_MINUTES = 60
```

Then each target is:

1. **Shrunk toward the default by confidence** (§5.4):
   `target = default + confidence × (learned − default)`.
2. **Rounded** to 5 minutes. Jitter (±15, already applied by `resolveReminderSchedule`) does the
   day-to-day variation. Rounding stops the stored inference from twitching by a minute every day.
3. **Clamped** into the existing `MORNING_REMINDER_WINDOW` (05:00–11:30) /
   `EVENING_REMINDER_WINDOW` (16:00–23:00). Those windows were chosen so the two slots can never be
   closer than `MIN_MINUTES_BETWEEN_SLOTS` even at the jitter edges (see the comment on them in
   `localReminderSchedule.ts`). Reusing them means the learned path inherits that guarantee instead
   of re-proving it.

### 5.4 Confidence

```
effectiveDays = Σ w                      (over day-samples in the window)
confidence    = clamp((effectiveDays − MIN_DAYS) / (FULL_DAYS − MIN_DAYS), 0, 1)
                                           // MIN_DAYS = 3, FULL_DAYS = 10
if startSpread > 5h: morning confidence ×= 0.5
```

- Under ~3 effective days → confidence 0 → exactly today's default. A new user's first week is
  unchanged.
- The shrinkage gives a smooth handover rather than a jump on day N.
- A wildly irregular user (first check-in anywhere from 06:00 to 15:00) stays close to the default.
  When a person has no typical time, the default is as good a guess as any.

### 5.5 Worked examples (default zone, no explicit preferences)

| User | First check-ins | Last check-ins | Morning today → learned | Evening today → learned |
|---|---|---|---|---|
| Early runner | ~06:10–06:40 | ~06:40 | 08:00 → **05:40** | 19:30 → **16:00**¹ |
| Lunch logger | ~12:15–13:00 | ~13:00 | 08:00 → **11:30**² | 19:30 → **16:00**¹ |
| Night owl | ~21:30–22:15 | ~23:40 (some 00:20) | 08:00 → **11:30**² | 19:30 → **23:00**³ |
| Bimodal | 06:30 run | 22:00 journal | 08:00 → **06:00** | 19:30 → **23:00**³ |
| New (2 days) | — | — | 08:00 (conf. 0) | 19:30 (conf. 0) |

¹ Clamped to the window floor. The early runner's last-chance fires at 16:00 only on a day they
haven't checked in by mid-afternoon — which, for them, really is a missed day.
² Clamped to the window ceiling. See open question Q1.
³ Clamped to 23:00. The night owl's 00:20 spill was unwrapped (§4.3) rather than read as an
early-morning check-in. 23:00 is still subject to `latestUsable`: with default quiet hours starting
21:30, the slot is pulled back to 21:00 unless the user has set their own quiet hours. That's the
existing early-sleeper rule working as designed. See Q2.

## 6. Integration

### 6.0 Constraint: the digest decides once a day

A learned time is only useful if something schedules the nudge *before* that time arrives. Today
nothing does for most users. The digest fires once, at 09:00 America/Chicago (14:00–15:00 UTC), and
`resolveReminderSchedule` rule 1 turns a slot that has already passed locally into "as soon as
possible":

| Zone at decision time | Morning slot today | Evening slot today |
|---|---|---|
| US Pacific (~07:00) | target honoured | target honoured |
| US Central/Eastern (09:00–10:00) | **already passed → ASAP** | target honoured |
| Western/Central Europe (15:00–16:00) | **already passed → ASAP** | honoured if ≥ decision time |
| Asia / Oceania (late night) | quiet hours → **tomorrow's target** | dropped (`null`) |

So the **evening** learned time works on the current cadence for the Americas and most of Europe.
The **morning** learned time does not: the early runner in Chicago is nudged at ~09:00 whatever we
learn, and the freshness gate suppresses that nudge because they're already done.

Fix: add a **morning pass**. The same `/habits/pacts/digest/run-daily` endpoint fires hourly, with a
`?slot=morning` mode that runs only the check-in nudge roll-up and queues only users whose morning
target falls in `[now, now + 60 min)`. That is safe to run repeatedly, by construction: the dedupe
key is `checkin-nudge:<date>`, so the first pass to queue a user for the day wins and every later
pass inserts nothing. The once-daily full run stays as it is and becomes the catch-all for anyone
the hourly passes did not reach.

The once-daily full run remains the only firing for everything else in the digest (streak
finalization, pact sweeps, recaps).

This is a **cross-repo change**. The scheduler lives in `therr-infra-terraform`, and the caller is
`therr-messaging-automator/src/api/habitsDigest.ts`
(`docs/CROSS_REPO_INTEGRATION.md` §3). For that reason it is a separate phase (§9, 1b) and not a
precondition for the evening half.

### 6.1 Data access (one query per digest run, no migration)

New method on `UserHabitsStore`, served by the existing `("userId", "localDate")` index:

```sql
SELECT "userId", "localDate",
       MIN("completedAt") AS "firstCompletedAt",
       MAX("completedAt") AS "lastCompletedAt"
  FROM habits."habit_checkins"
 WHERE "userId" IN (...)               -- only users in this run's nudge roll-up
   AND "localDate" >= :since           -- today − 29 (one extra day for the late-night spill)
   AND "status" = 'completed'
   AND "completedAt" IS NOT NULL
 GROUP BY "userId", "localDate"
```

At most ~29 rows per user. `habits.habit_checkins` is not brand-scoped, but `habits.*` is HABITS-only
by construction. Plus one read via `NotificationQueueStore` for sent check-in nudge instants in the
same window (prompted weighting, §4.2.3).

Both reads run in `habitsDigest.ts` next to the existing `Store.users.getHabitReminderPreferences`
batch, and **fail the same way it does**: on error, log, count, and fall back to `{}`. Every user
then gets today's defaults. A failed read must degrade to current behaviour and never skip a nudge.

Neither automator reads anything new, and nothing is written, so there is no cross-repo surface
(`docs/CROSS_REPO_INTEGRATION.md`).

### 6.2 Scheduler changes (`localReminderSchedule.ts`)

Additive fields on `IReminderPreferences`, in minutes (already parsed), not `time` strings:

```ts
/** Learned from check-in history (checkinTimeProfile.ts); null/undefined = no inference. */
learnedMorningMinutes?: MinutesOfDay | null;
learnedEveningMinutes?: MinutesOfDay | null;
```

Inside `resolveReminderSchedule`:

```ts
const learnedMorning = readLearnedTime(preferences.learnedMorningMinutes, 'morning'); // window-checked
const morningTarget  = explicitMorning ?? learnedMorning ?? parseTimeOfDay(DEFAULT_MORNING_LOCAL_TIME);
// …same for evening
```

The quiet-hours shrinking block keys on `explicitMorning` / `explicitEvening` only. It stays
unchanged, which is how §3's "learned is not consent" rule is enforced. The "mirror jitter forward
out of quiet hours" branch currently checks `explicitMorning === null`. That stays correct, because
a learned target is subject to the same protection as the default.

Replace the two booleans `usedPreferredMorningTime` / `usedPreferredEveningTime` on the result with
`morningSource` / `eveningSource: 'explicit' | 'learned' | 'default'`, keeping the booleans as
derived getters until callers move. The digest counts them.

The other `resolveReminderSchedule` callers (weekly recap, pledge verdicts, pact invites, open-pact
suggestions, onboarding nurture) pass no learned fields and are unaffected. Whether any of them
should also use the learned morning time is a Phase 2 question, decided per notification.

### 6.3 Digest wiring (`habitsDigest.ts`, check-in nudge drain ~L1290)

```ts
const learned = isLearnedReminderTimeEnabledFor(row.userId)
    ? profiles[row.userId]          // from learnCheckinTimeProfile, computed once per user
    : undefined;
const schedule = resolveReminderSchedule(
    { ...preferences, learnedMorningMinutes: learned?.morning, learnedEveningMinutes: learned?.evening },
    decidedAt,
    { jitterSeed: row.userId },
);
```

The dedupe key (`checkin-nudge:<today>`) is date-stamped, not time-stamped, so moving a slot can
never create a second row. The same guarantee jitter already relies on.

### 6.4 Flags

| Env var | Default | Meaning |
|---|---|---|
| `HABIT_LEARNED_REMINDER_TIME_ENABLED` | `false` | Master switch. Off = byte-for-byte today's behaviour. |
| `HABIT_LEARNED_REMINDER_TIME_ROLLOUT_PERCENT` | `50` | Deterministic bucket on `sha256(userId)`; the rest are the control group. |

The tuning constants (`LEAD_MINUTES`, `GRACE_MINUTES`, `HALF_LIFE_DAYS`, quantiles) live as exported
constants in `checkinTimeProfile.ts`, not env vars. They should change through a reviewed diff with
its test cases, not a config edit.

## 7. Interaction with existing safeguards

| Safeguard | Effect of this change |
|---|---|
| Freshness gate (`checkinNudgeFreshness.ts`) | Still suppresses a nudge whose habits are all done. Morning nudges placed *before* the usual start make it suppress less, which is the point: today's 08:00 nudge is mostly suppressed for early users. |
| Quiet hours | Unchanged; learned targets get no quiet-hours exemption (§3). |
| 4-hour slot gap | Inherited from the windows (§5.3) plus the existing `isFarEnoughFromMorning` check. |
| Jitter | Unchanged, applied on top of the learned target. |
| Dedupe | Unchanged; date-stamped keys. |
| `settingsPushHabitReminders` / `settingsPushStreakAlerts` | Unchanged; checked before scheduling. |

## 8. Measuring it

Add to the digest's counters (they flow into the logs `therr-messaging-automator` already collects):
`remindersMorningLearned`, `remindersEveningLearned`, `remindersLearnedLowConfidence`,
`learnedProfileReadFailed`.

Compare the treatment and control buckets over 3–4 weeks:

1. **Primary:** share of nudged user-days with ≥1 check-in on that local day.
2. Nudge suppression rate at the freshness gate. This should **drop** for the morning slot, because
   fewer nudges arrive after the habit was already done.
3. Last-chance → check-in within 2 h (conversion of the escalation).
4. **Guardrail:** rate of users turning off `settingsPushHabitReminders` or OS-level notifications.
   Any rise in treatment is a stop signal regardless of 1–3.

## 9. Phases

**Phase 1a — backend, `general`. Ships the evening half on the current cadence.**
- `utilities/checkinTimeProfile.ts` + `__tests__` (wrap at the 04:00 anchor, DST weeks, the date
  line, backdated exclusion, prompted down-weighting, confidence ramp, clamping, bimodal).
- `UserHabitsStore.getCheckinDaySamples`, `NotificationQueueStore.getSentCheckinNudgeTimes`.
- `localReminderSchedule.ts` learned fields + precedence + `*Source`; extend its existing test
  suite with "explicit beats learned" and "learned never shrinks default quiet hours".
- Digest wiring, flag, counters. `docs/FEATURES.md` entry.
- Both learned times are computed and passed. The morning one only takes effect where the daily
  run happens to precede it (§6.0), and the counters make that visible.

**Phase 1b — hourly morning pass (§6.0), `general` + `therr-infra-terraform` +
`therr-messaging-automator`.**
- `slot=morning` mode on the digest endpoint: nudge roll-up only, users whose morning target is in
  the next hour.
- An hourly Cloud Scheduler job (terraform) and the automator passing the mode through.
- Manual Operational Follow-up: confirm in logs that hourly passes queue rows and that the daily
  run's `checkin-nudge` inserts drop correspondingly (dedupe doing its job).

**Phase 2 — refinement, `general`.** Weekday/weekend profiles when each side has ≥ `MIN_DAYS`
effective days. Decide per other digest whether it should use the learned morning time. Optionally
the `completedLocalMinute` column (§4.4).

**Phase 3 — mobile, can be `niche/HABITS-general`.** Expose the learned times read-only on the
settings payload and show them in Settings → Notifications, e.g. *"Automatic — around 6:00 AM, based
on when you check in"*, with the existing picker as the override. Needs locale strings in all three
dictionaries. Showing the inference is also how users notice and correct a bad one.

## 10. Open questions

- **Q1. Users whose day starts after the morning window.** The lunch logger and the night owl get a
  morning nudge clamped to 11:30, still hours before they act. Alternative: when `typicalStart` is
  past the morning window with high confidence, skip the morning slot and send only the evening one
  at their usual time. That reduces push volume for these users, but it changes the "everyone gets
  a morning nudge" rule (`localReminderSchedule.ts` rule 3), so it is a product call, not a tuning
  one.
- **Q2. Night owls under default quiet hours.** Default quiet hours start at 21:30, so a learned
  23:00 last-chance is pulled to 21:00. Should consistent check-ins after 21:30 count as evidence
  for a later default quiet-hours start for that user? §3 says no for v1. Revisit with Phase 2 data.
- **Q3. Pact partners.** Partner-activity pushes are event-driven and out of scope. A future "your
  partner usually checks in by now" nudge could reuse `typicalFinish` from the partner's profile.
