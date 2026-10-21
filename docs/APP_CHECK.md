# App Check for verification texts

Added 2026-10-21, after the SMS-pumping incident (~$1,000 of Twilio spend in two days on texts to
Belarus, Egypt and Bolivia). Covers what the gateway does with Firebase App Check, what has to be
configured outside the repo before an app release, and how to revive iOS.

## Why

SMS pumping never runs through the app. Scripts call `POST /v1/phone/register/start` (and
`/auth/start`, `/phone/verify`) directly from rotating residential and VPS addresses, with numbers
they collect a share of the termination fee on. Per-IP limits, per-number limits and country
allowlists all slow it down; none of them can tell a script from a real install. App Check can: a
token is minted on the device by Play Integrity and verified by the gateway against the `therr-app`
Firebase project.

Checking the *text* of each SMS would not help: every pumped message was our own genuine template.
The thing to authenticate is the *request*.

## How the gateway decides

`therr-api-gateway/src/services/phone/appAttestation.ts`, applied in `sendVerificationSms`
(`router.ts`), which every SMS-sending route goes through.

| Lane | When | What may be texted |
|---|---|---|
| **attested** | `x-firebase-appcheck` verifies against `therr-app` | Normal core tier (`DEFAULT_SMS_ALLOWED_REGIONS`), normal limits |
| **unattested** (strict lane) | No token, an expired token, a signing key not yet in the cached key set, or the token could not be checked (Firebase unreachable) | `TWILIO_SMS_UNATTESTED_REGIONS` only (default US, CA), under its own hourly budget (`TWILIO_SMS_UNATTESTED_HOURLY_CAP`, default 10) |
| **forged** | A token that is present and provably not ours (bad signature, other project, garbage) | Nothing — shadow-banned: the route answers as if sent |

Only an *affirmatively* bad token is forged. A Firebase outage therefore degrades real users to
the strict lane rather than shadow-banning them.

The strict lane exists because every build already installed predates App Check, as does iOS. Those
users keep working in the US and Canada; elsewhere they get the existing "region not enabled" error
until they update.

`SMS_APP_CHECK_MODE`:

- `strict-lane` (default) — as above.
- `enforce` — unattested requests are refused with a 400 ("Please update the app…"; not 403, which
  the mobile interceptor treats as a dead session and logs the user out). **Do not use
  while iOS ships without App Attest**: every iOS user would be refused.
- `off` — every request is treated as attested. The kill switch if App Check itself misbehaves.

Every send logs `Sending verification SMS` with `appCheck.attestation`, `appCheck.appId`,
`appCheck.reason` and `sms.tier`. That is the adoption metric for deciding when to enforce.

Verification needs only the project id (`FIREBASE_APP_CHECK_PROJECT_ID`, default `therr-app`): the
token's signature is checked against Firebase's public JWKS. No service-account secret is involved.

## The mobile side

`TherrMobile/main/utilities/appCheck.ts` + a request interceptor in `main/interceptors.ts`.

- A token is fetched **on demand**, only for the three SMS routes (`APP_CHECK_PATHS`), with
  auto-refresh off — so Play Integrity quota is spent a few times per install, not every session.
- Any failure, or more than 5 s waiting, sends the request **without** a token (strict lane) rather
  than blocking sign-in.
- The Firebase modules are required lazily: `@react-native-firebase/app` touches its native module
  at import time and this file sits on every screen's import path.
- `__DEV__` builds use the **debug** provider. The first run logs a debug token in logcat
  (`Enter this debug secret into the allow list in the Firebase Console`); add it under App Check →
  Apps → ⋮ → Manage debug tokens, or set `FIREBASE_APP_CHECK_DEBUG_TOKEN` in the environment of the
  Gradle build. Without it, local sign-in uses the strict lane — fine for US numbers.

## Before the first App Check release (one-time, per Android app)

Both apps live in one Firebase project (`therr-app`): `app.therrmobile` (Therr) and
`com.therr.habits` (Friends with Habits). Do each step for **both**.

