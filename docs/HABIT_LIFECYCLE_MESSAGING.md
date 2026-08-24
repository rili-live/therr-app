# Habit Lifecycle Messaging

**Status:** Implemented, deploys dark behind `HABIT_PHASE_ENGINE_ENABLED`
**Applies to:** Friends with Habits (`BrandVariations.HABITS`)
**Related:** [`NOTIFICATION_QUEUE_DESIGN.md`](NOTIFICATION_QUEUE_DESIGN.md),
[`PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md`](PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md),
[`CROSS_REPO_INTEGRATION.md`](CROSS_REPO_INTEGRATION.md)

---

## The problem

The daily digest nudges at one fixed intensity forever. If you have a live
streak and haven't checked in, you get a push — on day 3 and on day 300 alike.
That is wrong in both directions at once:

- **Over-sending to people who have succeeded.** Someone 200 days into a habit
  does not need a nightly reminder. Sending one spends opt-in they will need
  later, and opt-in does not come back.
- **Under-serving people who lapse.** Nothing noticed that a once-solid habit
  had stopped, so the app had no moment at which it could offer a restart.

## What the research actually says

> **"21 days to form a habit" is not a finding.** It traces to Maxwell Maltz's
> 1960 *Psycho-Cybernetics*, a plastic surgeon observing that patients took
> about 21 days to stop seeing their old face in the mirror. It was never a
> habit-formation study, and it has been repeated ever since as though it were.

The actual measurement is **Lally et al. (2010)** — 96 people, one self-chosen
daily behaviour, 12 weeks, automaticity modelled per individual:

| Finding | Value |
|---|---|
| Median time to 95% of automaticity asymptote | **66 days** |
| Observed range | **18 – 254 days** |
| Median by behaviour type | 65 eating / 59 drinking / **91 exercise** |
| Effect of missing a single day | **Not material** to formation |

Two consequences drive this design. First, 21 days is early-to-middling, not the
finish line — declaring victory there withdraws support at roughly the point the
median person is least secure. Second, the 18–254 range is so wide that *any*
fixed calendar threshold is wrong for most users, which is why the gates below
test the user's own behaviour rather than the date.

Supporting literature:

- **Extended-contact / booster interventions.** Support that is *tapered* rather
  than withdrawn keeps behaviour-change gains measurably longer, with
  between-group differences still significant at 12 months. Relapse concentrates
  in the **3–6 month** window after a change — which is what the 30/60/90-day
  maintenance check-ins are aimed at.
- **Notification fatigue.** ~46% of users opt out after 2–5 pushes in a week;
  frequency without personalisation is the most-cited reason people disable
  notifications permanently. Cutting per-habit send rate for users who no longer
  need it is a retention *gain*, not a sacrifice.
