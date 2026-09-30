# Friends with Habits — Onboarding Friction Audit & Redesign

**Date:** 2026-09-30 · **Branch scope:** `niche/HABITS-general` (mobile) + `general` (web, backend)
**Status:** audit complete; P0 fixes shipped with this doc (see § 7); P1/P2 are proposals.

This is a screen-by-screen walk from "saw an ad / got an invite" to "second check-in",
listing every point where a new user can drop off, scored with Alex Hormozi's value
equation, with a fix for each. It is written so the next session can pick up any row
and build it.

---

## 1. The problem in one funnel

GA4 app property `267810693`, organic, 5 Jun – 2 Sep 2026 (`WORK_IN_PROGRESS.md`,
`PAID_ACQUISITION_PLAYBOOK.md` decision log):

| Step | Users | Of installs |
|---|---:|---:|
| Install (`first_open`) | 182 | 100% |
| Profile started (`profile_create_start`) | 75 | 41% |
| Phone step passed (`phone_verify_success`) | 14 | 7.7% |
| Sent an invite (`connection_invites_sent`) | 2 | 1.1% |

Last 28 days (`HABITS_PLAY_LISTING_UPDATE_2026-09-24.md`): 35% of installs uninstall;
store-listing conversion 25.2%. Both paid campaigns are paused at $0 because the
playbook's own rule is *fix onboarding before buying traffic* — at a one-time $20
unlock, every point of activation lost multiplies straight into cost per payer.

> **Measurement caveat found during this audit.** `phone_verify_success` fires when
> the SMS code is **sent** (`CreateProfilePhoneVerify.tsx` `onSubmitVerifyPhone`),
> not when it is verified — that is `phone_verify_code_success`. So "7.7% passed the
> phone step" is really "7.7% requested a code"; true verification is lower still.
> The event also carried the raw phone number to Firebase (fixed, § 7).

---

## 2. The lens: Hormozi's value equation

```
             Dream outcome  ×  Perceived likelihood of achievement
Value  =  ─────────────────────────────────────────────────────────
             Time delay     ×  Effort & sacrifice
```

Onboarding is where the denominator is paid and the numerator is only promised. A
user decides in the first ~2 minutes whether the trade is worth it. Every screen
either raises the top (makes the outcome feel real and likely) or lowers the bottom
(less time, less effort) — or it is friction.

Applied to Friends with Habits as it stood on 2026-09-29:

| Lever | What the user got | Verdict |
|---|---|---|
| **Dream outcome** | "Build habits that stick" — generic; the landing and store say it well, the app's first screen does not | Weak in-app |
| **Perceived likelihood** | Nothing proves it works for *them* until a friend accepts; the app's first act is to ask for trust (phone, contacts, notifications) | Low |
| **Time delay** | First check-in blocked until a friend installs, registers, and accepts — hours to never | **Extreme** |
| **Effort & sacrifice** | 3 intro slides → phone → SMS → email + DOB → Login → 2nd SMS → username → interests → picture → phone again → 3rd SMS → contacts → invite → push opt-in → pact wizard (4 steps) → wait | **~15 screens, up to 3 SMS codes** |

The single biggest insight: **the core mechanic (you need a friend) was implemented as
a gate before value, when it should be the reward after value.** Hormozi's rule for
onboarding is *get the customer their first win as fast as possible, then sell the
next step*. The first win here is a check-in on day 1 with a streak counter at 1 — and
the product made that impossible without a second person.

---

## 3. Friction ledger

Lever: **T** = time delay, **E** = effort/sacrifice, **L** = perceived likelihood,
**D** = dream outcome. Severity: 🔴 users measurably leave here / hard dead end,
🟠 likely drop, 🟡 papercut. **Status:** ✅ fixed in this change, 📋 proposed below.

### 3a. Acquisition → install

