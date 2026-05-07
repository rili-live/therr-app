# Friends with Habits — Google Play Listing

**Status:** Draft for internal-testing track submission
**Last Updated:** 2026-05-07
**Branch:** `niche/HABITS-general`

This document holds the canonical Play Console listing copy, Data Safety form
answers, and screenshot plan for the Friends with Habits Android app. Update
in place when the listing changes. See `HABITS_PROJECT_BRIEF.md` for the
underlying product context this copy is derived from.

---

## App identity

| Field | Value |
|---|---|
| App name | Friends with Habits |
| Package name | `com.therr.habits` |
| Android namespace | `app.therrmobile` |
| versionCode | `1` |
| versionName | `0.1.0` |
| minSdk | 25 |
| targetSdk | 36 |
| Default locale | en-US |
| Default category | Health & Fitness |
| Secondary tag | Lifestyle |
| Content rating | Everyone (subject to IARC questionnaire — flag for review if user-uploaded photos make Teen more appropriate) |

---

## Store listing copy (en-US)

### App name (50 char max)

```
Friends with Habits
```

(19 chars)

### Short description (80 char max)

```
Build habits that stick. Pact with a friend and keep each other on streak.
```

(75 chars)

### Full description (4000 char max)

```
Friends with Habits is the habit tracker that actually works — because your
friend is in it with you.

Most habit apps let you give up in private. Friends with Habits doesn't.
Every habit you create is a "pact" with a partner. You check in. They check
in. You both keep the streak alive — together.

Why it works
• 95% of people who track habits with a partner stick with them.
• Without a partner, only 10% do.
• Solo apps can't bridge that gap. We make accountability the default.

How it works
1. Create a pact — pick a habit (workout, reading, meditation, anything daily)
2. Invite a friend — they join your pact and become your accountability partner
3. Check in every day — add a photo or quick note as proof
4. Watch the streak grow — and keep each other honest

Free tier
• 1 active pact at a time
• Daily photo + note check-ins
• Streak tracking
• Partner activity feed
• Push reminders

Premium ($6.99/month) — coming soon
• Unlimited pacts
• Video proof
• Custom consequences
• Health app integrations
• Advanced insights

Built on the Therr platform. Your account works across the Therr family of
apps. We don't need your location, your contacts, or your microphone — just
you, your habit, and your friend.

Start a pact today. The first one is free, and the only thing you need is
one friend who wants to change something too.
```

(~1,400 chars)

### Search keywords (informal — Play has no dedicated keyword field, used for SEO seeding in description and ASO ideation)

habit tracker, accountability, streak, daily routine, productivity, friends, fitness habits, mental health, partner, pact, social habit tracker

### Localized variants

en-US is the only required locale for internal testing. Spanish (es) and
Canadian French (fr-CA) translations follow the established `i18n-sync` rule
(see project root `CLAUDE.md`) and should be added before the production
track is opened. Use the `TherrMobile/main/locales/` dictionary keys as the
translation source of truth — listing copy should match in-app voice.

---

## Data Safety form

Answers below follow the Google Play Console **Data safety** questionnaire
section by section. Source-of-truth is a code audit of the HABITS build path
on `niche/HABITS-general` as of 2026-05-07: feature flags in
`TherrMobile/env-config.js` (HABITS overrides), permission declarations in
`TherrMobile/android/app/src/main/AndroidManifest.xml`, the active feature
set documented in `HABITS_PROJECT_BRIEF.md`, and the
`docs/niche-sub-apps/HABITS_PROJECT_BRIEF.md` data-flow notes.

**Pre-submission verification** (do before clicking **Submit** in Play Console):

1. Confirm the HABITS Firebase project (the `google-services.json` placed by
   `./_bin/switch-brand.sh habits`) actually has **Crashlytics** and
   **Analytics** turned on at the Firebase project level. If either is off
   for the HABITS project, remove the matching rows from sections 9 and 12
   below before submitting.