- **Streaks and loss aversion.** Loss framing is genuinely powerful for an
  **active** streak (Duolingo's streak-freeze cut churn ~21% for at-risk users).
- **The abstinence violation effect.** Once a streak is already broken, that
  same framing backfires: guilt and shame turn a lapse into a full relapse,
  while self-blame after a first lapse does *not* predict recovery. This is why
  the comeback copy cites the user's best-ever streak — a past success — and
  never their current failure.

## The model

Four phases per `(userId, habitGoalId)`, stored in `habits.habit_phases`:

| Phase | Nudge cadence | Meaning |
|---|---|---|
| `forming` | daily | Default, and where a rebuilding habit returns |
| `established` | **every 3rd day** | Adaptive gate passed — nudging tapers |
| `maintaining` | **never** | Automaticity proxy passed — only check-ins remain |
| `lapsed` | never | Was established, has dropped off; comeback offers only |

### The adaptive gates

Each gate pairs a **floor** (the earliest the literature ever observed the
outcome) with an **observed consistency** test over a trailing window. Neither
alone is sufficient.

```
forming → established     habitAge ≥ 21 days  AND  trailing-14 completion ≥ 90%
established → maintaining habitAge ≥ 66 days  AND  trailing-28 completion ≥ 85%
* → lapsed                was established     AND  trailing-14 completion < 50%
lapsed → forming          trailing-14 completion ≥ 50%
```

- **21 survives, demoted from "the rule" to "the floor."** It is the round number
  closest to the fastest automaticity Lally observed (18 days). A habit may not
  be called established before it; reaching it does not make one.
- **66 is Lally's median**, with a longer and slightly more forgiving window —
  by then we are confirming a plateau, not detecting a trend, and the study
  found occasional missed days harmless.
- **The gap between 90% and 50% is hysteresis.** A habit hovering near one
  threshold cannot oscillate between "congratulations" and "want to restart?"
  week over week.
- **Habit age is dated from the first *completed check-in*,** never from pact
  join or goal creation — otherwise someone could reach the 21-day floor without
  21 days of habit behind them.

### Maintenance check-ins

Fire at **30 / 60 / 90 days after `establishedAt`** — the day nudging tapered,
not the day the habit began. The question these ask is "did it hold after we
backed off?", so they must count from the day we backed off.

A backlog collapses to the **highest** due stage: a 95-day gap in the sweep
produces one 90-day check-in, not a burst of three.

### Comeback offers

At most **one per 30 days** per habit. A lapsed user is by definition not
engaging, and repeat low-relevance messaging to someone who has stopped
listening is the fastest route to a permanent opt-out.

---

## Where each message lives, and why

This is the split between the two repos. The rule is the one already stated in
`notificationQueueWorker.ts`: **the automator is a clock; the sending stays
behind the service.**

| Message | Channel | Lives in | Why |
|---|---|---|---|
| `streakAtRisk`, `partnerMissedDay`, `pactExpiring` | push | users-service digest | Needs `habits.*` data and per-brand push copy |
| `habitEstablished`, `habitAutomaticity` | push | users-service digest | The celebration *is* the cadence change; they must be decided together |
| `habitMaintenanceCheckIn` | push | users-service digest | Same |
| `habitComeback` | push | users-service digest | Same |
| Milestone / maintenance **email** | email | **therr-messaging-automator** | SES templates, Handlebars layout and unsubscribe-token handling all already live there |

Push decisions live in users-service because the lifecycle engine needs
`habits.streaks`, `habits.habit_checkins` and `habits.habit_phases`, plus the
push copy, all three locales, the per-brand Firebase app and the Android channel
routing. A Cloud Function that sent these directly would have to duplicate that
whole surface in a repo with no CI checking the coupling.

Email lives in the automator because that is where the SES sending path,
the Handlebars base template and the `UNSUBSCRIBE_URL` token logic already are.
Recreating those in users-service to serve four new emails would duplicate the
unsubscribe semantics — the one part of email that is legally load-bearing.

The two channels are **not** duplicates of each other. The push is a timely tap
on the shoulder; the email is the long-form version with the user's actual
numbers in it. They are separately deduplicated (see below).

---

## Gate invariance

The properties below are enforced mechanically, not by convention. Each has a
test; where the failure is silent in production, that is called out.

### 1. The engine is off by default

`HABIT_PHASE_ENGINE_ENABLED` must be exactly `'true'`. With it off the digest
behaves precisely as it did before this feature existed, and every lifecycle
counter reports 0 — which is also how a reader tells "engine off" from "engine
on, nobody crossed a gate".

This deploys dark for the mirror-image reason the queue worker does: the worker's
flag guards against sending too *much*, this one guards against sending too
*little*. Turning it on removes reminders from users who currently get them.

### 2. Failures fall toward over-reminding, never toward silence

A lifecycle read that fails yields an empty context and the digest falls back to
its previous un-tapered behaviour. An `established` row with no anchor date
still nudges. An unknown phase value is read as `forming`.

The asymmetry is deliberate: a bug that over-reminds gets reported, a bug that
goes quiet just looks like a user losing interest.

### 3. Persistence follows delivery, not intent

A `habitMaintenanceCheckIn` that fails to enqueue **must not** advance
`maintenanceStage`, and a failed comeback must not stamp `lastComebackAt`.
Advancing on failure silently consumes the user's one 30-day check-in without
sending it, and nothing downstream ever notices.

`duplicate` counts as delivered (the row is already queued); only a hard failure
leaves the stage open for the next run. This is why the digest's lifecycle path
uses `queuePushOutcome` rather than the boolean `queuePush`.

### 4. One habit, one lifecycle

A user pursuing one goal through two pacts has **one** habit. Lifecycle dedupe
keys are stamped with `habitGoalId`, never `pactId`, and a per-run guard stops
the second pact re-processing the same pair. Without the guard the queue's
constraint would still stop the duplicate *push*, but `lastComebackAt` and the
maintenance stage would be written twice.

### 5. A run never contradicts itself

- No nudge on the run that celebrates the taper — the milestone copy announces
  that reminders are easing off, so pairing it with one reads as a broken promise.
- No nudge on the run that offers a comeback.
- Never "still going?" and "want to restart?" in the same run.

### 6. Dedupe keys are period-stamped

Per `NOTIFICATION_QUEUE_DESIGN.md`, a key containing `Date.now()` silently
disables dedup. The lifecycle keys are:

```
habit-established:<habitGoalId>:<YYYY-MM-DD>
habit-automaticity:<habitGoalId>:<YYYY-MM-DD>
habit-maintenance:<habitGoalId>:<establishedAt>:<stage>
habit-comeback:<habitGoalId>:<YYYY-MM-DD>
```

The maintenance key carries `establishedAt` so a habit that lapses and
re-establishes receives the 30/60/90 sequence again against its **new**
establishment, instead of colliding with the old cycle's keys.

### 7. Volume is measurable

`nudgesTapered` is the counter that matters. It is the only direct evidence the
engine is *reducing* send volume rather than adding new message types on top of
the existing ones. If `nudgesTapered` is not growing after rollout, the feature
is not doing its job regardless of what the milestone counters say.

---

## Rollout

1. Deploy. Migration creates `habits.habit_phases`; the flag is off, nothing
   changes.
2. Turn on `HABIT_PHASE_ENGINE_ENABLED` in users-service. The engine begins
   evaluating and persisting phases, and the taper takes effect.
   - **Expect a backfill wave on the first run.** Every existing long-running
     habit is evaluated against the gates for the first time, so day one
     produces a burst of `habitEstablished` / `habitAutomaticity` messages.
     The queue worker's per-user daily cap (5) bounds the blast radius; it does
     not eliminate it. Consider enabling outside peak hours.
3. Watch `nudgesTapered` and `phasesEvaluated` in the digest response, and
   `status='skipped'` rows on `main.notificationQueue` (daily-cap suppressions).
4. Enable the automator's `habits-milestone-emails` scheduler job only after the
   push side looks right — email has no rate-limiting layer of its own.

To roll back, set the flag to `false`. Phase rows are left in place and are
harmless; re-enabling resumes from the recorded state rather than re-celebrating
everyone, because the milestone keys are stamped with the date the transition
was recorded.