| # | Friction | Evidence | Lever | Sev | Fix | Pri | Status |
|---|---|---|---|---|---|---|---|
| A1 | Landing said free accounts track **5** habits; code limit is **3** | `views/habits/landing.hbs:1466`, `FeatureFlags.ts:75` | L | 🟠 | Say 3. A broken promise at the paywall costs more than a smaller one up front | P0 | ✅ |
| A2 | Play links carry no `&referrer=`, so UTMs and invite identity die at the store | `landing.hbs`, `invite.hbs:242` | L,T | 🔴 | Append `&referrer=utm_source%3D…%26invite%3D<token>` on every habits-host Play link; the app already reads the install referrer (versionCode 35) — extend it to redeem `invite`/`pact` tokens | P1 | 📋 |
| A3 | Paid search points at `/`, a long-form page, not a single-CTA page | `habits-web-landing.yaml:88-140` | E | 🟡 | A `/start` variant: headline, 3 bullets, one Play button. Test before spending | P2 | 📋 |
| A4 | The 95%/10% "ASTD study" stat is now cited, but the underlying study is widely reported as unverifiable | `landing.hbs:1417-1432` | L | 🟡 | Replace with first-party proof as soon as it exists ("X pacts kept this month") | P2 | 📋 |
| A5 | Web signup can't redeem an invite and ends in "verify email → install → sign in" (3 hops, 0 value) | `register.hbs:213-217,366-377` | T,E | 🟠 | Either drop web signup from habits host (Play is the funnel) or pass invite codes and deep-link "Open the app" | P1 | 📋 |
| A6 | `/u/:userName` 404'd habits-only profiles (missing brand header) and has no CTA | `server-client.tsx` profile route | L | 🟠 | Header added. Add "Make a pact with {name}" CTA → Play with referrer | P0 / P1 | ✅ header, 📋 CTA |
| A7 | Claim page showed the claim **UUID** as "Your pact code"; Register only accepts `PACT-XXXX` | `server-client.tsx` invite view, `users.ts:233` | E | 🟠 | Line removed; the real code is in the email/SMS | P0 | ✅ |
| A8 | Live Play listing still says "1 active pact", "$6.99 coming soon", "we don't need your contacts" | `HABITS_PLAY_LISTING_UPDATE_2026-09-24.md` | L | 🟠 | Paste the prepared listing update (already a manual follow-up) | P0 (manual) | 📋 |

### 3b. First open → account

| # | Friction | Evidence | Lever | Sev | Fix | Pri | Status |
|---|---|---|---|---|---|---|---|
| B1 | 3-slide carousel with no skip and **no Log in** — returning users had to swipe 3× and back out of Register | `routes/Landing.tsx` | E | 🟠 | "I already have an account" link on every slide | P0 | ✅ |
| B2 | Carousel sells nothing specific ("Build Habits That Stick") | `landing.background.*` | D | 🟡 | One slide, outcome-first: "Pick a habit. Check in today. Bring a friend to lock it in." | P1 | 📋 |
| B3 | Register subtitle linked to a "public map" that doesn't exist on Habits — dead tap | `Register/index.tsx` | L | 🟡 | Habits-specific subtitle, no link | P0 | ✅ |
| B4 | Google/Apple sign-in only on the secondary email path, not the default phone screen | `RegisterForm.tsx:542-563` | E | 🟠 | Put SSO buttons above "Use your phone" — SSO skips email verification *and* SMS | P1 | 📋 |
| B5 | SSO with unverified email fails silently (`console.log` only) | `RegisterForm.tsx:338-341` | L | 🟡 | Toast with next step | P1 | 📋 |
| B6 | DOB required at signup | `PhoneSignupForm.tsx:292-300` | E | 🟡 | Keep — it is the age gate (Play / COPPA). Pre-focus a year picker to make it one gesture | — | kept |
| B7 | Phone signup ends on Login → **second SMS code** before any value | `Register/index.tsx` `onPhoneSignupSuccess` | T,E | 🔴 | Signed straight in when they set a password. Without one, needs a backend "register returns session" (the `phoneVerificationToken` is scoped to `register`) | P0 / P1 | ✅ w/ password, 📋 passwordless |
| B8 | Email signup: login blocked until the email link is clicked | `auth.ts:354-371` | T | 🟠 | Let email signups in with a 7-day grace, verify-banner in app; block only outbound actions (invites) until verified | P1 (backend, `general`) | 📋 |

