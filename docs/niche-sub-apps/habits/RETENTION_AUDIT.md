# Friends with Habits — Retention & Growth Audit

**Date:** 2026-07-22
**Scope:** Full-stack audit of the HABITS variant (backend `users-service` habits
domain, invite/signup stories, brand data separation, mobile FTUE/gamification)
against the goal of moving from open testing to production with a viral
coefficient > 1.0.

Each item is tagged **[BLOCKER]** (measurably suppresses retention/growth today),
**[HIGH]** (clear retention win, not fatal), or **[POLISH]**. Items fixed in the
2026-07-22 session are marked ✅ FIXED with the commit that addressed them.

---

## 1. The invite → connection contract (viral-loop core)

### 1.1 ✅ FIXED [BLOCKER] Invited users were never connected to their inviter
The entire product premise is "you invite a friend, you hold each other
accountable" — yet none of the three invite paths actually created a
`userConnection` between inviter and invitee:

- **Email/SMS invite → first login** (`auth.ts`): the invite row was marked
  accepted and coins were awarded, but no connection was created. The invitee
  landed in an app where their inviter was a stranger.
- **Share-link / username referral code at registration** (`users.ts`):
  inviter got coins + achievement, no connection.
- **PACT-XXXX claim code at registration** (`users.ts`): pact members were
  activated, but no connection, **no streak rows** (check-ins started from a
  broken state), and the inviter was never notified their friend joined.

**Fixed** in `therr-services/users-service/src/handlers/helpers/inviteAcceptance.ts`:
all paths now guarantee a COMPLETE connection, the first-login path accepts all
matching invites (email AND phone; previously only the first phone-or-email row),
the inviter gets an in-app + push notification ("their moment of re-engagement"),
and signup-time pact claims now mirror `acceptPact` (streaks + creator push).
Pinned by 14 regression tests in `tests/unit/handlers-helpers-inviteAcceptance.test.ts`.

> ⚠️ Backend commit — must be cherry-picked to `general` to deploy.

### 1.2 [HIGH → partially FIXED 2026-07-22] Invite emails/SMS deep-link to
`/claim-pact/<token>` but a brand-new user has no app installed
✅ FIXED: the web landing page's Play Store button linked to `app.therrmobile`
(the **Therr** app) — invitees installed the wrong app. Now points to
`com.therr.habits` and shows on all form factors; the App-Store badge was
removed until a HABITS iOS app exists. The PACT-XXXX manual-entry
instructions were already present in all 3 locales.
⏳ REMAINS: install attribution (Play Install Referrer API) so the token
survives the store hop without manual code entry; on-device QA of the full
email → install → register → land-in-pact path.

### 1.3 ✅ FIXED (2026-07-22) Email verification wall removed for pact-claim signups
Registrations carrying a valid PACT-XXXX claim whose contact info matches the
original invitee are now pre-verified (`isClaimCodePreVerified` in
`handlers/helpers/pactRedemption.ts`): the claim secret was delivered to that
exact email/phone, which is the same ownership proof a verification link
provides. `createUserHelper` grants `EMAIL_VERIFIED[_MISSING_PROPERTIES]`
up-front and skips the verification email. Brute-force is structurally
impossible: a wrong code guess still creates the (unverified) account, and the
duplicate-email check blocks retries — one guess per address. Regression
tests in `tests/unit/streak-gap-handling.test.ts`.
Organic (non-claim) registrations still verify by email; OTP-in-app remains a
future option for them.

### 1.4 [POLISH] Nudge + resend loops exist and are rate-limited (good)
`nudgePact` (7-day cooldown per partner) and the 30-day invite resend cooldown
are solid anti-spam defaults. No action needed.

---

## 2. Data separation between HABITS and Therr

### 2.1 [DONE — verify before launch] Brand-scoped isolation is in place for
the high-leak surfaces
`main.notifications`, `main.directMessages`, `main.forums`, `main.forumMessages`,
`main.userAchievements` route through `BrandScopedStore` (lint-enforced via
`eslint-config/brand-scoped-tables.js`); `main.thoughts` filters by
`brandVariation` column; habit data lives in the isolated `habits.*` schema;
push tokens are brand-scoped (`main.userDeviceTokens`) so Habits pushes can't
route via the Therr Firebase project; JWTs are brand-stamped and handoff codes
enforce target brand. **Action:** confirm any stores still in `'shadow'` mode
have clean logs and flip to `'enforce'` before production.

### 2.2 [HIGH] Verify `main.users_habits` / profile fields don't leak
Therr-specific profile state (map coords, business fields) into HABITS UI
Auth intentionally spans both apps (interchangeable accounts). The remaining
risk is UI-level: HABITS screens rendering Therr-only concepts. Feature flags
(`ENABLE_MAP`, etc.) gate the big surfaces; do a manual pass on Settings /
ViewUser for stragglers.

### 2.3 [POLISH] `main.invites` has no brand column
An invite sent from HABITS and one sent from Therr are indistinguishable. Coins
and connections are brand-neutral so nothing breaks, but per-brand invite
analytics (viral coefficient!) can't be computed from this table. Add a
`brandVariation` column (default `'therr'`, NOT NULL) when convenient.

---

## 3. First-time user experience (mobile)

### 3.1 [DONE] The mandatory-invite gate is well built
`PactOnboardingGuard` soft-gates the dashboard with `PactPreviewOverlay`
(3-step stepper, pre-staged template, outgoing-invite awareness) rather than a
dead-end wall. This matches the brief's "mandatory but not hostile" intent.

