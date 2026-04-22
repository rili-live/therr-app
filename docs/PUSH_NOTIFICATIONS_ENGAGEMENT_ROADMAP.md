# Push Notifications — Engagement Roadmap

**Last Updated:** April 2026
**Status:** Planning — infrastructure is shipped; engagement features pending
**Relevance:** All brands; **highest ROI for `niche/HABITS-general`** (habit apps get
outsized retention lift from streak-aware, well-timed notifications).

---

## Context

The push notification *infrastructure* work is complete (see branch
`claude/audit-push-notifications-zuLoS`): Android 13+ permissions, per-brand
Firebase apps, invalid-token cleanup, iOS APNS alert delivery in killed state,
Crashlytics reporting, Notifee v9, brand-agnostic background handler. Delivery
reliability is solid.

This document captures the *product* work that actually moves engagement. The
pipes are ready; this is what flows through them.

---

## Prioritized Investment List

Ordered roughly by ROI. Impact ranges are industry rough estimates — they vary
by product category, baseline opt-in rate, and audience. Treat them as
relative, not absolute.

### 1. Soft opt-in UX (biggest single lever)

**Typical impact:** Can roughly double the addressable audience
(iOS default opt-in ~50%; well-designed soft-asks reach 70–80%).

**What:** Show a custom in-app explainer *before* the OS permission prompt,
ideally anchored to a user action that naturally benefits from notifications
(e.g., "We'll remind you when a new area is activated nearby" after the user
creates their first moment).

**Scope:**
- New component: in-app explainer modal with "Enable" / "Not yet" buttons
- Only call `requestNotificationPermissions()` (`Layout.tsx`) after the user
  taps "Enable"
- Track "soft-ask shown / accepted / deferred" events for funnel analysis
- Handle the deferred case: re-prompt at a later meaningful moment, not
  immediately

**Effort:** ~1–2 days.

**Habits-specific:** Anchor the ask to pact creation — "We'll let you know
when your accountability partner checks in." The social framing is much
stronger than a generic reminder pitch.

---

### 2. Send-time personalization

**Typical impact:** 15–40% lift on opens.

**What:** Schedule each user's recurring notifications (reminders, streaks,
summaries) at the hour they're most likely to engage, derived from their own
past session times.

**Scope:**
- Track session-start timestamps per user (probably already in analytics)
- Compute a "best hour" feature per user (batch job, daily)
- Store on `users.settingsPreferredNotificationHour` or equivalent
- `push-notifications-service` scheduled senders read that field and enqueue
  per-user, not batch-at-9am

**Effort:** ~3–5 days (data pipeline is most of it; the send side is small).

**Habits-specific:** Habit check-ins have strong time-of-day patterns — someone
who logs habits in the morning should *not* get an evening reminder. The
payoff is outsized here.

---

### 3. Content personalization (what, not who)

**Typical impact:** 2–4× generic blast.

**What:** Notifications reference the specific thing the user left undone —
not "You have unread notifications" but "Sam sent you a message 2 hours ago"
or "Your draft 'Coffee at Blue Bottle' is still unpublished."

**Scope:**
- Already partially done: `push-notifications-service/src/api/firebaseAdmin.ts`
  translates content with `fromUserName`, `likeCount`, `notificationsCount`,
  etc.
- Gaps: `unreadNotificationsReminder`, `inviteFriendsReminder`,
  `createAMomentReminder` are still generic. Enrich payloads with the
  specific item/count.
- Add locale strings in `push-notifications-service/src/locales/{en-us,es,fr-ca}/`
  for the new variants.

**Effort:** ~1–2 days per notification type.

**Habits-specific:** "Alex just checked in for Day 12 of your running pact —
don't let them lap you" is radically more engaging than "Your partner
checked in." This is where Habits will really benefit.

---

### 4. Creative / tone iteration (copy quality)

**Typical impact:** Hard to generalize; Duolingo-style brand voice is their
actual superpower. 10–30% in A/B tests is not unusual when replacing generic
copy with voice-driven copy.