### 3c. Profile setup (CreateProfile)

| # | Friction | Evidence | Lever | Sev | Fix | Pri | Status |
|---|---|---|---|---|---|---|---|
| C1 | **Phone verification required, no skip** — the largest measured drop (~70% of those who reached it left). Server only needs it for texting invites to non-users | `CreateProfilePhoneVerify.tsx:212-223` (skip commented out), gateway `router.ts:349-362` | E,L | 🔴 | Removed from Habits onboarding. Asked just-in-time: PhoneContacts already routes the 403 from `multi-invite` to `CreateProfile { stage: 'phone' }`, which now returns to the caller when done, with copy that explains why ("your invites are texted from your number") | P0 | ✅ |
| C2 | Phone-first signups were asked to verify the same number **again** (3rd SMS) | stage field starts empty | E | 🔴 | Gone with C1 | P0 | ✅ |
| C3 | Interests required; copy is Therr's ("content discovery"); nothing in Habits reads them | `CreateProfileInterests.tsx:182` | E,D | 🟠 | Removed from Habits onboarding (still reachable from the profile checklist) | P0 | ✅ |
| C4 | **Dead end:** last stage's "Skip for Now" called `navigate('Map')`; Map is filtered out on Habits, so the tap did nothing and the user was stranded until restart | `CreateProfile/index.tsx` `onFinishOnboarding` | — | 🔴 | Resets to the Habits landing (push opt-in once, then dashboard) via shared `getHabitsLandingRouteName()` | P0 | ✅ |
| C5 | Invite stage promised a "Socialite achievement… rewards" that Habits doesn't have | `inviteFriends.description` | L | 🟡 | Habits copy that says what inviting does | P0 | ✅ |
| C6 | "Keep it secure / 2-Factor-Auth" framing on the phone step — it is not 2FA | `pageSubHeaderPhone` | L | 🟡 | Habits copy (C1) | P0 | ✅ |
| C7 | Contacts permission asked during onboarding, before any value | `SyncContacts` stage | L | 🟡 | Move into the pact wizard's partner step ("find friends already here"), where the reason is obvious | P1 | 📋 |

Habits onboarding went from **5 tracked stages + invite + push opt-in** to
**3 tracked stages (username, picture, contacts) + invite + push opt-in**, and from up
to 3 SMS codes to 1 (0 with Google/Apple once B4 lands).

### 3d. The pact wall (the real activation problem)