### 3.2 ✅ FIXED (2026-07-22) Funnel instrumentation
Nine `funnel.*` metric names added to `MetricNames` (therr-js-utilities) and
recorded via `utilities/recordFunnelMetric.ts` into `main.userMetrics`:
registration (with source: pact-claim / referral-code / organic, platform,
brand), verification, first login, invite sent (with count), invite accepted,
pact created, pact invite sent/accepted (with via: in-app / signup-claim),
and habit check-in (with streak count). All fire-and-forget. D1/D7 retention
derives from `funnel.user.firstLogin` + `funnel.habit.checkin` timestamps at
analysis time.

### 3.3 [HIGH] Time-to-value: pre-staged template + claim flow should land the
new invitee inside their friend's pact in ≤ 2 screens
The plumbing exists (claim drain on login). Verify on-device that an invited
user's first authenticated screen is the active pact with their friend's name
visible — not an empty dashboard that requires a refresh. The claim drain is
fire-and-forget on auth transition; the Habits landing reset may race it.
Consider awaiting the drain (with a 2-3s cap) before `resetToHabitsLanding`,
or re-fetching active pacts when the drain resolves.

### 3.4 ✅ FIXED (2026-07-22) Streak freezes — and two latent streak bugs
Audit of the check-in flow found the schema already had
`gracePeriodDays`/`graceDaysUsed` but the mechanic was dead, plus two real
correctness bugs: (a) `incrementStreak` ran unconditionally, so **streaks
never reset after missed days**; (b) re-submitting a same-day check-in
double-incremented the streak and re-fired achievements/partner pushes.
Now wired in `createCheckin`: same-day duplicates are detected and skipped;
gap days are computed per habit cadence (`countMissedDaysForStreak`); missed
days consume available freezes (preserving the streak, recorded as
`grace_used` history) or reset the streak (recorded as `missed`). New streaks
start with 1 freeze; each 7+ day milestone earns one more, capped at 3.
Regression tests in `tests/unit/streak-gap-handling.test.ts`.

---

## 4. Gamification & notification loops

### 4.1 [DONE] Achievement scaffolding is broad
Pact pioneer / accountability / socialite / resilience achievement families are
wired through brand-scoped `userAchievements`. Streak milestones recorded.

### 4.2 [HIGH → code FIXED 2026-07-22, QA remains] Partner-activity push routing
✅ FIXED: all 20 `createDataOnlyMessage` call sites in `firebaseAdmin.ts` now
pass `brandVariation`, so the iOS `apns-topic` header carries the correct
per-brand bundle id (previously every data-only push defaulted to the Therr
bundle). Android notification icon color is now brand-tinted
(`getBrandAccentColor`). ⏳ REMAINS: on-device QA — send each HABITS push type
to a physical device on the HABITS build with
`PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_HABITS` set.

### 4.3 ✅ FIXED (2026-07-22) Daily partner-activity digest
`POST /habits/pacts/digest/run-daily` (users-service, `handlers/habitsDigest.ts`)
evaluates all active pacts once per run and sends: `streakAtRisk` (active
streak, no check-in yet today), `partnerMissedDay` (partner failed yesterday's
check-in; new members grace-period exempt), and `pactExpiring` (ends within 3
days). The route is intentionally NOT registered in the API gateway —
internal-only. Operational step: schedule a daily internal cron (see
WORK_IN_PROGRESS.md § Manual Operational Follow-ups).

### 4.4 [POLISH] Weekly summary email (brief MVP item) — not found in
users-service email templates; `sendPendingInviteEmail` retention plumbing
exists to build on.

---

## 5. Stability / correctness items found during audit

- ✅ FIXED — signup-time pact claim left pacts without streak rows (§1.1).
- [HIGH] `emailPrecheck` + universal continue UI is good; ensure mobile Login
  surfaces "account not verified" with a one-tap resend (users bounce on
  unexplained 401s).
- [POLISH] `logout` handler 404s for unknown userName and does nothing else —
  harmless but dead weight.
- [POLISH] `getUserConnection` handler coerces `acceptingUserId` with
  `Number()` — user ids are UUID strings; endpoint is likely dead code. Remove
  or fix when touched.

---

## 6. Launch-readiness order of operations (updated 2026-07-22)

Second-pass session completed §3.2 (funnel metrics), §1.3 (claim
auto-verify), §3.4 (streak freezes + two latent streak bugs), §4.3 (daily
digest), §4.2 code fixes (apns-topic/icon color), and the §1.2 store-link
fix. Remaining, in order:

1. Cherry-pick all backend commits (users-service, push-notifications-service,
   therr-js-utilities, therr-client-web) to `general` and deploy.
2. Operational: schedule the daily digest cron; confirm
   `PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_HABITS` in prod (both in
   WORK_IN_PROGRESS.md § Manual Operational Follow-ups).
3. On-device QA: claim-link → install → register → land-in-pact (§1.2, §3.3)
   and push delivery per type on the HABITS build (§4.2).
4. Play Install Referrer attribution so the claim token survives the store
   install hop (§1.2).
5. Surface streak freezes in mobile UI (StreakWidget already receives
   gracePeriodDays/graceDaysUsed in the streak payload — show "🧊 2 freezes").
6. Payment workflow (Tier 2.5 in WORK_IN_PROGRESS.md) once retention holds.
