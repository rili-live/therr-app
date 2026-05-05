# Friends with Habits — Google Play Listing

**Status:** Draft for internal-testing track submission
**Last Updated:** 2026-04-23
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

Based on a code audit of the HABITS build path on `niche/HABITS-general` as
of 2026-04-23. Verify the HABITS Firebase project (referenced by
`TherrMobile/android/app/google-services.json` after `switch-brand.sh habits`)
has Crashlytics and Analytics enabled before submitting — if either is
disabled at the project level, remove the corresponding row.

### Data collected

| Data type | Collected | Shared with third parties | Required (vs optional) | Purpose |
|---|---|---|---|---|
| Email address | Yes | No | Required | Account management, communications |
| Name | Yes | No | Required | Account management |
| Phone number | Yes | No | Optional (only if user opts into SMS verify) | Account management, fraud prevention |
| Profile photo | Yes | No | Optional | App functionality (user identity in pact feed) |
| Photos uploaded as habit proof | Yes | No | Optional (proof attachment is not required for check-in) | App functionality |
| User-generated text (check-in notes, pact descriptions) | Yes | No | Optional | App functionality |
| Device identifiers (FCM token) | Yes | No | Required | Push notifications |
| Crash logs (Firebase Crashlytics) | Yes | No | Required | App functionality, diagnostics |
| App interactions / analytics events (Firebase Analytics) | Yes | No | Optional (user can disable in app settings; honored via `setAnalyticsCollectionEnabled`) | Analytics |

### Data NOT collected (relevant for HABITS, despite being in the underlying Therr platform)

- Location — disabled via feature flags on HABITS (`ENABLE_MAP`, `ENABLE_AREAS` off)
- Contacts — disabled via feature flags on HABITS (no `PhoneContacts` flow exposed)
- Microphone audio — not used by HABITS features
- Calendar / health / files outside the photo picker — not used

### Security practices

- ✅ Data encrypted in transit (HTTPS to api.therr.com, WSS to websocket-service.therr.com)
- ✅ Users can request data deletion (existing `DELETE /v1/users/me` flow on users-service)
- ❌ Independent security review — do NOT claim this until one has been performed
- ❌ Adheres to Play Families Policy — do NOT claim this; the app is not designed for under-13 users

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

**Required count:** 2–8 phone screenshots. Plan for 6 to leave one or two as
hold-back if any look weak.

**Capture command:**
```bash
adb -s emulator-5554 exec-out screencap -p > screenshot-NN.png
```

| # | Screen | Why |
|---|---|---|
| 1 | HabitsDashboard with active pact + StreakWidget | Leads with the value prop — "you and your partner are on day N together" |
| 2 | PactDetail showing partner activity feed | Social accountability mechanic in visual form |
| 3 | Check-in modal with photo + note (Phase 4b feature) | Freshest visual; demonstrates daily proof |
| 4 | PactOnboardingGuard empty state | "No pact without a partner" — surfaces the differentiator |
| 5 | Invite flow | Supports the viral mechanic narrative; hints at growth model |
| 6 | HabitsDashboard with multiple active pacts | Teases premium tier (free tier limits to 1) |

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