| # | Friction | Evidence | Lever | Sev | Fix | Pri | Status |
|---|---|---|---|---|---|---|---|
| D1 | Push opt-in shown before the user has done anything | `HabitsPushOptIn`, `Layout.resetToHabitsLanding` | L | 🟡 | Already has a `pactCreate` trigger — drop the pre-dashboard screen once D3 lands so the ask comes right after the first pact | P1 | 📋 |
| D2 | `PactOnboardingGuard` covers the dashboard; the only way forward is inviting | `PactOnboardingGuard.tsx:81-120` | T | 🔴 | See redesign § 4: habit first, friend second | P1 | 📋 |
| D3 | Partner picker only lists **existing users**; the share link creates no pact and doesn't count as a partner. A new user whose friends aren't on the app is **stuck** | `CreatePactInvite.tsx:1612-1720` | T,E | 🔴 | **Pact seat by link** (§ 4.2) | P1 | 📋 |
| D4 | Solo tracking needs 3 distinct *pact partners with accounts*; friend invites to non-users don't count, though the brief says "invites sent count" | `soloHabitAccess.ts:39-66` vs brief | L | 🔴 | Count link seats and SMS/email invites sent. Reframe as a reward (§ 4.3) | P1 | 📋 |
| D5 | Dashboard card hides check-in while the partner is pending; detail screen shows it and the server accepts it. Does day 1 count? Users can't tell | `HabitCard.tsx:271` vs `HabitDetail.tsx:986`, `habitCheckins.ts:209-227` | L | 🟠 | Show check-in everywhere; "Day 1 ✓ — {friend} joins, streak doubles" | P1 | 📋 |
| D6 | Pact claim expires in 14 days, silently; nobody is reminded | `dispatchPactInvitation.ts:14`, `pacts.ts:709` | T | 🟠 | Reminder to invitee at day 3 and 10; nudge inviter to resend at day 7 (§ 5) | P1 | 📋 |
| D7 | `pendingPactClaimToken` only drains on the logged-out → logged-in flip; a signed-in user with an incomplete profile loses it | `Layout.tsx:372-391` | L | 🟡 | Also drain when the profile completes | P2 | 📋 |
| D8 | Accepting a friend's pact at the 3-habit cap hits the paywall — on the viral step | `pacts.ts:565-571` | L | 🟡 | Let acceptance exceed the cap by one ("guest seat") — the inviter's friend is the growth loop, not the revenue | P2 | 📋 |

### 3e. Nurture and measurement

| # | Friction | Evidence | Lever | Sev | Fix | Pri | Status |
|---|---|---|---|---|---|---|---|
| E1 | No welcome message of any kind | `user.ts:720-761` | L | 🟠 | § 5 sequence | P1 | 📋 |
| E2 | Every digest pass needs an existing pact/habit, so users who stalled get **nothing** | `habitsDigest.ts:233-285` | T | 🔴 | § 5 sequence targets exactly them | P1 | 📋 |
| E3 | `createYourProfileReminder` / invite-reminder push types exist, nothing sends them | push-notifications-service | — | 🟠 | Wire into § 5 | P1 | 📋 |
| E4 | No events for signup success, onboarding finished, pact accepted | mobile analytics | — | 🟠 | `sign_up_complete`, `onboarding_complete`, `habit_pact_accept`, `landing_sign_in_click` added | P0 | ✅ |
| E5 | Raw phone number sent to Firebase in `phone_verify_success` | `CreateProfilePhoneVerify.tsx` | — | 🔴 (policy) | Removed | P0 | ✅ |
| E6 | `product.py` "unlocked" counts `main.invites`, backend counts pact partners; "pacted" misses group pacts | `scripts/google-ads/therr_ads/product.py:48-105` | — | 🟡 | Align to `pact_members` | P2 | 📋 |

---

## 4. The redesigned first session: "first check-in in 60 seconds, friend joins after"

Hormozi: *sell the vacation, not the plane flight* — and let them taste the vacation
before asking for the flight. The plane flight is the account, the phone, the friend.
The vacation is a streak that's going.

### 4.1 Target flow

```
Install → [Continue with Google]            (1 tap; phone signup still available)
        → username (prefilled from Google name, editable)      ~10s
        → "Pick your first habit" (template grid, 1 tap)       ~10s
        → "Check in for today?" → ✓  Streak: 1 🔥              ~5s   ← FIRST WIN
        → "Habits stick 2× longer with a friend on the hook.
           Send {habit} to a friend — your streak is shared once they join."
           [Share link]  [Pick from contacts]  [Later]
        → dashboard, pact card shows "Waiting for {friend}… Day 1 ✓"
```

Time to first win: ~30–60 seconds instead of "when a friend installs". Screens before
value: 2 instead of ~15.

The partner requirement doesn't go away — it moves to **after** the first check-in,
where the user has something to lose (their streak) and the ask reads as protection,
not a toll.

### 4.2 Pact seat by link (fixes D3, D4, A2)

