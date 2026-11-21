# Retention Ideas (November 2026 brainstorm)

> ## ⚠️ Each idea carries its own status. Read it before acting.
>
> This records a brainstorm about improving Therr's retention and daily use. Ideas have one
> of three statuses:
>
> | Status | Meaning | Ideas |
> |---|---|---|
> | **BUILT** | Approved and implemented. | § 2 Drops ([`DROPS.md`](./DROPS.md)) |
> | **INTENDED — DEFERRED** | The founder intends to build it, but not now. No work is scheduled. Do not start without a go-ahead that names the idea, and treat the design notes as a starting point, not a spec. | § 3 Daily quest, § 4 Place passport, § 5 Discovery alerts and weekly recap |
> | **UNCONFIRMED** | A possibility to evaluate. No decision has been made to build it. | § 1 Location-verified commitments, Plan a Hangout |
>
> Do not describe an UNCONFIRMED idea as planned, and do not describe an INTENDED — DEFERRED
> idea as scheduled.

**Date:** 2026-11-21
**Scope:** core Therr (`general`), with notes where an idea touches Friends with Habits.

---

## Context

- The core Therr product has not found market fit. New users arrive as a slow trickle; the
  April brief counted about 50 Android installs.
- Paid marketing is not worth it without a meaningful change to the product.
- Therr's core mechanic, content that unlocks when you are near where it was posted, needs
  **many users in one area**. With few users, that mechanic makes an empty app look emptier.
- Friends with Habits shows the same retention gap, from a different cause. Working memory on
  2026-11-11 recorded 205 real accounts, 39 that had ever checked in, and 0 of 22 paired users
  still active at week 4.

**The test applied to every idea:** does it give value to **one user, or two**, without
needing many people nearby?

---

## 1. Location-verified commitments ("Show Up" pacts)

**Status: unconfirmed.** This is the "major pivot" candidate.

**Idea.** Combine Therr's location features with the Friends with Habits pact and streak
system. Many habits happen at a place: the gym, a run club, the library, Sunday dinner. A
check-in would be confirmed by being there.

**Why.**
- It addresses the weakest Friends with Habits number: hardly anyone checks in.
- It works with two people, so it needs no density.
- It gives businesses a reason to pay: gyms, studios and climbing gyms could see attendance
  streaks.

**What it would reuse:**
- streaks, freezes and pacts;
- the notification queue;
- space check-ins;
- dwelling detection (`main.userLocations`).

**Known constraint.** Adding background location to Friends with Habits was ruled out as too
costly and too much friction:
- the location library's license does not cover `com.therr.habits`; see the comment in
  `TherrMobile/main/components/Layout.tsx`;
- "Allow all the time" is a heavy permission ask.

Three variants were discussed:

- **1a. Place-linked check-in, foreground only (lowest friction).**
  - Link a habit to a place: a picked space, or a pin dropped with "I'm here now".
  - At check-in, stamp the location once, using only "while using the app" permission.
  - Partners see "📍 checked in at the gym".
  - No background tracking, and no second app.
  - This is also the data model either variant below would need.
- **1b. Therr → Friends with Habits location bridge.**
  - Therr already posts background location about once a minute to
    `push-notifications-service` `process-user-background-location`.
  - It already detects a stationary visit to a place (within 20 m;
    `locationProcessing.ts`).
  - A user has one account across both apps, and push tokens are stored per brand.
  - So a Therr location update *could* trigger a check-in prompt on the user's Friends with
    Habits device:
    1. users-service would own the "is this a due habit at this place?" decision;
    2. it would queue the prompt with a `place-checkin:<habitId>:<localDate>` dedupe key;
    3. the prompt would offer the existing one-press Check In.

  **Concerns raised:**
  - It helps only people who have **both** apps and gave Therr "always" location access.
    That overlap is probably close to zero. Measure it first: count users with push tokens
    for both brands (`/prod-db`).
  - Asking a Friends with Habits user to install Therr and grant background location is more
  friction than a permission inside Friends with Habits.
  - Therr's Play background-location declaration and disclosure describe Therr's own
    features. Using that data for another app's feature probably needs disclosure; this is
    unverified.
