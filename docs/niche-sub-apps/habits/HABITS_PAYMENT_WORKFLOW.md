# HABITS — Payment Workflow Plan

**Status:** Not yet implemented (Phase 4 of HABITS_PROJECT_BRIEF.md)
**Owner:** Solo founder
**Last Updated:** 2026-05

> **Why this doc exists:** Phase 4 of the HABITS roadmap calls for monetization
> via a $6.99/mo premium tier. The free-tier *gate* (HABITS_FREE_PACT_LIMIT,
> default 5; pact-create returns HTTP 402 when exceeded) shipped first so the
> server-side enforcement is in place. The actual purchase flow is below — it
> needs to be built before the gate value is reduced to 1 (per the project
> brief target).

---

## Strategy: web-based purchase, deeplink back to mobile

To avoid Apple's 30% in-app purchase tax (and Google's 15-30%), HABITS will
sell the premium subscription on **the HABITS web app** (`habits.therr.com`)
rather than via App Store / Play Store IAP. Mobile users tap "Upgrade" → we
open the web checkout URL in the system browser → they pay via Stripe → we
mark the user premium → they return to the app and the paywall lifts.

This is **legal and explicitly allowed** under Apple's App Review
Guidelines 3.1.3(b) "reader" / "multiplatform service" provisions, but
critically: the mobile app **must not advertise, link to, or even imply**
the existence of an external purchase mechanism. The cleanest pattern is:

- Mobile shows the paywall ("Upgrade for unlimited pacts")
- The CTA opens an external browser (Linking.openURL) to a URL that does NOT
  appear in the app binary at submission time. Configure it via remote config
  or env variable so the literal string is fetched at runtime.
- The web checkout page is the only thing that knows the price ($6.99/mo).

A safer alternative that requires no obfuscation is to use Apple's
**External Link Account** entitlement (US/EU only). Either path works; pick
based on regulatory comfort.

---

## Components needed

### 1. Stripe products + webhooks (backend)

- Stripe Product: "Friends with Habits Premium", recurring monthly at $6.99
  USD with localized prices for ES/CA per Stripe's automatic FX.
- New `users-service` handler: `/payments/webhook` already exists for the
  Therr B2B subscriptions. Add a switch for the HABITS Premium product:
  - `customer.subscription.created` / `.updated` with `status='active'` →
    add `AccessLevels.HABITS_PREMIUM` to the user's `accessLevels`.
  - `customer.subscription.deleted` / `status='past_due'` → remove
    `HABITS_PREMIUM`.
  - Verify webhook signature (`stripe.webhooks.constructEvent`) with the
    secret from env. The current Stripe webhook secret env var is reused —
    no new infra needed.
- Map the user to a Stripe customer via the existing `stripeCustomerId` field
  on `main.users`. Create the customer at first checkout if absent.

### 2. Web checkout page (`habits.therr.com`)

- New SSR route in `therr-client-web` (or a HABITS-only carve-out if web is
  fully brand-isolated): `/habits/upgrade?userId=<id>&token=<short-lived>`.
  - The `userId` + `token` come from the mobile app via deeplink — token is a
    short-lived JWT (5-minute TTL) signed with a server secret, asserting
    that the requester is the authenticated user.
  - The page renders Stripe's hosted Checkout (`mode: 'subscription'`) and
    pre-fills the customer email.
  - On success, Stripe redirects to `/habits/upgrade/success?session_id=...`
    which closes itself and pings a deeplink back to the app
    (`habits://upgrade-complete`) so the mobile UI can refresh user state.

### 3. Mobile: paywall UI + deeplink trigger

- New screen `TherrMobile/main/routes/Habits/UpgradePaywall.tsx`. Shows the
  benefits (Unlimited pacts, Video proof, Custom consequences, Analytics,
  Health integrations), tap "Continue" → opens external browser via
  `Linking.openURL(getUpgradeUrl(user))` where `getUpgradeUrl` reads from
  env-config and appends a short-lived JWT.
- Wire the paywall as the response handler for HTTP 402 from
  `Pacts.create`. The 402 already includes `upgradeRequired: true` and
  `limit` so the screen renders the right copy.
- On `habits://upgrade-complete` deeplink, call
  `UserActions.refreshUserDetails` to pull the fresh `accessLevels`.

### 4. Premium feature gating (mobile + backend)

The `PREMIUM_*` flags in `FeatureFlags.ts` are the source of truth. The
mobile FeatureFlagContext should AND the flag with
`user.details.accessLevels.includes(AccessLevels.HABITS_PREMIUM)`. Backend
handlers for premium-only features (video proof upload, analytics endpoint,
custom consequences) check the same access level. Examples:
- `PREMIUM_VIDEO_PROOF` — gates the video upload flow in `EditCheckin`
- `PREMIUM_ANALYTICS` — gates `/streaks/:userId/analytics`
- `PREMIUM_CUSTOM_CONSEQUENCES` — gates non-default consequence types in
  `validatePactParams`
- `PREMIUM_HEALTH_INTEGRATIONS` — gates Apple Health / Google Fit settings
- `PREMIUM_UNLIMITED_PACTS` — already wired via `isPactCapExempt` in
  `pacts.ts` reading `accessLevels.includes(HABITS_PREMIUM)`

---

## Order of implementation

1. Stripe Product + webhook handler + `HABITS_PREMIUM` access level write
   path. Test end-to-end in stripe CLI.
2. Web checkout page on `habits.therr.com`. Manual test: paste userId+token
   into the URL, complete checkout, verify access level updates.
3. Mobile paywall UI + 402 response handling.
4. Reduce `HABITS_FREE_PACT_LIMIT` env var from 5 → 1. No code change
   needed; just bump the env var on prod after #1-3 are stable.
5. Wire individual `PREMIUM_*` flags into the corresponding feature
   gates as those features are built.

---

## Testing

- Stripe test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 9995`
  (card declined) — these come from Stripe's standard test card list.
- Webhook end-to-end: `stripe trigger customer.subscription.created` against
  a test secret pointed at the local users-service.
- Mobile + web deeplink: requires manual round-trip on a real device because
  `habits://` URI scheme registration is build-time on iOS.
- Gate enforcement: create N pacts as a free-tier test user (N =
  HABITS_FREE_PACT_LIMIT); verify the (N+1)th request returns 402 with the
  `upgradeRequired: true` flag.

---

## Open questions (decide before building)

- **Annual plan?** $6.99/mo × 12 = $83.88; competitors like Habitify charge
  $39.99/yr ($3.33/mo effective). Adding an annual tier at ~$59.99/yr would
  match Streaks/Way of Life economics.
- **Free trial?** Stripe supports `trial_period_days: 7` natively. Worth
  testing — many habit apps see meaningful conversion uplift from a trial
  vs. paywall.
- **Gift / family plan?** Out of scope for Phase 4 launch.

---

## References

- `docs/niche-sub-apps/HABITS_PROJECT_BRIEF.md` § Phase 4
- `docs/niche-sub-apps/HABITS_PROJECT_BRIEF.md` § Revenue Model & Projections
- `therr-public-library/therr-js-utilities/src/constants/enums/FeatureFlags.ts`
  — `HABITS_FREE_PACT_LIMIT`, `PREMIUM_*` flags
- `therr-public-library/therr-js-utilities/src/constants/enums/AccessLevels.ts`
  — `HABITS_PREMIUM`
- `therr-services/users-service/src/handlers/pacts.ts` — `isPactCapExempt`,
  the 402 response shape
- Apple guideline 3.1.3 — multiplatform / external link entitlement