- The wizard's "share link" creates a **pending pact seat**: a `pact_members` row with
  no `userId` and a claim token, instead of a generic `/invite/<username>` link.
- Link: `habits.therr.com/claim-pact/<token>`. Its Play button carries
  `&referrer=pact%3D<token>`, and the app's install-referrer reader redeems it after
  signup. No typing, no codes, nothing lost at the store.
- A sent seat counts toward the solo unlock the moment it is sent. The brief already
  promises this ("invites sent count"); the code doesn't yet.
- The inviter checks in from day 1. When the friend claims the seat, the pact becomes
  shared and the friend's first check-in starts the shared streak.
- Backend work (`general`): `pact_members.userId` becomes nullable for seats (an
  expand-only migration, per the idempotency rules). `findByClaim` binds the seat on
  claim, and the claim endpoint accepts an unbound seat. Messaging automator impact:
  grep its `src/store/` for `pact_members` first (CLAUDE.md § Sibling Repos).

### 4.3 Solo unlock as a reward, not a gate (fixes D4)

Replace "invite 3 people or you can't track alone" with **"Your first habit is free
to track solo for 7 days. Invite 1 friend to keep it going."** The user gets value
first, and the scarcity is real (their own streak) rather than imposed.
`HABITS_SOLO_UNLOCK_INVITE_COUNT` stays as the long-term threshold for a *second*
solo habit.

---

## 5. Nurture sequence for users who stall

Everything goes through `enqueueNotification` with **period-stamped** dedupe keys
(`onboarding:welcome`, `onboarding:nopact:d1`, `seat:<id>:d3`). Never put
`Date.now()` in a key; see CLAUDE.md § Sibling Repos rule 4. It is only delivered
while `NOTIFICATION_QUEUE_WORKER_ENABLED=true`.

| When | Who | Channel | Message (value-first, one CTA) |
|---|---|---|---|
| +0 | Every new habits account | email | "Your first habit takes 10 seconds →" deep link into the wizard |
| +24h | No habit yet | push, then email | "Pick one habit. Check in once. That's day 1." |
| +24h | Habit, pact seat unclaimed | push to inviter | "{friend} hasn't joined yet — resend?" (1-tap reshare) |
| +3d / +10d | Seat invitee (has the link) | email/SMS on the invite channel | "{inviter} is on day {n} of your pact. Your seat expires in {d} days." |
| +7d | Checked in 3+ times, still solo | push | Founder offer (§ 6), shown only after the habit has earned it |

Build this in users-service on `general`. It reuses the existing queue and
push-notification types (E3), so there is no new infrastructure.

---

## 6. The Grand Slam onboarding offer

Hormozi's recipe: **list every obstacle → turn each into a solution → trim and stack →
add scarcity, urgency, bonuses, a guarantee → name it.** Every claim below has to be
true on the day it ships. Claims marked *(build)* are not true yet.

**Obstacles a new user has, and the answer to each:**

| "I can't / I won't because…" | Solution in the offer |
|---|---|
| "I've quit every habit app" | A friend on the hook, and the streak is shared |
| "My friends aren't on this app" | One link and they join in one tap *(build: § 4.2)* |
| "I don't want to hand over my number and contacts" | Neither is needed to start *(true now: C1, C7)* |
| "It'll take forever to set up" | First check-in in under a minute *(build: § 4.1)* |
| "It'll nag me / spam my friends" | "We only ping you for pact activity" (already the push opt-in promise) |
| "It'll want a subscription" | Free to track 3 habits; one-time $20 founder unlock, no renewal *(true now)* |

**Name (MAGIC formula):** *The 30-Day Pact.* Pacts are already 30 days
(`CreatePactInvite.tsx` `bulkInvitePact`). It names the outcome and the time box, and
lives in the landing hero, the store short description and the wizard title.