- **1c. Place-based pacts inside Therr.**
  - Therr users have already granted background location, and Therr already detects visits.
  - Turning on pacts for the Therr brand puts both halves in one app, with no data passed
    between apps.
  - This is closer to a real pivot than 1b.

**How to judge it.** Compare check-in rate and week-4 pair retention for place-linked habits
against unlinked ones.

---

## 2. Drops: a note or photo left at a place for one friend

**Status: APPROVED AND BUILT (2026-11-21).** See [`DROPS.md`](./DROPS.md).

The connections-only first version is built. Not built: drops for people not on Therr, opening
a drop on the web (iOS has no build), a "you're near a drop" push, and an expiry reminder.
Each of those is its own decision, also unconfirmed; they are listed in `DROPS.md` § Not built
yet.

---

## 3. Daily local quest and an "Explorer" streak

**Status: INTENDED — DEFERRED (2026-11-21).** The founder intends to build this; it is deferred
to future work and nothing is scheduled.

**Idea.** Each day, one small place-based mission chosen from nearby places and the user's
interests. For example: "Try a café you haven't checked into", "Post a moment at a park".
Finishing it keeps a daily streak going.

**Why.**
- It gives one person a daily reason to open the app.
- Every finished quest adds a moment to a place page. That is the content supply the B2B
  funnel needs (`GROWTH_STRATEGY.md` → "Content supply is not consumer marketing").

**What it would reuse:**
- the app-level daily streak, the daily XP bonus and the local-time reminder slots;
- Therr's league ladder (🥾 Wanderer → 🌟 Legend), which already exists in
  `LEADERBOARD_LEAGUES_BY_BRAND`;
- spaces imported from OpenStreetMap as quest targets.

**Risks.**
- Quests near places with nothing nearby feel hollow, so target cities need spaces imported
  first.
- The streak machinery is Habits-shaped, and parts of it may need generalizing.

**How to judge it.** D7 and D30 retention for users who complete one quest against those who
complete none, and moments per space per month in target cities.

---

## 4. Place passport with a "fog of war" map

**Status: INTENDED — DEFERRED (2026-11-21).** The founder intends to build this; it is deferred
to future work and nothing is scheduled.

**Idea.** Each user's map fills in as they visit places. It shows what share of their
neighborhood they have explored, collects category stamps (coffee, trails, live music), and
produces a monthly card they can share.

**Decided shape: an optional mode, off until the user chooses it.**

- **Opt-in, never on by default.** The passport is a mode the user turns on, not something
  that records them silently. Until they choose, nothing is recorded for it.
- **Asked once, in the first-time UI.** New users meet the choice during onboarding as its
  own step: what the passport is, what it records (the places they visit), that only they see
  it, and "Turn it on" / "Not now". "Not now" is a full answer: the step does not come back
  as a nag. Existing users need an equivalent one-time prompt, for example the first time they
  open the map after the feature ships, with the same two answers.
- **Toggle in Settings, both ways, any time.** Turning it off stops recording immediately.
  Decide at build time whether turning it off also offers to delete the recorded history;
  it should at least be possible.
- **Private by default.** The map and history are visible only to their owner. A share card is
  created only when the user taps share, for that one card.

The setting would live on `main.users` alongside the other `settings*` columns (for example
`settingsIsPassportEnabled`, NULL meaning "not asked yet"). NULL is what makes the one-time
prompt possible: the first-time UI shows while the value is NULL, and either answer stores a
boolean.

**Why.**
- The history builds up, so leaving the app means losing something.
- The shareable card brings in new users without paid marketing.

**What it would reuse:**
- check-ins and spaces, for the data;
- the challenge-card image generator (`/c/<token>/card.png`, resvg WASM) for the share card.

**Risks.**
- "Visited" needs a definition: check-ins only, or dwell detection from background location.
  Either way, nothing may be recorded for the passport while the mode is off or not yet
  chosen.
- Background location raises the same privacy and policy questions as § 1b. The opt-in mode
  above is part of the answer, and the first-time UI copy must say plainly what is recorded.

**How to judge it.** Share-card generation and install rate from shared cards; return rate in
the week after a card is generated.

---

## 5. "Your moment was discovered" alerts and a weekly "your places" recap

