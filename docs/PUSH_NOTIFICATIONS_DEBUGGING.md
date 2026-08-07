# Debugging push notifications

How to find out *why* a push didn't arrive, rather than guessing.

Read this before changing Firebase configuration. The most common instinct —
"our Firebase setup must be wrong, let's make a new project" — is usually the
wrong move, and § Do we need a separate Firebase project? explains why.

## Link 0: did anything actually try to send?

Before debugging delivery, rule this out — on HABITS it is the most likely
answer, and it looks identical to a broken pipeline.

**A solo tester with no pact partner can trigger almost nothing.** Every HABITS
notification needs either a second human or the daily digest:

| Type | Goes to | Triggered by |
|---|---|---|
| `streakMilestone` | yourself | a check-in landing on **exactly** 3, 7, 14, 30, 60, 90, 180 or 365 consecutive days (`STREAK_MILESTONES`) — so day 3 at the earliest, on 3 separate calendar days |
| `leaderboardRankMilestone` | yourself | weekly rank crossing a milestone |
| `partnerCheckedIn`, `partnerMissedDay` | pact partners | someone *else* acting |
| `pactInvitation`, `pactAccepted`, `pactDeclined`, `pactNudge` | the other party | someone *else* acting |
| `streakAtRisk`, `partnerMissedDay`, `pactExpiring` | members | the **daily digest only** — and it iterates `activePacts`, so no pact means no sends at all |

So on a fresh single-user account with no pact: check in once, twice — nothing
fires. That is correct behavior, not a bug.

The digest (`POST /v1/habits/pacts/digest/run-daily`) is not on a k8s CronJob;
it is called by the `therr-messaging-automator` Cloud Function via Cloud
Scheduler, over the internal LB (see `k8s/prod/users-service-network-policy.yaml`).
It is deliberately unreachable from the public internet, and has **no
server-side dedup** — a second trigger path re-sends every notification.

### Types with no sender at all

These have copy in all three locales, channel routing, brand intent actions and
tests — and **nothing in this repo ever sends them**:

`dailyHabitReminder`, `morningMotivation`, `eveningCheckIn`, `streakBroken`,
`newPersonalRecord`, `partnerCelebrated`, `pactCompleted`

They are not scheduled locally on-device either (`sendTriggerNotification` is
used only by Moments and Events). If you expected a daily habit reminder, that
loop is not wired up — the delivery half exists and the trigger half does not.
Verify with:

```bash
grep -rn "Types.dailyHabitReminder" --include=*.ts therr-services/ | grep -v push-notifications-service
```

## The delivery chain

A push crosses five links. Only one of them used to produce any signal.

| # | Link | Fails when | Observable? |
|---|---|---|---|
| 1 | OS permission granted, FCM issues a device token | user denied notifications; `getToken` threw | device-side only (`NOTIFICATIONS_ERROR` in logs / Crashlytics) |
| 2 | Token reaches `main.userDeviceTokens` **under the right brand** | `x-brand-variation` mismatch; the fire-and-forget upsert failed | ✅ `GET /users/:id/push-diagnostics` |
| 3 | push-notifications-service resolves the brand to a Firebase app | brand's credential env var unset or wrong project | ✅ `GET /notifications/diagnostics` |
| 4 | FCM accepts the message | stale token; credentials address another project | ✅ `POST /notifications/diagnostics/send-test` |
| 5 | APNS / Android accepts it and the device renders it | **`apns-topic` ≠ the app's bundle id**; missing Android channel | ⚠️ never reported — see below |

**Link 5 is the trap.** APNS silently discards a push whose `apns-topic` is not
the receiving app's own bundle id. FCM still accepts the send, `messaging.send()`
still resolves with a message id, and the service still logs
`Push successfully sent`. Every signal says delivered; the user gets nothing.
This exact bug shipped: HABITS pushes were addressed to `com.therr.mobile.habits`,
a bundle id no Xcode target builds.

`predictAndSendNotification` also catches every error by design, so a bad token
can't fail a user-facing request. Good for production, useless for debugging —
which is what the diagnostics endpoints below are for.

## Endpoints

All are `SUPER_ADMIN`-only at the gateway, and available in production (unlike
`/notifications/test`, which is compiled out when `NODE_ENV === 'production'` —
precisely the environment where delivery problems live).

### 1. Is the device registered, and under which brand?

```bash
curl -sS "https://api.therr.com/v1/users-service/users/$USER_ID/push-diagnostics" \
  -H "authorization: Bearer $TOKEN" \
  -H "x-brand-variation: habits" | jq
```

