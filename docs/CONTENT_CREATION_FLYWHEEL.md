# Content Creation Flywheel

**Last Updated:** August 2026
**Status:** Phase 1 shipped (mobile); Phases 2+ planned
**Relevance:** Core Therr. Several items generalize to all brands; brand-specific ones are marked.

---

## Why this exists, and how it fits the B2B strategy

`docs/GROWTH_STRATEGY.md` is authoritative and unchanged: B2B-first, and **do not invest
time in consumer-facing marketing for core Therr until B2B has validated revenue.** This
document is not a consumer-marketing plan and does not compete with that queue.

It exists because the B2B funnel has a supply dependency that nothing else owns. What a
business is being asked to pay $14.99/month for is its space page. A space page with no
recent moments is a directory listing — Yelp and Google already do that better, and there
is no reason to claim one. A space page carrying a stream of recent, local, first-party
posts is something neither of them has. Every step below is justified by that, not by DAU:

- Per-space moment counts are the outreach hook for funnel step 1 ("14 people posted at
  your business this month").
- Recency of user content is a direct SEO ranking signal, and the reason
  `docs/CONTENT_MOMENT_DRIVEN_PLAN.md` exists. That plan is blocked on supply, not code.
- Written reviews and ratings are what make a claimed page worth maintaining.

So the metric this document optimizes is **moments per space per month in target markets**,
not signups.

### The pattern worth copying

Across the products that solved this, the shape is the same: *lower the floor for the first
contribution, then raise the ceiling with status.* Therr has already built most of the
ceiling — 24 achievement classes, TherrCoin, XP, weekly and all-time leaderboards — and
almost none of the floor. The ordering below reflects that.

---

## Phase 1 — Map-load value proposition (shipped)

The map opened on a whole-country zoom over an empty basemap with a `+` button and no
explanation. It now opens, when location is known, on a strip of nearby areas ranked by
proximity blended with recent activity, with a create CTA still on screen.

Shipped in `TherrMobile/main/routes/Map/`, `main/utilities/feedRanking.ts`,
`main/utilities/lastMapLocation.ts`, `main/components/UserContent/AreaCreatePromptCard.tsx`.
Includes a create-prompt card that names the nearest space and doubles as the empty state,
and a distance-unit fix that had every card overstating distance by ~1.5x.

> *Snapchat's Our Story and Snap Map made a place feel alive by showing that other people
> were posting there right now — before asking for anything. The map is the only surface
> Therr has that can do the same thing.*

---

## Phase 2 — Backend blended ranking

Client-side ranking can only reorder what a distance-sorted query already returned. The
server still filters with `ST_DWithin` and sorts by `ST_Distance ASC` with no engagement or
recency term anywhere (`MomentsStore.searchMoments`, `SpacesStore.searchSpaces`,
`EventsStore.searchEvents`).

This is `docs/ALGORITHM_AUDIT.md` Optimizations 2.3 and 2.4, both still open. **Must land on
`general`** — `therr-services/**` and `therr-public-library/**` committed anywhere else is
dead code.

1. Add `activityScore double precision` and `lastActivityAt timestamptz` to `main.moments`,
   `main.spaces`, `main.events`, updated with the decay-on-write formula already shipped and
   reviewed for `main.userInterests.affinityScore`
   (`affinityScore * 0.5 ^ (elapsed / halfLife) + weight`). No cron required, which matters:
   `k8s/prod/` contains zero CronJob manifests. A ~72h half-life suits local discovery.
2. Feed the counters. maps-service already emits `SPACE_MOMENT_CREATED`,
   `SPACE_EVENT_CREATED`, `SPACE_USER_CHECK_IN` and `SPACE_IMPRESSION` into
   `main.spaceMetrics`, so those handlers only need to bump the new columns. Likes and
   ratings live in reactions-service and need an internal ping — follow the existing thin
   shim at `reactions-service/src/utilities/updateAchievements.ts`. Backfill from
   `main.spaceMetrics`, which is already indexed on `(spaceId, createdAt)`.
3. Extract the blend into `therr-js-utilities` so client and server cannot drift. Mobile's
   `rankAreaPreviews` collapses into it.
4. Blended `ORDER BY` behind a flag defaulting to current behavior. Note
   `maps-service/tests/unit/SpacesStore.test.ts` asserts the exact generated SQL string.

---

## Phase 3 — Wire the re-engagement pushes that already exist

**Highest ROI in this document, and no design work.** `createAMomentReminder`,
`latestPostLikesStats`, `latestPostViewcountStats`, `unreadNotificationsReminder`,
`unclaimedAchievementsReminder` and `inviteFriendsReminder` all have finished copy in
`push-notifications-service/src/api/firebaseAdmin.ts` and tap handling in
`TherrMobile/main/components/Layout.tsx`, and **no sender anywhere in the repo**.
Separately, `maps-service/src/utilities/scheduleDraftReminder.ts` is an in-process
`setTimeout` that dies with the pod.

This is fully-built product blocked on missing scheduler infrastructure — the same gap
`docs/WORK_IN_PROGRESS.md` flags for the HABITS daily digest. One scheduler unblocks both.

Respect `docs/PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md`: cap 3–5/day across all types, and
never send generic "check back in" copy — anchor every send to a specific undone thing.

> *Instagram and Untappd both treat "someone reacted to your post" as the core retention
> loop rather than a courtesy. Therr already sends like notifications
> (`websocket-service/src/handlers/reactions.ts`); the stats digest that turns one like into
> a reason to post again is the missing half.*

---

## Phase 4 — Contextual prompts instead of a generic `+`

Phase 1 puts one prompt card in the map strip. Generalize it. The app already knows the
user's nearby spaces (`getNearbySpaces.ts`, 120m), which of them have no moments today, and
which `QuickReportCategories` have gone stale. Prompt for the specific gap.

> *Nextdoor solved its cold start not with a better composer but by telling people what
> their neighbourhood was missing; Reddit and Stack Overflow do the same with unanswered
> questions. A blank composer is a hard prompt. "No one has posted here today" is an easy
> one.*

---

## Phase 5 — Ladder the creation acts, lowest-effort first

Therr's check-in is already the Foursquare primitive: one tap, GPS-verified, coin-rewarded,
throttled by `MIN_TIME_BTW_CHECK_INS_MS`, and already promoted to the collapsed FAB when a
nearby space qualifies. Make the ladder explicit — check-in → rating → moment → space claim
— and surface the next rung after each success.

> *Swarm's insight was that the check-in is not the product, it is the on-ramp: the cheapest
> act that makes you a contributor rather than a viewer. Yelp's star-only rating plays the
> same role ahead of a written review.*

**Therr has no written review type.** "Reviews" are a numeric `rating` on `spaceReactions`
(`components/Input/SpaceRating.tsx`). A short text review is the obvious next rung and the
single highest-value content type for space-page SEO — it is the one gap on this list that
is both a creation lever and a direct B2B lever.

---

## Phase 6 — Surface progression where creation happens

Achievements and the leaderboard are reachable **only** through the right-hand slide-out
menu (`HeaderMenuRight.tsx`). The `$` reward badges on the map FABs prove the pattern works
in context; extend them to show the *next* milestone, and put a progress chip in the
post-create success state rather than a bare toast.

> *Google Local Guides and Yelp Elite drive volume by making the next tier visible at the
> moment of contribution. Duolingo's leaderboard — which this repo already mirrors, Monday-UTC
> reset and all — works because it is on the home screen, not in settings.*

---

## Phase 7 — Soft opt-in for location, then notifications

`permissionsOrchestrator.ts` already implements a soft primer with a cap of two asks for
camera, contacts and notifications — but **not location**, and the map never asks on mount.
Extend it to location, anchored to the now-visible value proposition, and anchor the
notification ask to the user's first successful moment.
`docs/PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md` ranks soft opt-in as its single biggest
lever.

---

## Phase 8 — Instrument the creation funnel

Every analytics event today fires on *success* (`moment_create`, `space_create`,
`thought_create`). Nothing fires when the create FAB opens or a form is abandoned, so the
drop-off is unmeasurable. There is also no logging wrapper — 28 files repeat
`logEvent(getAnalytics(), ...)` inline.

Add one utility, then instrument FAB open → form open → submit → success. **Phases 3–7
cannot be evaluated without this**; `ALGORITHM_AUDIT.md` §6 makes the same point about
ranking. Worth doing early despite its position here.

---

## Phase 9 — Mechanical friction on the path already taken

- Image signing is a blocking round-trip before upload; `EditMoment/index.tsx` and four
  sibling screens all carry `// TODO: This is too slow`.
- Failed creation leaks the uploaded file (`EditMoment`, `EditSpace`, `EditEvent`).
- `Map.handleCreate` gates creation on GPS **and** auth, so a logged-out user browsing the
  public map cannot reach a compose screen at all — they get a toast. Let them compose and
  prompt for auth at submit.

> *TikTok's onboarding gives value before asking for anything. Therr's map is already
> `AccessPresets.PUBLIC_PARTIAL`; the create path is where that openness stops.*

---

## Phase 10 — A time axis on the existing space axis

Proximity gating — content activates only when you are physically near it — is Therr's
distinctive mechanic and already a reciprocity gate. It has no time dimension.

> *BeReal's entire engine was a time-boxed window plus a reciprocity gate.*

Concretely: a "what's happening here today" window on the space page, and a daily prompt
tied to a nearby space. Low code cost — `main.moments` already has `expiresAt`, and the
`QuickReportCategories` LIVE concept already exists.

---

## Sequencing

| Phase | Branch | Notes |
|---|---|---|
| 1 ✅ | mobile | Shipped |
| 8 | mobile | Do early despite its number — nothing below is measurable without it |
| 3 | `general` | Highest ROI; needs scheduler infra, shared with the HABITS digest |
| 2 | `general` | ALGORITHM_AUDIT O2.3/O2.4 |
| 4, 5, 6, 7 | mixed | Sequence backend before the mobile UI that depends on it |
| 9, 10 | mixed | Largest UX change last, with measurement in place |

## Cross-references

- `docs/GROWTH_STRATEGY.md` — the authoritative strategy this serves
- `docs/ALGORITHM_AUDIT.md` — Phase 2 is its Optimizations 2.3/2.4
- `docs/PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md` — governs Phases 3 and 7
- `docs/CONTENT_MOMENT_DRIVEN_PLAN.md` — the SEO consumer of this supply
- `docs/NICHE_APP_DATABASE_GUIDELINES.md` — migration rules for Phase 2
