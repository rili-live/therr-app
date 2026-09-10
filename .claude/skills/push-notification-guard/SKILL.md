---
name: push-notification-guard
description: Guard rail for any change touching push notifications in the multi-brand app family — adding or retargeting a notification type, adding a producer, changing device-token routing, or standing up a new niche app's pushes. Cross-references the ten places a type must be registered, catches the brand-routing failures that deliver to the wrong app, and enforces the general/niche branch split that leaves push half-wired. Every check maps to a failure that has already shipped and produced no error anywhere.
user-invocable: true
allowed-tools: Bash(git*), Bash(node*), Bash(npm*), Bash(npx*), Bash(grep*), Bash(ls*), Bash(./_bin/*), Read, Glob, Grep, Edit
argument-hint: [--type <notificationType>] [--brand <brand>] [--new-brand <BRAND>] [--audit] [--dry-run]
---

# Push Notification Guard

Push is the only subsystem here where **every** link fails silently. FCM accepts
the send, `messaging.send()` resolves with a message id, the service logs
`Push successfully sent`, the queue row goes to `sent` — and the user gets
nothing, or gets it in the wrong app. There is no exception to this: not one of
the failures below produced a stack trace, a non-2xx, or a failed test.

Three weeks of the August 2026 outage passed with every signal green.

Run this skill when a change touches any of:

- `therr-services/push-notifications-service/**`
- `therr-public-library/therr-js-utilities/src/constants/enums/PushNotifications.ts` or `Branding.ts`
- `therr-services/users-service/src/utilities/{sendEmailAndOrPushNotification,syncDeviceTokenForBrand,enqueueNotification,notificationQueueWorker}.ts`
- `TherrMobile/index.js`, `TherrMobile/main/components/Layout.tsx`, `TherrMobile/main/constants/index.tsx`
- `TherrMobile/android/app/src/main/AndroidManifest.xml`, `build.gradle`, `google-services.json`
- any new producer that sends a notification

**Arguments.** `--type <t>` audit one notification type end to end. `--brand <b>`
scope to one brand. `--new-brand <TAG>` run the new-niche-app checklist (§ 5).
`--audit` sweep everything, ignoring the diff. `--dry-run` report only.

---

## Step 0: Run the wiring checker first

It does the mechanical cross-referencing in one pass and tells you which of the
sections below you actually need.

```bash
node .claude/skills/push-notification-guard/scripts/check-push-wiring.js
```

The native half of push wiring lives on the brand's own branch, so also run it
against every shipping niche branch — a type wired on `general` is still
half-wired until the niche app's manifest declares its intent action:

```bash
node .claude/skills/push-notification-guard/scripts/check-push-wiring.js --brand-branch niche/HABITS-general
```

`--json` for machine output. Exit code 1 on any BLOCKER. What it checks, and the
failure each check prevents:

| Check | Silent failure it catches |
|---|---|
| brand intent-action enums cover the same keys | tap does nothing on one brand, works on another |
| AndroidManifest declares every action the server sends | tap is a no-op; nothing logged, anywhere |
| `createMessage` cases ↔ `SENDABLE_NOTIFICATION_TYPES` | message is built and then dropped |
| every `translate()` key exists in all 3 locales | the raw key path renders as the push body |
| every `iosApnsTopic` is a bundle id an Xcode target builds | APNS discards the push; FCM still returns a message id |
| every `BrandVariations` value has a `BRAND_APP_IDENTITIES` row | brand silently inherits Therr's identity |
| `Layout.tsx` names every brand | tap falls through to Therr's action strings and dead-ends |
| server `channelId`s exist on the client | Android posts on "Miscellaneous" at DEFAULT importance |
| data-only keys are bucketed into a channel | notification arrives with no heads-up banner |
| `dedupeKey` contains no clock or random value | dedup silently off; duplicate sends |

It does **not** check: whether a producer forwards `x-brand-variation` (§ 4),
whether the sibling automator agrees (§ 6), or anything about real delivery (§ 7).

---

## Step 1: Establish the delivery chain and where the change sits

A push crosses five links. Name which one the change touches before reasoning
about it — the debugging in `docs/PUSH_NOTIFICATIONS_DEBUGGING.md` is organized
the same way.

| # | Link | Owner | Observable? |
|---|---|---|---|
| 1 | OS permission + FCM issues a device token | `TherrMobile` | device-side only |
| 2 | Token reaches `main.userDeviceTokens` **under the right brand and platform** | users-service | `GET /users/:id/push-diagnostics` |
| 3 | Brand resolves to a Firebase app | push-notifications-service | `GET /notifications/diagnostics` |
| 4 | FCM accepts the message | push-notifications-service | `POST /notifications/diagnostics/send-test` |
| 5 | APNS / Android accepts it and the device renders and routes it | native | **never reported** |

Link 5 is the trap and always has been. Nothing server-side can confirm it; only
a handset can.

---

## Step 2: The thing that makes this multi-brand problem different

**`brandVariation` selects the device token, not just the copy.**

A user who holds both Therr and Friends with Habits has two FCM tokens — one per
install — stored as separate rows in `main.userDeviceTokens`, keyed
`UNIQUE (userId, brandVariation, platform)`. `resolveDeviceTokenForBrand` picks
the row by brand.

So a wrong or missing brand is not a cosmetic problem. It addresses the push to
a *different application on the same handset*. The Habits streak reminder renders
in Therr, under Therr's name and icon, on an app with no habits surface — and the
Habits app gets nothing.

Three ways the brand goes wrong, all of which have happened:

1. **The producer never sent `x-brand-variation`.** The gateway forwards the
   header as `''` when absent (`handleServiceRequest.ts`) and `getBrandContext`
   then defaults to `THERR`. Nothing errors.
2. **Empty brand hits the legacy fallback.** `resolveDeviceTokenForBrand` returns
   `users.deviceMobileFirebaseToken` — a single shared column that *whichever
   branded app opened last* overwrites — when `brand` is falsy. It now warns; it
   still falls back, deliberately, because single-brand legacy users have no
   brand-scoped row at all.
3. **The app never wrote its brand-scoped row.** Registration used to be guarded
   on the legacy shared column, which says nothing about whether *this* brand is
   registered. `registerDeviceForFCM` is now unconditional per app session for
   exactly that reason — **do not reintroduce a guard on it.** A stale
   redux-persisted `user` slice made the old bug survive app-store updates.

**If you are adding a type that only one brand's app can render, it must be
listed in `HABITS_ONLY_TYPES` (or its per-brand equivalent).** Blocking is
correct even though it means the user gets nothing: delivering to the wrong app
is worse than not delivering, and the block turns a silent misdelivery into a
`notification-type-not-routed-for-brand` result you can grep for.

---

## Step 3: Adding or changing a notification type

A type is wired only when **all** of these are true. The checker verifies the
starred ones; the rest need eyes.

| # | Where | File |
|---|---|---|
| 1 | `PushNotifications.Types` member | `therr-js-utilities/.../enums/PushNotifications.ts` |
| 2 | `IntentActionKey` union entry ★ | same file |
| 3 | The key in **every** brand's `*AndroidIntentActions` enum that can receive it ★ | same file |
| 4 | `<intent-filter>` in `AndroidManifest.xml` **on each brand's branch** ★ | `TherrMobile/android/app/src/main/AndroidManifest.xml` |
| 5 | `createMessage` case ★ | `push-notifications-service/src/api/firebaseAdmin.ts` |
| 6 | `SENDABLE_NOTIFICATION_TYPES` entry ★ | same file |
| 7 | Brand-restriction decision: `HABITS_ONLY_TYPES` and/or `BRAND_EXCLUDED_NOTIFICATION_TYPES` | same file |
| 8 | Copy in `en-us`, `es`, `fr-ca` ★ | `push-notifications-service/src/locales/*/dictionary.json` |
| 9 | Channel: `channelId` (display) or `REMINDER_ACTION_KEYS`/`REWARD_ACTION_KEYS` (data-only) ★ | `TherrMobile/main/constants/index.tsx` |
| 10 | Tap routing | `TherrMobile/main/components/Layout.tsx` (display) / `TherrMobile/index.js` (data-only) |
| 11 | `Notifications.Types` + `MessageKeys` — only if it also creates an in-app notification | `therr-js-utilities/.../enums/Notifications.ts` |
| 12 | A producer that actually sends it | see § 4 |
| 13 | A case in `brandRouting.test.ts` (it walks every type; a new case with no argument fails there) | `push-notifications-service/tests/unit/api/` |

### Display vs data-only is a behavioural fork, not a style choice

- **Display** (`createNotificationMessage`) — the OS renders it, no JS runs. It
  names a `channelId` in the FCM payload; if that channel does not exist on the
  device the OS posts on the SDK's "Miscellaneous" channel at DEFAULT importance,
  with a name the user cannot recognise. It sets no `apns` block. It **cannot**
  show action buttons.
- **Data-only** (`createDataOnlyMessage`) — Notifee renders it, so it can carry
  action buttons, and it sets `apns-topic`, which is where the iOS bug lived. Its
  channel comes from the `clickActionId` suffix via
  `getAndroidChannelFromClickActionId`, **not** from `channelId`.

> **Moving a type between the two is a deploy-ordering hazard.** An installed app
> that doesn't yet know the intent key posts a newly-data-only notification on the
> default channel. The mobile release must ship first. `dailyHabitReminder` moved
> this way and carries that note.

### Payload discipline

FCM's `data` map is `string -> string`, and `firebase-admin` throws
`data must only contain string values` client-side for any non-string — including
`undefined` from an unset optional field. `predictAndSendNotification` swallows
the throw, the route still answered 201, and the queue recorded `sent`: **77
pushes were discarded that way in one 30-day window against 19 that went out.**
`createMessage` now drops nullish and coerces the rest; keep it that way, and
promote any field the client needs into the data map (a value used only to render
the body is dropped, which is why taps could only ever open a list).

---

## Step 4: Producers

Every producer must satisfy all four:

1. **Forwards a non-empty `x-brand-variation`.** Hard-pin it where the brand is
   known (`habitsDigest` pins `BrandVariations.HABITS`); otherwise carry the
   caller's header through. This is not type-checked — an empty string compiles.
2. **Queues rather than sends inline**, unless the notification is immediate
   feedback the recipient is actively watching for. `enqueueNotification` buys
   dedup, `scheduledFor`, and the 5-per-user-per-day cap.
   See `docs/NOTIFICATION_QUEUE_DESIGN.md`.
3. **`dedupeKey` is period-stamped and deterministic.** `streak-at-risk:<pactId>:2026-08-08`.
   Never `Date.now()`, never a random value, never a uuid — that makes every
   enqueue unique and silently disables the `UNIQUE (brandVariation, userId, dedupeKey)`
   constraint that *is* the dedup mechanism.
4. **Rolls up per user, not per entity.** The worker drains a claimed batch in one
   30s tick, so a row per habit *and* per pact became five near-identical pushes
   in the same second, and then hit the 5/day cap and dropped everything timely
   for the rest of the day. One notification per user per period.

Also check: `enqueueNotification` returns `'queued' | 'duplicate' | 'failed'` —
count `failed` as an error, never as a dedup. Collapsing them made a total queue
outage look identical to a healthy second run.

---

## Step 5: Standing up a new niche app's push notifications

This is the highest-risk path, and today's code is shaped around exactly two
niche brands. Work through all of it.

**What the compiler catches for you:** adding a value to `BrandVariations` makes
`BRAND_APP_IDENTITIES` fail to compile (`Record<BrandVariations, …>`), and
`brandVariation` is a required argument on both message builders. That is the
whole of the automatic protection.

**What you must do by hand:**

1. **`BRAND_APP_IDENTITIES` row.** Three fields, each of which fails invisibly:
   - `iosApnsTopic` — **must be a `PRODUCT_BUNDLE_IDENTIFIER` some iOS target
     actually builds.** A niche branch changes `brandConfig.ts`, `app.json` and
     `build.gradle` but never `PRODUCT_BUNDLE_IDENTIFIER`, so a niche iOS build
     *is* the Therr binary running the brand's JS, and its tokens belong to
     `com.therr.mobile.Therr`. Use `THERR_IOS_BUNDLE_ID` unless and until the
     brand ships its own iOS target — and change it in the same commit that adds
     the target.
   - `accentColor` — Android small-icon tint.
   - `intentActions` — the brand's own enum.
2. **A `<Brand>AndroidIntentActions` enum**, prefixed from the brand's *Android*
   `applicationId`, plus its entry in the `AndroidIntentActions` map. A prefix
   shared with another brand means Android can route a tap to either app.
3. **`Layout.tsx` brand → intent-actions selection.** Today a hardcoded ternary
   chain. **A brand it does not name falls through to Therr's enum, never matches
   its own action strings, and every notification tap opens nothing.** Prefer
   replacing the chain with a lookup keyed on `CURRENT_BRAND_VARIATION`.
4. **Generalise the brand-restriction lists.** `isTypeAllowedForBrand` hardcodes
   `HABITS_ONLY_TYPES` and `!== BrandVariations.HABITS`. With a second niche app
   that shape is wrong in both directions: the new brand's types are routable
   under Therr *and* under Habits, and Habits' types are routable under the new
   brand. Convert to `Record<BrandVariations, Set<Types>>` — one set of
   brand-owned types, one set of brand-excluded types — before the second niche
   app ships a single type of its own.
5. **`BRAND_EXCLUDED_NOTIFICATION_TYPES` for the new brand.** Therr's
   map/moment/space retention copy is off-brand advertising in a niche app, and
   the sibling automator that sends it has no notion of on-brand copy.
6. **Native, on the niche branch:** `notificationActionPrefixByAppId` in
   `build.gradle`, the `${notificationActionPrefix}` intent filters in
   `AndroidManifest.xml`, and a `google-services.json` containing the new
   `applicationId`. Register Android channels at app start — a channel created
   lazily locks its importance at the wrong value.
7. **Firebase credentials.** Every brand is an **app inside the single shared
   `therr-app` Firebase project**, so the THERR service account addresses all of
   them and the fallback is correct, not a degradation. Only add
   `PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_<BRAND_UPPER>` if the brand
   genuinely moves to its own project. **Do not create a new Firebase project to
   fix undelivered pushes** — see `docs/PUSH_NOTIFICATIONS_DEBUGGING.md`.
8. **Sibling repo** — see § 6. Nothing in CI checks it.

No migration is needed: `main.userDeviceTokens` and `main.notificationQueue` are
brand-scoped by column. But `notificationQueue.brandVariation` deliberately has
**no default** — a producer that forgets the brand must fail, not file under
Therr.

---

## Step 6: `therr-messaging-automator`

The sibling Cloud Function pushes **directly**, bypassing this repo's producers.
It is the prime suspect whenever a push arrives under the wrong brand.

What couples it:

- It re-declares `resolveDeviceTokenForBrand` against the same database
  (`src/index.ts`) — brand-scoped row first, legacy shared column as fallback.
  A change to the resolution rule here must be mirrored there.
- It calls `POST /notifications/send` with `x-brand-variation: <brand>`, where
  the brand comes from `getPrimaryBrand(user)` — **the single most-recently-seen
  entry in the user's `brandVariations` JSONB array.** A user active in two apps
  gets exactly one brand, so their other app receives nothing from the automator.
  That is a known limitation, not a bug to fix accidentally.
- It also calls `POST /v1/habits/pacts/digest/run-daily` and writes
  `habits.habit_phases` email watermarks.
- It mirrors brand-scoped table names in `src/store/brandScoped.ts`. Adding a
  table to `eslint-config/brand-scoped-tables.js` means mirroring it there — the
  lint rule cannot see another repository.

Brand-appropriateness of copy is enforced **only** server-side, by
`BRAND_EXCLUDED_NOTIFICATION_TYPES`. The automator will happily push Therr's
"Drop a moment at your favorite spot" to a niche handset; the block in
`firebaseAdmin.ts` is what stops it. Adding a new niche brand therefore requires
a `BRAND_EXCLUDED_NOTIFICATION_TYPES` entry even if nothing in *this* repo would
ever send those types.

If a change alters the token-resolution rule, the send endpoint's contract, or
the brand-scoped table set, say so explicitly in the report — the sibling repo
has to be updated separately and no CI will notice.

---

## Step 7: Branch split and deploy ordering

Push notifications straddle the split, so **check the branch before staging**:

| Must land on `general` | Stays on `niche/<TAG>-general` |
|---|---|
| `therr-services/**`, `therr-public-library/**` (types, enums, intent-action enums, copy) | `AndroidManifest.xml`, `build.gradle`, `google-services.json` |
| `TherrMobile` shared handling: `index.js`, `Layout.tsx`, `constants/index.tsx` | brand assets, `brandConfig.ts` |

Consequences that have bitten:

- A type added on `general` is inert on a niche app until that branch's manifest
  declares its intent action **and a new build ships**. There is no CI path from
  a niche branch to production, and no check that the two halves agree.
- A server change that moves a type from display to data-only requires the mobile
  release **first**.
- A fix to registration or routing that lives in mobile code only takes effect in
  a **new build** — existing installs do not self-heal.

Use `/split-branch-prs` for the two-PR path and `/branch-guard` to check staged
paths.

---

## Step 8: Verify

```bash
# The wiring checker, on this branch and on every shipping niche branch
node .claude/skills/push-notification-guard/scripts/check-push-wiring.js
node .claude/skills/push-notification-guard/scripts/check-push-wiring.js --brand-branch niche/HABITS-general

# Unit tests that pin brand routing, payload shape and copy
npm run pr:test:unit:push

# Locale parity and types
npm run locales:check
npm run pr:typecheck:push
npm run pr:typecheck:users        # if the producer or token routing changed
npm run pr:typecheck:js-utils     # if the shared enums changed
```

Then, if the change could affect delivery rather than only content:

```bash
# Real envelope, real credentials, no delivery (dryRun defaults true)
./_bin/push-debug.sh --user <userId> --token <jwt> --brand habits --production-path

# What production would run post-deploy
_bin/cicd/uat-push.sh
```

> **`--production-path` matters.** The default raw path builds a narrower `data`
> map and skips the `SENDABLE_NOTIFICATION_TYPES` gate, so it validates an
> envelope production never sends. That is why `push-debug.sh` reported "FCM
> accepted the message" on every run throughout the three-week outage.

**Nothing above proves delivery.** Link 5 has no server-side signal. If the
change touches `apns-topic`, channels, intent actions, or token registration, the
only real verification is a handset — ideally one with **both** apps installed,
confirming each brand's notification lands in its own app.

---

## Step 9: Report

```
Push notification guard — <branch>

Change class:   <new type | retargeted type | new producer | token routing | new brand>
Delivery links touched: <1..5>

Blockers
  ✗ <finding> — <why it fails silently> → <fix>

Fixed
  ✓ <what was changed>

Cross-repo
  <therr-messaging-automator implications, or "none">

Branch split
  general:            <paths>
  niche/<TAG>-general: <paths>
  Deploy order:       <constraint, or "none">

Manual verification required
  - <handset check, with the brand and the type>
```

Fix mechanical gaps directly — a missing locale key, a missing
`SENDABLE_NOTIFICATION_TYPES` entry, a missing intent-filter, a
`BRAND_APP_IDENTITIES` row. Do **not** silently change delivery semantics
(display ↔ data-only, a channel's importance, a brand restriction, the legacy
token fallback): report those and let the user decide, since each carries a
deploy-ordering or user-visible consequence.

Add any post-deploy handset check to
`docs/WORK_IN_PROGRESS.md` § Manual Operational Follow-ups — it is the only
place link-5 verification can live.