```jsonc
{
  "requestedBrand": "habits",
  "isRegisteredForRequestedBrand": false,   // ← the smoking gun
  "brandsRegistered": ["therr"],
  "deviceTokens": [
    { "brandVariation": "therr", "platform": "mobile",
      "updatedAt": "2026-08-01T...", "token": { "prefix": "eGEh3WckRjy", "length": 163 } }
  ],
  "legacy": { "hasDeviceMobileFirebaseToken": true, "token": { "prefix": "eGEh3WckRjy", "length": 163 } }
}
```

Reads across brands on purpose: a brand-scoped read returns empty for both a
wrong-brand registration and no registration at all, which are very different
problems. Token values are never returned, only a prefix and length — enough to
confirm the row matches the handset in front of you.

- `brandsRegistered: []` → link 1 or 2. The app never registered. Check OS
  permission and `registerDeviceForFCM` in `TherrMobile/main/components/Layout.tsx`.
- `isRegisteredForRequestedBrand: false` with rows present → the build's
  `CURRENT_BRAND_VARIATION` disagrees with the brand doing the sending.
- Rows present and correct → move to link 3.

### 2. Where do this brand's pushes actually go?

```bash
curl -sS "https://api.therr.com/v1/push-notifications-service/notifications/diagnostics" \
  -H "authorization: Bearer $TOKEN" -H "x-brand-variation: habits" | jq
```

```jsonc
{
  "distinctFirebaseProjects": ["therr-app"],
  "byBrand": [
    { "brandVariation": "habits",
      "credentialEnvKey": "PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_HABITS",
      "isCredentialEnvKeySet": false,
      "isFallbackToTherr": true,        // expected on a shared project
      "firebaseProjectId": "therr-app",
      "iosApnsTopic": "com.therr.mobile.Therr",
      "androidAccentColor": "#1C7F8A" }
  ]
}
```

`isFallbackToTherr: true` is **not an error** while all brands share one Firebase
project — see below. `iosApnsTopic` is the field that silently breaks link 5:
it must equal the `PRODUCT_BUNDLE_IDENTIFIER` of the build receiving the push.

### 3. Send a real test push

This is the fastest way to separate "delivery is broken" from "nothing ever
fired" — it bypasses every trigger condition above and puts a real notification
on the handset.

`dryRun` defaults to `true`: FCM validates the token and credentials without
delivering. Set it to `false` once the dry run is clean and you want the handset
to buzz.

**By user id** (resolves the device token server-side — no adb, no token
wrangling; this is the one to reach for):

```bash
curl -sS -X POST \
  "https://api.therr.com/v1/users-service/users/$USER_ID/push-diagnostics/send-test" \
  -H "authorization: Bearer $TOKEN" \
  -H "x-brand-variation: habits" \
  -H "content-type: application/json" \
  -d '{"type":"pact-invitation","dryRun":false}' | jq
```

A `{"sent": false, "reason": "no-device-token"}` response *is* the diagnosis:
the app never completed FCM registration for that brand. It resolves the token
through the same `resolveDeviceTokenForBrand` the real notification path uses,
so a token this can't find is one production can't find either.

**By raw token**, when a user has several devices and you need a specific one:

```bash
curl -sS -X POST \
  "https://api.therr.com/v1/push-notifications-service/notifications/diagnostics/send-test" \
  -H "authorization: Bearer $TOKEN" \
  -H "x-brand-variation: habits" \
  -H "content-type: application/json" \
  -d '{"deviceToken":"'"$DEVICE_TOKEN"'","type":"pact-invitation","dryRun":false}' | jq
```

The response echoes the full envelope (minus the token) plus the raw FCM result.
Error codes worth knowing:

| `result.errorCode` | Means |
|---|---|
| `messaging/registration-token-not-registered` | Token is stale — app reinstalled or data cleared. Re-open the app to re-register. |
| `messaging/invalid-registration-token`, `messaging/invalid-argument` | Malformed token. Usually a truncated copy-paste. |
| `messaging/mismatched-credential` | **The service account belongs to a different Firebase project than the token.** This is what a premature project split produces. |
| `messaging/third-party-auth-error` | Firebase has no APNS auth key for this iOS app, or the key is expired. |

An `ok: true` result only proves FCM accepted the message. If the handset still
shows nothing, you are at link 5: compare `routing.iosApnsTopic` against the
installed build's bundle id.

### Convenience script

`_bin/push-debug.sh` chains all three:

```bash
./_bin/push-debug.sh --user <userId> --brand habits --token "$JWT"           # inspect only
./_bin/push-debug.sh --user <userId> --brand habits --token "$JWT" --send    # deliver for real
```

## Do we need a separate Firebase project per brand?

