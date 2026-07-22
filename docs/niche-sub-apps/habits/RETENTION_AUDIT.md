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

### 1.2 [HIGH] Invite emails/SMS deep-link to `/claim-pact/<token>` but a
brand-new user has no app installed
The web route exists (`therr-client-web` `/claim-pact/:token`) and mobile
handles the universal link + post-login drain. Verify the web landing page for
an uninstalled user prominently routes to the Play Store listing with the claim
token preserved (deferred deep link). Without install attribution, a user who
installs from the store loses the token and the pact never auto-claims — they
must manually type the PACT-XXXX code. Consider Firebase Dynamic Links
replacement (Play Install Referrer API) since Dynamic Links is sunset.

### 1.3 [HIGH] Email verification is a hard wall between invite and first pact
`login` rejects unverified users (401). An invitee who taps "join your friend's
pact" must: install → register → leave the app for their inbox → verify → return
→ log in. Every step bleeds users. Options (in order of impact/effort):
- Auto-verify when registration arrived via a pact claim token/code — the
  invite email itself proves inbox ownership when the claim identity check
  (`isMatchingInvitee`) passes.
- OTP-based verify-in-app (code entry) instead of link-out.
- Allow first session in a `EMAIL_VERIFIED_MISSING_PROPERTIES`-style grace
  state with a verification banner.

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

### 3.2 [HIGH] Measure and instrument the funnel before launch
There is no event instrumentation on the register → verify → first pact →
first invite → partner accepted funnel. Without it the team can't see where
the viral loop leaks. LogRocket is wired for sessions; add explicit funnel
events (users-service `userMetrics` exists as a sink) for: registration source
(claim code vs organic), verification completion, pact creation, invite sent,
invite accepted, first check-in, D1/D7 return.

### 3.3 [HIGH] Time-to-value: pre-staged template + claim flow should land the
new invitee inside their friend's pact in ≤ 2 screens
The plumbing exists (claim drain on login). Verify on-device that an invited
user's first authenticated screen is the active pact with their friend's name
visible — not an empty dashboard that requires a refresh. The claim drain is
fire-and-forget on auth transition; the Habits landing reset may race it.
Consider awaiting the drain (with a 2-3s cap) before `resetToHabitsLanding`,
or re-fetching active pacts when the drain resolves.

### 3.4 [POLISH] Streak-loss empathy
Modern habit apps (Duolingo being the benchmark) soften streak loss (freeze
tokens, repair windows). `streaks`/`streak_history` already log resets, and the
resilience achievement rewards comebacks — good foundation. A "streak freeze"
(1 free skip per week, or earnable with coins) is the single highest-leverage
gamification addition for D30 retention. Schema-ready: add `freezesAvailable`
to `habits.streaks`.

---

## 4. Gamification & notification loops

### 4.1 [DONE] Achievement scaffolding is broad
Pact pioneer / accountability / socialite / resilience achievement families are
wired through brand-scoped `userAchievements`. Streak milestones recorded.

### 4.2 [HIGH] Partner-activity pushes are the retention engine — confirm
end-to-end delivery on HABITS Firebase
Types exist (`pactInvitation`, `pactAccepted`, `pactNudge`, streak types). The
known-open TODOs in push-notifications-service (per-brand bundle identifier at
`firebaseAdmin.ts:200,222`) are exactly where a misroute would silently kill
every one of these. This is pre-launch QA, not new code: send each type to a
physical device on the HABITS build.

### 4.3 [HIGH] Missed-checkin / partner-completed daily loop
The brief's core loop ("push when partner completes/misses") needs a scheduled
evaluator (cron) — event-driven pushes only fire on user action. If not yet
running, this is the top new-code retention item after launch instrumentation.

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

## 6. Launch-readiness order of operations (recommendation)

1. Cherry-pick the §1.1 backend commit to `general` and deploy (it also fixes
   the signup-claim streak bug).
2. Funnel instrumentation (§3.2) — you cannot tune a loop you cannot see.
3. On-device QA: claim-link → install → register → land-in-pact (§1.2, §3.3)
   and push delivery per type (§4.2).
4. Email-verification friction fix (§1.3) — biggest conversion lever.
5. Daily partner-activity scheduler (§4.3), then streak freeze (§3.4).
6. Payment workflow (Tier 2.5 in WORK_IN_PROGRESS.md) once retention holds.