**Stack (in-app, at the founder offer):**
1. Unlimited habits for life. *True now.*
2. Every premium feature shipped later. *True now; it's the founder terms.*
3. Founding-member badge on your profile and pact cards. *(build — cheap, and status is a Hormozi bonus that costs nothing to deliver)*
4. A free founder unlock to give to one friend. *(build — needs a Play promo code pool; turns the buyer into a recruiter)*

**Scarcity:** "{n} of 5,000 founder spots left", with a live count from the purchase
ledger. The cap already exists (`HABITS_LIFETIME`, first 5,000). Showing it honestly
is the whole trick. Never show a fake number.

**Urgency:** tie it to the user's own streak, not a countdown timer: offer on day 7 of
a live streak. That is the moment perceived likelihood is highest (§ 5).

**Guarantee (owner decision required):** "Keep a 30-day pact or get your $20 back."
It is a conditional guarantee, which Hormozi rates highest because it makes the buyer
do the thing that makes them successful. Refunds would go through the Play Console by
hand. At current volume that is minutes a month, but it is a commitment the owner has
to accept. **Not implemented; decide before any copy mentions it.**

---

## 7. What shipped with this doc (P0)

**Mobile** (`TherrMobile`, niche branch)
- `CreateProfile/index.tsx`
  - `getStageOrder()`: Habits drops `interests` and `phone` from onboarding.
  - `advanceFrom()` walks the brand's order and hands back to the caller for a
    stage opened just-in-time.
  - `onFinishOnboarding()` resets Habits users to the push opt-in or dashboard
    instead of the nonexistent Map (C1–C4).
- `utilities/brandLandingRoute.ts`: new `getHabitsLandingRouteName()`, shared by
  Layout's auth reset and CreateProfile.
- `Landing.tsx`: "I already have an account" on every slide, plus the
  `landing_sign_in_click` event (B1).
- `Register/index.tsx`
  - Habits subtitle with no dead map link (B3).
  - A phone signup that set a password is signed straight in, with no second SMS
    (B7).
  - `sign_up_complete` event.
- `InviteFriends.tsx`, locales (all three): Habits copy for the invite and phone
  stages (C5, C6).
- `CreateProfilePhoneVerify.tsx`: raw phone number removed from analytics (E5).
- `Habits/Dashboard.tsx`, `Pacts/PactDetail.tsx`: `habit_pact_accept` event (E4).
- Tests: `__tests__/routes/CreateProfile.habits.test.tsx` (new). The existing
  `CreateProfile.test.tsx` is pinned to the Therr order.

**Web** (`therr-client-web`, must ship from `general`)
- `landing.hbs`: free tier says 3 (A1).
- `server-client.tsx`: `/u/:userName` sends the habits brand header (A6). The claim
  page no longer shows the UUID as a pact code (A7).

**Manual follow-ups**
- [ ] Device check on the internal track: fresh install → phone signup (with and
  without a password) → no phone or interests stage → push opt-in → dashboard. Then
  sync contacts → invite a non-user by SMS → phone verification appears → returns to
  contacts.
- [ ] GA4: mark `sign_up_complete`, `onboarding_complete` and `habit_pact_accept` as
  key events. Read the funnel from `phone_verify_code_success`, not
  `phone_verify_success` (§ 1 caveat).
- [ ] Paste the prepared Play listing update (A8).

---

## 8. Success metrics

Read two weeks after the build ships, same GA4 property, organic only:

| Metric | Baseline | Target |
|---|---:|---:|
| `onboarding_complete` / `first_open` | not measured (C4 stranded users) | ≥ 35% |
| First check-in within first session | ~0% (blocked by D2) | ≥ 25% after § 4.1 |
| `habit_pact_create` (or seat sent) / `first_open` | 1.1% | ≥ 10% |
| `habit_pact_accept` / seats sent (viral step) | not measured | ≥ 30% |
| Uninstall / `first_open` | 35% | ≤ 25% |

Only restart paid acquisition once the pact rate clears 10%. That is the point at
which the playbook's $17 cost-per-payer ceiling becomes reachable.
