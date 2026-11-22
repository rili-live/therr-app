# Drops

**Status:** Built (2026-11-21), Therr only. Shipped dark behind the `ENABLE_DROPS` mobile
feature flag, which is on in the Therr build. Not yet released to Play.
**Branch:** everything below lives on `general`.

A drop is a note and/or a photo that one user leaves **at a place** for **one or more named
friends**. The friend is told it is waiting and where, and can open it only when they get there.

It is the "personalized drop" idea from the November 2026 retention brainstorm
([`RETENTION_IDEAS.md`](./RETENTION_IDEAS.md)), and the only one of those ideas built so far.
That document gives each of the others its own status: some are intended but deferred, the rest
unconfirmed.

---

## Why this exists

Therr's core mechanic, content that unlocks when you are near where it was posted, needs many
users in one area before it does anything for anyone. With a few dozen installs, a feature has
to work for **one user or two**.

A drop works with two people. It gives both of them a reason to come back:

- **The recipient** has something waiting that they can only open by going somewhere.
- **The sender** finds out when it was found, and is invited to the next round ("Leave one
  back").

It reuses what Therr already has: connections, location, private photo upload, notifications
and push. It does not depend on content density.

---

## How it works

1. **Leave it.** There are three entry points:
   - the map's create menu ("Leave a Drop");
   - a friend's profile → ⋯ → "Leave a drop for them";
   - the Drops inbox.

   The sender picks up to 10 friends, writes a message and/or adds a photo, and optionally
   names the spot ("the bench by the fountain"). The drop is pinned where the sender is
   standing; the screen takes a fresh GPS fix rather than the map's cached point.
2. **The recipient is told.** They get a push, `dropReceived`, plus an in-app notification.
   The push reads "Sam left you a drop. It's waiting at the bench by the fountain."
3. **The recipient sees where, not what.** The drop screen shows:
   - who left it;
   - the place name;
   - the exact point, with "Get directions";
   - a live distance;
   - whether there is a photo inside.

   It does not show the message or the photo.
4. **Open it on the spot.** "I'm here. Open it" sends the device's position and reported
   accuracy. The **server** decides by distance (see § Rules). Being too far returns roughly
   how far ("You're about 400 ft away").
5. **Close the loop.** On the first open:
   - the sender gets `dropOpened` ("Alex found the drop you left at …"), unless the recipient
     unticked "Let Sam know I opened it";
   - the recipient sees the content and a "Leave one back" button, which opens the create
     screen with the sender preselected.

There are two lists, both in the Drops inbox: **For You** and **You Left**. A sender can delete
their drop. A recipient can remove it from their own list, and the sender is not told.

---

## Rules

All of these live in `therr-services/users-service/src/utilities/drops.ts`, and are
unit-tested in `tests/unit/drops.test.ts`.

| Rule | Value | Why |
|---|---|---|
| Unlock radius | 75–500 m, default 100 m | Phone GPS is often 20–50 m off. The 20 m used for space check-ins would leave someone standing on the spot unable to open it. |
| Accuracy allowance | + the device's reported accuracy, **capped at 50 m** | Forgives a weak fix. The value comes from the client, so an uncapped allowance would open everything. |
| Lifetime | 30 days | An unopened drop expires. The inbox keeps expired ones for 7 more days, so a drop is seen to have run out rather than silently vanishing. |
| Recipients | 1–10 **live** connections | Accepted and not broken (`getLiveConnectionUserIdsAmong`). A pending or removed connection does not qualify, and nor does a recipient who has blocked the sender. |
| Send cap | 30 rows (recipients) per sender per rolling 24 h | Abuse ceiling, not a product limit. |
| Message | ≤ 500 characters; a message, a photo, or both | — |
| Photo | Private bucket; the path must be under the sender's own `<userId>/` prefix | Private media resolves to a deterministic URL, so the path itself gives access to the image. Accepting another user's path would let a sender forward an image they were never shown. |

### Privacy decisions

- **The location is shown to the recipient exactly.** The sender chose this person and chose
  to send them there; a vague circle only makes the trip harder. What is withheld until the
  drop is opened is the **content**.
- **The message and photo never reach a locked recipient.** `serializeDrop` returns
  `message: null` and `mediaUrl: null`, and the raw photo path never leaves the server for
  anyone. users-service builds the photo URL itself (`IMAGE_KIT_URL_PRIVATE`), and only for a
  caller allowed to see it. maps-service `createMediaUrls` would not resolve another user's
  private path for a drop anyway, and that is the correct behaviour.
- **The unlock trusts the location the phone reports.** `decideOpenDrop` checks the coordinates
  in the open request; nothing proves the device is really there, so a spoofed location opens a
  drop. That is accepted for v1: a drop only ever goes to a connection the sender chose, and its
  location is already shown to that person exactly, so a spoof bypasses the walk, not anyone's
  privacy. Revisit if drops ever reach people the sender did not pick, such as a public drop.
- **A deleted drop takes its photo with it.** When the sender deletes a drop, users-service
  deletes the photo from the private bucket once no row references its path any more
  (`deleteDropMediaIfUnreferenced`). A drop left for several friends shares one upload, so the
  photo stays until the last copy is deleted. A recipient removing their copy never deletes it.
  The bucket delete is best effort: if it fails the drop is still deleted and the error is
  logged. Photos of drops that merely expire are not cleaned up yet.
- **Strangers and senders get `notFound` when they try to open.** The sender already holds the
  content. A distinct answer would only confirm to someone guessing ids that a row exists.
- **The sender sees the day it was opened, never the time.** The API returns `openedOn` as
  `YYYY-MM-DD`.

  > **Deviation from the brainstorm, decide before release:** the brainstorm proposed
  > day-level receipts on by default. The **push** to the sender (`dropOpened`) is still sent
  > at the moment of opening, so the push itself tells the sender roughly when. The
  > recipient's control is the "Let them know I opened it" checkbox (default on), which
  > suppresses the push and the in-app notification entirely. Delaying the push to the next
  > morning through `enqueueNotification` was set aside because it depends on
  > `NOTIFICATION_QUEUE_WORKER_ENABLED`. Revisit if this feels too revealing in use.

### Moderation

Drops are **not content-scanned** in v1. Like direct messages, they go only between
connections. The recipient can remove one, and can block the sender, which stops further
drops (the create path checks `blockedUsers`). There is no "report a drop" yet; see
§ Not built yet.

---

## Data model

`main.drops` is in the users-service database, migration
`20261121000001_main.drops.js`. It is **brand-scoped from birth**:

- it is listed in `eslint-config/brand-scoped-tables.js`;
- it is read only through `DropsStore` (`BrandScopedStore`, mode `enforce`);
- a Therr drop never surfaces in Friends with Habits.

There is **one row per (drop, recipient)**. Leaving one drop for three friends writes three
rows that share `batchId`. Each recipient opens, removes and is notified about their own copy,
so every read is a single-table query.

| Column | Notes |
|---|---|
| `fromUserId` / `toUserId` | Foreign keys to `main.users`, cascade on delete. |
| `message`, `mediaPath`, `mediaType` | The content. |
| `latitude`, `longitude`, `unlockRadiusMeters` | Where the drop is, and how close the recipient must be. |
| `placeName` | The sender's label, ≤ 120 characters. |
| `spaceId` | Optional maps-service space. No foreign key, because it is another service's database. |
| `expiresAt`, `openedAt` | `openedAt` is written once; `markOpened` matches only `openedAt IS NULL`, so the sender is notified once. |
| `recipientDismissedAt` | Recipient-side hide. |

Indexes:

- `(brandVariation, toUserId, createdAt)` for the inbox;
- `(brandVariation, fromUserId, createdAt)` for the sent list and the daily cap.

Neither Cloud Function automator reads this table.

---

## API

All routes are on the gateway under `/v1/users-service`, with validation in
`therr-api-gateway/src/services/users/validation/drops.ts`. The users-service handlers are in
`handlers/drops.ts`.

| Method | Path | Who | Notes |
|---|---|---|---|
| `POST` | `/drops` | sender | `{ recipientIds[], message?, media?: { path, type }, latitude, longitude, placeName?, spaceId?, unlockRadiusMeters? }`. Returns `{ batchId, drops[] }`. |
| `GET` | `/drops/received` | recipient | Inbox. Locked drops come back without content. |
| `GET` | `/drops/sent` | sender | — |
| `GET` | `/drops/:id` | either party | `404` for anyone else. |
| `POST` | `/drops/:id/open` | recipient | `{ latitude, longitude, accuracy?, shouldNotifySender? }`. Errors: `403 { errorCode: 'tooFar', distanceMeters }`, `410 { errorCode: 'expired' }`. |
| `DELETE` | `/drops/:id` | either party | The sender deletes the drop; the recipient hides their copy. |

The client service is `therr-react` `DropsService`.

---

## Notifications

| Type | To | When | Copy |
|---|---|---|---|
| `DROP_RECEIVED` / `dropReceived` | recipient | inline, at create | "Sam left you a drop. It's waiting at …" |
| `DROP_OPENED` / `dropOpened` | sender | inline, on the first open, unless the recipient opted out | "Alex found the drop you left at …" |

How the pushes are built:

- Both are **data-only**, with the `dropView` press action. The drop rides the data map as
  `drop: { id, placeName }`, so the tap opens `ViewDrop` directly.
- The intent actions are `DROP_RECEIVED` and `DROP_OPENED`. They are declared in the Therr
  manifest on `general`, and both keys are in `REMINDER_ACTION_KEYS`, which sets their Android
  channel.
- Both types are in `BRAND_EXCLUDED_NOTIFICATION_TYPES[HABITS]`, so a lost brand header can
  never put one in the Friends with Habits app.
- There is copy with and without a place name in all three locales. The title emoji are 📦 and
  🔑, though emoji are applied only to Habits titles.
- Push copy tests are in `push-notifications-service/tests/unit/api/dropCopy.test.ts`.

---

## Mobile

- **Screens:** `TherrMobile/main/routes/Drops/`:
  - `index.tsx`: the inbox, with For You and You Left tabs;
  - `CreateDrop.tsx`;
  - `ViewDrop.tsx`: locked, opened, expired and sender views.
- **Styles:** `styles/drops`.
- **Routes:** gated on `ENABLE_DROPS` **and** `ENABLE_MAP`.
- **Feature flag:** `ENABLE_DROPS` is `true` in `TherrMobile/env-config.js` on `general`.
  **Every niche brand must set it false in its overrides on `niche/<TAG>-general`.** Merging
  `general` down would otherwise switch it on there. It is harmless while that brand has
  `ENABLE_MAP: false`, but it should not depend on that.
- **Taps:** routed in `Layout.tsx` through the intent action, the type route and the
  `dropView` press action. Taps from the in-app notifications list are routed in
  `routes/Notifications/index.tsx`.

---

## Not built yet

These are possible follow-ups, none of them committed to:

- **Drops for people not on Therr.** An invite link that carries a drop, plus opening a drop
  on the web, using browser geolocation and the same server-side distance check. The web
  version matters because there is no iOS build: without it, an iPhone recipient hits a dead
  end.
- **"You're near a drop" push.** Background location already reaches
  `push-notifications-service` `processUserBackgroundLocation`. A lookup of the user's locked
  drops there could nudge them when they pass one. Respect dwelling suppression and the
  existing push throttle.
- **Expiry reminder,** a few days before an unopened drop runs out, sent through the
  notification queue with a `drop-expiring:<dropId>` dedupe key.
- **Report a drop,** and image moderation via the existing Sightengine path.
- **Measurement:**
  - drops sent per weekly active user;
  - the share opened within 7 days;
  - the share of recipients who leave one back;
  - installs attributed to drop invites, once those exist.

  None of these are tracked yet beyond the table itself.