2. Confirm the production HABITS build does **not** invoke the location
   library shipped with the core Therr build (the
   `com.transistorsoft.locationmanager` package referenced in
   `AndroidManifest.xml`). HABITS feature flags (`ENABLE_MAP=false`,
   `ENABLE_AREAS=false`) prevent the location request flow at runtime; if
   that ever changes, section 1 below must be re-answered.
3. Confirm `READ_CONTACTS` is never requested at runtime on HABITS (no
   `PhoneContacts` flow is exposed when `ENABLE_HABITS=true`). The manifest
   declaration is inherited from the shared Android project; the runtime
   prompt is gated. If you cannot remove the manifest entry before launch,
   add a `<uses-permission … tools:node="remove" />` override in the
   HABITS-specific manifest before submitting (Play scans the manifest, not
   just runtime behavior).

---

### Top-level questions ("Data collection and security")

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** — TLS 1.2+ to `api.therr.com` (HTTPS) and `websocket-service.therr.com` (WSS). No plaintext endpoints. |
| Do you provide a way for users to request that their data is deleted? | **Yes** — in-app "Delete account" action (`Settings → Account → Delete account`) calls `DELETE /v1/users/me` on users-service, which hard-deletes the auth row and cascades to user-owned content. Off-app web request flow at `https://habits.therr.com/data-deletion` mirrors the same backend call (must be live before submission). |
| Do you commit to follow Google Play's Families Policy? | **No** — HABITS is not designed for or directed to children under 13. Do **not** opt in. |
| Has your app been independently validated against a global security standard (MASA)? | **No** — leave unchecked until/unless a MASA audit is performed. |

---

### Per data-type answers

For every data type below, the questionnaire asks five questions:

1. **Collected?** (Yes/No)
2. **Shared with third parties?** (Yes/No — "shared" here means transferred
   off our infrastructure to a separately-controlled party for their own
   use; transfers to a service provider acting on our behalf, such as
   Firebase, do not count as sharing per Google's definition.)
3. **Processed ephemerally?** (Yes/No — i.e. not retained beyond the
   request that uses it.)
4. **Required or Optional?** (Required = the user cannot complete the core
   flow without providing it.)
5. **Purposes** (multi-select from: *App functionality, Analytics, Developer
   communications, Advertising or marketing, Fraud prevention/security/
   compliance, Personalization, Account management*).

The matrix below is the full set of HABITS answers. Anything not listed is
**Not collected**.

#### 1. Location

| Subtype | Collected | Shared | Ephemeral | Required | Purposes |
|---|---|---|---|---|---|
| Approximate location | **No** | — | — | — | — |
| Precise location | **No** | — | — | — | — |

*Rationale:* `ENABLE_MAP` and `ENABLE_AREAS` are forced `false` for HABITS
in `TherrMobile/env-config.js`; no UI in the HABITS build requests location
permission, and no location data is sent to the backend. The
`com.transistorsoft.locationmanager` library is present in the shared
Android project but is never initialized at runtime under HABITS — verify
via item (2) of the pre-submission checklist above.

#### 2. Personal info

| Subtype | Collected | Shared | Ephemeral | Required | Purposes |
|---|---|---|---|---|---|
| Name | **Yes** | No | No | Required (display name on pact feed) | Account management, App functionality |
| Email address | **Yes** | No | No | Required (sign-up + auth) | Account management, App functionality, Developer communications |
| User IDs | **Yes** | No | No | Required (server-issued UUID) | Account management, App functionality, Analytics |
| Address | **No** | — | — | — | — |
| Phone number | **Yes** | No | No | Optional (only stored if user enters during profile edit; HABITS does not require SMS verify) | Account management, Fraud prevention/security/compliance |
| Race and ethnicity | **No** | — | — | — | — |
| Political or religious beliefs | **No** | — | — | — | — |
| Sexual orientation | **No** | — | — | — | — |
| Other personal info | **No** | — | — | — | — |

#### 3. Financial info

| Subtype | Collected | Shared | Ephemeral | Required | Purposes |
|---|---|---|---|---|---|
| User payment info | **No** | — | — | — | — |
| Purchase history | **No** | — | — | — | — |
| Credit score | **No** | — | — | — | — |
| Other financial info | **No** | — | — | — | — |

*Rationale:* Premium tier ($6.99/mo) is **not yet shipped**. When in-app
purchases launch, payment is handled by Google Play Billing — which Google
considers to **not** be data collection by the app, so this section may
remain **No** even post-launch. Re-evaluate if any non-Play payment path
(e.g. web checkout) is added.

#### 4. Health and fitness

| Subtype | Collected | Shared | Ephemeral | Required | Purposes |
|---|---|---|---|---|---|
| Health info | **No** | — | — | — | — |
| Fitness info | **No** | — | — | — | — |

*Rationale:* HABITS stores user-defined habit names and check-in streaks
(e.g. "Read 15 minutes", "Pull-ups"). These are user-generated text labels,
not measurements from a health/fitness API or sensor. They are declared
under "App activity → Other user-generated content" rather than here. The
"Health app integrations" line in the store description is a **Premium /
coming soon** feature; do not declare health data until that integration
ships, at which point Apple Health / Google Fit fields must be added here.

#### 5. Messages

| Subtype | Collected | Shared | Ephemeral | Required | Purposes |
|---|---|---|---|---|---|
| Emails | **No** | — | — | — | — |
| SMS or MMS | **No** | — | — | — | — |
| Other in-app messages | **Yes** | No | No | Optional (DM is a feature, not required to use core pact flow) | App functionality |

*Rationale:* Direct messages between pact partners are stored on
messages-service so they can be delivered to the recipient and re-loaded on
device change. Messages between pact members are end-stored (not E2E
encrypted) — encryption-at-rest is at the database layer.

#### 6. Photos and videos

| Subtype | Collected | Shared | Ephemeral | Required | Purposes |
|---|---|---|---|---|---|
| Photos | **Yes** | No | No | Optional (proof photos and profile photo are both optional) | App functionality |
| Videos | **No** | — | — | — | — |

*Rationale:* Photo upload is used for (a) profile avatar and (b) optional
"proof" attachment on a daily check-in. Stored on ImageKit
(`ik.imagekit.io/qmtvldd7sl/`) which is a service provider acting on our
behalf — not third-party sharing. Video proof is listed in the store
description as a **Premium / coming soon** feature; do not flip this to
Yes until that ships.

#### 7. Audio files

| Subtype | Collected | Shared | Ephemeral | Required | Purposes |
|---|---|---|---|---|---|
| Voice or sound recordings | **No** | — | — | — | — |
| Music files | **No** | — | — | — | — |
| Other audio files | **No** | — | — | — | — |

*Rationale:* No `RECORD_AUDIO` permission is declared in
`AndroidManifest.xml`; HABITS has no voice features.

#### 8. Files and docs

| Subtype | Collected | Shared | Ephemeral | Required | Purposes |
|---|---|---|---|---|---|
| Files and docs | **No** | — | — | — | — |

#### 9. Calendar

| Subtype | Collected | Shared | Ephemeral | Required | Purposes |
|---|---|---|---|---|---|
| Calendar events | **No** | — | — | — | — |

#### 10. Contacts

| Subtype | Collected | Shared | Ephemeral | Required | Purposes |
|---|---|---|---|---|---|
| Contacts | **No** | — | — | — | — |

*Rationale:* `READ_CONTACTS` is declared in the shared
`AndroidManifest.xml` but the HABITS feature flag set
(`ENABLE_HABITS=true`, no `PhoneContacts` route exposed) means the runtime
prompt is never triggered. See pre-submission checklist item (3) — strip
the manifest entry on the HABITS branch if possible before submitting.

#### 11. App activity

| Subtype | Collected | Shared | Ephemeral | Required | Purposes |
|---|---|---|---|---|---|
| App interactions | **Yes** | No | No | Optional (user can disable Analytics in `Settings → Privacy`; honored via Firebase `setAnalyticsCollectionEnabled(false)`) | Analytics |
| In-app search history | **No** | — | — | — | — |
| Installed apps | **No** | — | — | — | — |
| Other user-generated content | **Yes** | No | No | Required for the core pact flow (a pact has a name; a check-in may have a note) | App functionality |
| Other actions | **No** | — | — | — | — |

*Rationale:* "Other user-generated content" covers pact names, habit
labels, daily check-in notes, and any text the user types into a Goal /
Thought. "App interactions" covers Firebase Analytics screen-view and
custom events.

#### 12. Web browsing

| Subtype | Collected | Shared | Ephemeral | Required | Purposes |
|---|---|---|---|---|---|
| Web browsing history | **No** | — | — | — | — |

#### 13. App info and performance

| Subtype | Collected | Shared | Ephemeral | Required | Purposes |
|---|---|---|---|---|---|
| Crash logs | **Yes** | No | No | Required (Firebase Crashlytics; cannot be disabled per-user) | App functionality, Analytics |
| Diagnostics | **Yes** | No | No | Required | App functionality, Analytics |
| Other app performance data | **No** | — | — | — | — |

*Rationale:* Crashlytics + Performance Monitoring are initialized at app
launch and not user-toggleable. If the HABITS Firebase project does not
have these products enabled (verify per pre-submission checklist item 1),
flip both rows to **No**.

#### 14. Device or other identifiers

| Subtype | Collected | Shared | Ephemeral | Required | Purposes |
|---|---|---|---|---|---|
| Device or other identifiers | **Yes** | No | No | Required (FCM registration token for push; Firebase Installation ID for Crashlytics/Analytics; AAID for Analytics if user has not opted out at OS level) | App functionality, Analytics, Fraud prevention/security/compliance |

*Rationale:* `com.google.android.gms.permission.AD_ID` is declared in the
manifest because Firebase Analytics reads the Advertising ID when
available. We do **not** use AAID for ad targeting — purposes selected
reflect that. If you ever stop using Firebase Analytics, also remove the
`AD_ID` permission and re-answer this row.

---

### Summary: data NOT collected by HABITS

For quick reference / press: HABITS does **not** collect Location (Precise
or Approximate), Race/ethnicity, Political/religious beliefs, Sexual
orientation, Address, Payment info, Purchase history, Credit score, Health
info, Fitness info, Email/SMS messages, Audio recordings, Music or other
audio files, Files/docs, Calendar events, Contacts, In-app search history,
Installed apps, or Web browsing history.

---

### Security practices answers

| Question | Answer |
|---|---|
| Data is encrypted in transit | **Yes** — TLS to all backend hosts. |
| You provide a way for users to request that their data is deleted | **Yes** — in-app `DELETE /v1/users/me`; web mirror at `https://habits.therr.com/data-deletion`. |
| You follow Google Play's Families Policy | **No** — HABITS targets adults; not designed for under-13. |
| You have been independently validated against a global security standard | **No** — leave unchecked until a MASA audit is conducted. |

---

## Privacy policy

**Status:** ⚠️ BLOCKER — not yet hosted at a HABITS-specific URL.

**Decision (2026-04-23):** Stand up `habits.therr.com` as a minimal landing
site reusing the existing therr-client-web infrastructure. Privacy policy
will live at `https://habits.therr.com/privacy-policy`. See implementation
plan in `niche/HABITS-general` Phase 5 chat thread or open issue.

**Required URL for Play Console submission:**
```
https://habits.therr.com/privacy-policy
```

**Implementation tasks (general branch):**
1. Add `habits.therr.com` and `www.habits.therr.com` to TLS hosts in `k8s/prod/ingress-service.yaml`, add ingress rules pointing at `client-cluster-ip-service:7070`.
2. Add Cloudflare CNAMEs for `habits` and `www.habits` (proxied).
3. Add hostname-aware routing to therr-client-web Express server: when `req.hostname === 'habits.therr.com'`, serve Habits-specific templates.
4. Author three minimal pages: `/` (landing), `/privacy-policy`, `/terms-of-service`.

Until the HABITS-specific URL is live, the listing **cannot** be submitted
even to the internal testing track — Play requires the privacy URL on every
track.

---

## Screenshot plan

**Device target:** Pixel 9 emulator (1080×2400, 6.7" portrait)

**Required count:** 2–8 phone screenshots. Plan for 6–8 in the final upload.

**Output directory:** `docs/niche-sub-apps/habits/play-listing-screenshots/`

**Capture command:**
```bash
adb -s emulator-5554 exec-out screencap -p \
  > docs/niche-sub-apps/habits/play-listing-screenshots/NN-<slug>.png
```

### Captured

| # | File | Screen | Why |
|---|---|---|---|
| 1 | `01-onboarding-make-pacts-hero.png` | Onboarding slide 3 — chameleon mascot, "Make pacts with friends and change your lives together", Get Started CTA | Strongest branded hero — leads with mascot + value prop |
| 2 | `02-onboarding-build-habits.png` | Onboarding slide 1 — "Build Habits That Stick" (waterfall) | Reinforces the value prop with category framing |
| 3 | `03-onboarding-invite-friends.png` | Onboarding slide 2 — "Invite Friends to Keep You Accountable" (tree) | Surfaces the differentiator (accountability via friends) |
| 4 | `04-pact-onboarding-empty-state.png` | PactOnboardingGuard — "Start your first pact", 3-step guide, Invite a friend CTA | First product UI — explains the pact flow before showing data |
| 5 | `05-dashboard-multi-habit.png` | HabitsDashboard top — "Good evening!" greeting, 1/7 Today + 13 Best Streak overall progress, Pull-ups + Read 15 minutes habit cards with Check In CTAs | Shows the lived dashboard with active habits and quick-action check-ins |
| 6 | `06-active-streak-widget.png` | HabitsDashboard scrolled — "Morning workout" with 13-day current streak ribbon, "Next milestone: 14 days" progress bar, Completed! state, plus Meditation & Daily journal cards | Visualises the streak widget and pact-linked habit completion — the core "it's working" moment |

`_holdback-boot-splash.png` is the boot splash; held back from the listing
(Play discourages splash-only screenshots, and it doesn't communicate
product value).

### Still to capture

| # | Screen | Why |
|---|---|---|
| 7 | PactDetail showing partner activity feed | Social accountability mechanic in visual form |
| 8 | Check-in modal with photo + note (Phase 4b feature) | Freshest visual; demonstrates daily proof |

**Feature graphic** (1024×500, required before listing publishes):
- Defer until brand assets are finalized.
- Internal testing can submit without one if Play allows it; production cannot.

**Optional additions:**
- 7" / 10" tablet screenshots — not required, defer.
- Video preview (YouTube link) — optional, defer.

---

## AAB build sequence

Once a HABITS upload keystore exists and signing properties are set in
`~/.gradle/gradle.properties` (see Phase 5 plan):

```bash
./_bin/switch-brand.sh habits
grep CURRENT_BRAND_VARIATION TherrMobile/main/config/brandConfig.ts

cd TherrMobile
npm run android:clean
npm run build:release
```

Output: `TherrMobile/android/app/build/outputs/bundle/release/app-release.aab`

**Pre-upload verification:**
```bash
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab
jarsigner -verify -verbose android/app/build/outputs/bundle/release/app-release.aab | head -20
```

Confirm the signing certificate is the new `habits-upload` keystore, not
Therr's existing `therr-upload.keystore`.

Upload via Play Console → Internal testing → Create new release → Upload AAB.

---

## Open items / blockers

- [/] **Privacy policy URL live** at `https://habits.therr.com/privacy-policy` (blocker for any track)
- [ ] **HABITS upload keystore generated** and stored (blocker for AAB)
- [ ] **HABITS Firebase project verification** — confirm Crashlytics + Analytics are actually enabled at the project level for the HABITS google-services.json
- [/] **Backend deploy of `258c39c6e`** (proofMedias support) reaches prod via `general → stage → main`
- [ ] **Feature graphic art** (1024×500) — required before public/closed track, optional for internal
- [/] **Brand-final launcher icon + boot splash** — Phase 2 placeholders work for internal testing but block external testing
- [ ] **Spanish + French translations** of listing copy — required before production track