**Status: INTENDED — DEFERRED (2026-11-21).** The founder intends to build this; it is deferred
to future work and nothing is scheduled. **The weekly recap is the part the founder is most keen
on** ("Weekly recaps would be great"), so when this is picked up, the recap is the natural
first piece. It can ship on its own, before any real-time discovery alerts.

**Idea.** Therr's posts unlock later when someone passes by, so a post can pay off days after
it was made: "3 people discovered your moment at Joe's Pizza this week". These would be
bundled into a weekly recap.

**Why.** Seeing that other people responded to your post is the strongest reason people return
to a posting app (`CONTENT_CREATION_FLYWHEEL.md`). The delayed discovery gives a natural
reason to come back.

**What it would reuse.** The Friends with Habits weekly-recap pipeline (period-stamped dedupe
keys, local-Monday send) and moment reactions with `userHasActivated`.

**Risk, and a hard rule if built.** The AI automator already reacts to real users' posts.
Discovery counts **must count humans only**. Counting bots makes the feedback fake, and users
eventually notice.

**Weekly recap: notes for when it is built.**
- One push on the user's local Monday, about the week that just closed, with a matching
  screen. Copy the Friends with Habits pattern: the digest asks "is it your Monday?" per user,
  and the dedupe key is stamped with the week (`therr-weekly-recap:<weekStart>`).
- Send it only when there is something to say. A recap of an empty week is a report card
  nobody asked for.
- Candidate contents, all counted from **human** activity only:
  - how many people discovered the user's moments;
  - reactions and replies the user received;
  - places they checked in at;
  - drops left, received and opened;
  - passport progress, only if the passport mode (§ 4) is on.
- The Friends with Habits recap decides which story to tell once, on the server (for example
  "best week yet" against "quieter week"), so the push and the screen cannot contradict each
  other. Do the same here.
- Give it its own kill switch and a notification setting the user can turn off.

**How to judge it.** Posting frequency of users who receive a recap, against those who do not.

---

## Plan a Hangout / Match Up: findings

**Status: unconfirmed.** This was investigated as a side question and was not the main focus.

The founder's instinct is that this feature has potential but goes overlooked, and gives no
clear way to meet new people. The code backs up the second half:

- **The new-people half was never built.**
  `therr-services/maps-service/src/handlers/activities.ts` has
  `// TODO: Fetch potential connections` followed by
  `getSuggestedConnectionsPromise = Promise.resolve({})`.
- **Users with no friends on the app cannot use it at all.**
  `TherrMobile/main/routes/Activities/ActivityGenerator.tsx` `onSubmit` refuses to submit when
  no existing connection is selected.
- **It asks a lot of the user.** It needs four fields (people, place, group name, event name)
  and produces a group plus an event in messages-service.
- **The onboarding promises something that may not exist.** The tour says "We'll send you
  invites to curated social activities each week." No backend job that sends these was found.
- **Usage is measurable today.** Every hangout's forum row is saved with the hard-coded
  description `'Hangout w/ local friends'`, so a prod count shows how many were ever created.

**Possible direction, if pursued: "open hangouts" built on the open-pacts pattern.**
- A host publishes a hangout at a **public** place, with at least 3 people and phone-verified
  accounts.
- People with matching interests ask to join, and the host approves each request.
- The announcement is held to the recipient's local morning.
- Reuse the join-request, approval and announcement code from Friends with Habits open pacts
  (`pact_join_requests`, `openPactAnnouncement.ts`).

**Recommended before any build:** host 2 or 3 hangouts by hand in one city and see whether
strangers show up. That costs a weekend instead of a sprint.

---

## Decision log

| Date | Decision |
|---|---|
| 2026-11-21 | **Drops approved and built** (connections only). See `DROPS.md`. |
| 2026-11-21 | Background location inside Friends with Habits ruled out as too costly and too much friction. |
| 2026-11-21 | **Daily quest (§ 3), place passport (§ 4) and discovery alerts with weekly recap (§ 5): intended to build, deferred to future work.** Nothing scheduled. |
| 2026-11-21 | The place passport must be an **optional mode**: off until chosen, offered once in the first-time UI, and switchable on and off in Settings. |
| 2026-11-21 | The weekly recap is the most wanted part of § 5. |
| 2026-11-21 | Location-verified commitments (§ 1) and Plan a Hangout remain **unconfirmed**. |