1. **Firebase console → Project settings → Your apps → (app) → SHA certificate fingerprints:** add
   the SHA-256 of the **app signing key** from Play Console → Test and release → App integrity → App
   signing. (Play re-signs every release with that key; the upload key is not what devices run.)
2. **Firebase console → App Check → Apps → (app) → Play Integrity → Register.**
3. **Play Console → (app) → Test and release → App integrity → Play Integrity API → Link a Cloud
   project** → `therr-app`. In Google Cloud console for `therr-app`, confirm **Play Integrity API** is
   enabled.
4. **Leave App Check enforcement OFF for every Firebase product** (App Check → APIs). Enforcing
   Firebase Authentication would break sign-in on every build that predates App Check.

Without steps 1–3, tokens fail on the device and every user of the new build lands in the strict
lane. Nothing errors visibly; it shows only as `appCheck.attestation=unattested` with a current
`x-app-version`.

Builds that were not installed from Play (a locally built release APK, sideloaded) fail Play
Integrity and get the strict lane. Internal testing track installs come from Play and attest.

## Release checklist (each Android release that first ships App Check)

- [ ] Console steps above done for this app's package.
- [ ] `TherrMobile/package.json` carries `@react-native-firebase/app-check` at the **same version** as
      `@react-native-firebase/app` (RNFirebase requires matching versions; `npm --prefix TherrMobile ls
      @react-native-firebase/app-check`).
- [ ] Native rebuild: this is a native module, so it ships only in a new binary — never via an OTA/JS
      update. `npm run android:clean` before the first local build.
- [ ] Niche branch: `general` merged into `niche/<TAG>-general` after this lands, then
      `/split-branch-prs verify-brand`.
- [ ] `/mobile-release-preflight`.
- [ ] After rollout, on a Play-installed build: request a sign-up code to a **non-US** number you
      own. It arrives only if the request attested (the strict lane would refuse that region), and the
      gateway logs `appCheck.attestation=attested` with this app's `appCheck.appId`.

## Reviving iOS (App Attest)

iOS currently sends no token on purpose (`Platform.OS !== 'android'` in `appCheck.ts`), so it lives
in the strict lane. Before an iOS release that should attest:

1. **Apple Developer → Identifiers → (each bundle id) → enable App Attest.** Regenerate and download
   the provisioning profiles (EAS: `eas credentials`), or the build fails to sign.
2. **Xcode → target → Signing & Capabilities → + Capability → App Attest.** This adds
   `com.apple.developer.devicecheck.appattest-environment` to the entitlements file; set it to
   `production` for release configurations (`development` tokens are rejected by Firebase in prod).
3. **Firebase console → App Check → Apps → (iOS app) → App Attest → Register**, with the Apple Team
   ID. Also register **DeviceCheck** (needs a DeviceCheck `.p8` key from Apple Developer → Keys) —
   App Attest is unavailable on some devices and the fallback needs it.
4. **`TherrMobile/main/utilities/appCheck.ts`:** add
   `apple: { provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback' }` to
   `provider.configure`, and remove the iOS early return in `getAppCheckToken` (and its test).
5. `npm run ios:pod:install` — the `RNFBAppCheck` pod is already in the dependency graph once
   `@react-native-firebase/app-check` is installed; the first pod install after this change adds it.
6. Verify on a TestFlight build the same way as Android (non-US code arrives; `attested` in the log).
7. Only after iOS attests may `SMS_APP_CHECK_MODE=enforce` be considered.

## Related

- `therr-public-library/therr-js-utilities/src/sms-destination-policy.ts` — country tiers, including
  `DEFAULT_SMS_UNATTESTED_REGIONS`. Twilio Messaging Geo Permissions must match the core tier.
- `therr-api-gateway/src/services/phone/verificationCodes.ts` — per-number, global, extended and
  unattested hourly budgets.
- `therr-api-gateway/src/services/phone/smsSenderFlagging.ts` — per-client shadow-banning.
- `docs/WORK_IN_PROGRESS.md` → "App Check for verification texts" — the open operational steps.