**What:** Invest in the *copy* in
`push-notifications-service/src/locales/*/dictionary.json`. Brand voice,
humor, emotional stakes. Loss-aversion framing for habit/streak apps
("Don't break your 47-day streak").

**Scope:**
- No code changes needed. Requires a copywriter or PM willing to iterate.
- Set up A/B testing of notification copy (server-side variant selection
  keyed by user id hash)

**Effort:** Ongoing creative work; initial A/B infrastructure ~2 days.

**Habits-specific:** This is where habit apps win or lose. Streak framing,
partner guilt, milestone celebrations — all live in the copy. Plan to
actively iterate.

---

### 5. Streak / loss-aversion framing

**Typical impact:** Enormous for habit apps, negligible elsewhere.

**What:** Notifications anchored on the user's current streak, risk of
breaking it, and partner comparisons. Only makes sense for Habits.

**Scope:**
- Requires streak state in the push payload (already tracked in `habits.*`
  tables per `docs/NICHE_APP_DATABASE_GUIDELINES.md`)
- New notification types: `streakAtRisk`, `streakBroken`, `streakMilestone`,
  `partnerLappedYou`, `partnerMissedDay`
- Many of these enum values are already in
  `therr-js-utilities/src/constants/enums/PushNotifications.ts` — handlers
  just aren't implemented yet

**Effort:** ~3–5 days once the habit tracking layer is in place.

**Habits-specific:** Core feature of the product, not optional polish.

---

### 6. Rich media attachments (iOS NSE)

**Typical impact:** 10–25% lift on opens.

**What:** Images/GIFs in the iOS notification itself (partner avatar, moment
thumbnail). Requires a Notification Service Extension on iOS.

**Scope:** See the `TODO(iOS-NSE)` comment at
`therr-services/push-notifications-service/src/api/firebaseAdmin.ts:createDataOnlyMessage`.
New Xcode extension target, Apple App ID per brand, sandboxed Swift code.

**Effort:** ~1 day per brand, ~2 days total for Therr + Teem + Habits.

**Deferred:** Effort-to-impact ratio is unfavorable compared to #1–#5. The
APNS payload already sets `mutableContent: true` so this can be added later
without backend changes. Revisit if engagement metrics demand it.

---

### 7. Action buttons on notifications

**Typical impact:** Low single-digit percentage.

**What:** "Reply" / "View" buttons below the notification. Android already
renders these via Notifee's `actions` array. iOS requires the same NSE as
item #6.

**Deferred:** Android works today; iOS requires the NSE which isn't worth
its standalone cost. Covered together with #6 if we ever build the NSE.

---

## Anti-Patterns to Avoid

- **Pushing harder to lift opens** — past a cap, frequency reduces DAU and
  opt-in retention. Over-sending *costs* engagement. Cap at ~3–5
  notifications/day per user across all types.
- **Badge counts alone as an engagement strategy** — barely measurable.
- **Shipping action buttons as the marquee feature** — infrastructure cost
  (iOS NSE) far exceeds the engagement delta.
- **Generic "check back in" reminders** — ignored. Always anchor to a
  specific thing the user left undone.

---

## Relevant Code Locations

| Concern | File |
|---|---|
| Opt-in permission flow (soft-ask hook) | `TherrMobile/main/components/Layout.tsx` `requestNotificationPermissions` |
| Notification content / locale strings | `therr-services/push-notifications-service/src/locales/*/dictionary.json` |
| Notification types enum | `therr-public-library/therr-js-utilities/src/constants/enums/PushNotifications.ts` |
| Per-type payload & channel routing | `therr-services/push-notifications-service/src/api/firebaseAdmin.ts` |
| Android channel / press-action mapping | `TherrMobile/main/constants/index.tsx` |
| Per-brand Firebase projects | `therr-services/push-notifications-service/CLAUDE.md` |

---

## Habits Cross-Reference

`docs/niche-sub-apps/HABITS_PROJECT_BRIEF.md` already lists push-notification
work under "Phase 2 — Partner Activity" and related sections. When executing
those items, refer back to this roadmap for the ordering: **opt-in UX and
send-time personalization before content richness; streak framing is the
product itself, not an enhancement.**