**No — and splitting today would break push rather than fix it.**

One Firebase project hosts many apps. `therr-app` already contains a separate
app entry per `package_name` / bundle id, which is the supported multi-app
setup and what `_bin/firebase/README.md` documents.

The mechanics that matter:

- **An FCM token identifies an app instance.** `messaging().send({ token })`
  routes by the token itself; there is no per-brand addressing to get wrong.
- **A service account is scoped to its project, and can address every app in
  it.** One credential correctly delivers to Therr and Habits alike.
- **`isFallbackToTherr: true` is therefore correct**, not a degradation. A brand
  without its own `PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_<BRAND>` uses the
  Therr service account, which already has authority over the Habits app because
  they live in the same project.

Splitting Habits into its own project makes the Therr service account a stranger
to Habits tokens. Every send then fails with `messaging/mismatched-credential` —
and worse, `isInvalidTokenError` treats some of those failures as a dead token
and **deletes the user's registration**, so recovery needs every user to reopen
the app. It only becomes safe once
`PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_HABITS` holds a service account
from the new project *and* every device has re-registered against a build
carrying the new `google-services.json`.

Reasons that would genuinely justify a split — none of which is "pushes aren't
arriving":

- Analytics/Crashlytics data must be separated for legal or reporting reasons.
- The apps need different Google Sign-In OAuth consent screens.
- A brand is being sold or spun out.

The migration procedure lives in `docs/MULTI_BRAND_ARCHITECTURE.md`
→ "Migration path: when to split into per-brand Firebase projects".

### What *is* worth checking in Firebase Console

Within the single shared project:

- The **APNS auth key** is uploaded for the iOS app (Project Settings → Cloud
  Messaging → iOS app). Missing or expired ⇒ `messaging/third-party-auth-error`.
- The **Android app entry exists** for each `applicationId`
  (`app.therrmobile`, `com.therr.habits`) and the SHA-1 fingerprints are
  registered — see `_bin/firebase/README.md`.

## Platform notes

**Android** is unaffected by the `apns-topic` class of bug entirely — it ignores
the `apns` block. Its own link-5 failure modes, and where each is handled:

| Requirement | Where | Status |
|---|---|---|
| `POST_NOTIFICATIONS` declared and requested (API 33+) | `AndroidManifest.xml`; `requestNotificationsOS()` in `permissionsOrchestrator.ts` | wired |
| Channels exist before a display push names one | `createAndroidNotificationChannels()` at app start | wired |
| `ic_notification_icon` drawable present | `res/drawable-*/` (all densities) | present |
| Data-only pushes converted to a visible notification | `setBackgroundMessageHandler` in `TherrMobile/index.js` | wired |
| Fallback channel for pushes naming an unknown channel | `default_notification_channel_id` = `reminders` | wired |

So when nothing arrives on Android, suspect link 0 (nothing fired) or link 2
(token filed under the wrong brand) before suspecting delivery. Confirm with a
`send-test` — if the handset buzzes, delivery is fine and the question is what
was supposed to trigger.

Two things `send-test` cannot rule out, both user-side: notifications disabled
for the app or for one channel in Android Settings (a channel's importance is
locked at first creation and only the user can raise it afterwards), and
aggressive OEM battery optimization on Samsung/Xiaomi/OnePlus, which can delay
or drop FCM for a backgrounded app.

## Known sharp edges

- **A niche brand with no iOS target runs as the Therr binary.** `niche/*`
  branches change `brandConfig.ts`, `app.json` and `build.gradle`; they do not
  change `PRODUCT_BUNDLE_IDENTIFIER`. So an iOS Habits build *is*
  `com.therr.mobile.Therr` and its pushes must be addressed there. This is
  pinned by `apns-topic matches a shipped iOS target` in
  `push-notifications-service/tests/unit/api/brandRouting.test.ts`, which reads
  the Xcode project and fails if any brand's topic isn't a bundle id something
  actually builds. Change the topic in the same commit that adds the iOS target.
- **Android channels must exist before a display notification names one.**
  `createAndroidNotificationChannels()` registers them at app start; without it
  the OS drops the notification onto an auto-created "Miscellaneous" channel at
  DEFAULT importance (no heads-up banner). See
  `TherrMobile/main/utilities/pushNotifications.ts`.
- **`getCredentialEnvKey` uppercases the brand but does not replace hyphens**,
  so `appy-social` maps to `..._APPY-SOCIAL` — not a settable env var name in
  most shells or in Kubernetes. Harmless today (those brands ship no app and
  correctly fall back), but it must be fixed before any hyphenated brand gets
  its own Firebase project.
