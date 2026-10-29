# HABITS Pact Chat Design (MVP)

**Status:** MVP, October 2026. Backend on `general`, mobile UI on `niche/HABITS-general`.

## Why

With internal accounts excluded (Session 2's retention report, PR #3153), users whose partner joined
average **3.6** check-in days, against **1.9** for users whose invitee never joined. That is about 2x,
and **0** paired users were still checking in after week 4. Having a partner helps, but it does not
hold anyone, and partners have nothing to open the app for between check-ins. A pact chat is a bet that a reason to talk is
a reason to come back. The bet is measurable: `habits.pact_messages` can be queried, and GA4 gets
`pact_chat_open` / `pact_message_send` / `pact_chat_react`.

## Decisions

### 1. Storage: a habits table in users-service, not messages-service forums

The brief said to reuse `main.forums` / `main.forumMessages` unless there is a clear reason not to. There
are four:

| | Forums (messages-service DB) | `habits.pact_messages` (users DB) |
|---|---|---|
| Who may read/post | Pact membership is in the **users** DB. Forums would need a cross-service membership check on every read and write. Today `POST /forums-messages` takes `fromUserId` from the request body, and socket room joins check no membership at all. | One `pact_members` row read in the same database |
| Check-ins inline | `habit_checkins` is in the users DB, so this would need a cross-service write per check-in, or a join across two databases at read time | A read-time merge in one query pair |
| Push batching | The notification queue is in users-service | Same process |
| Lifecycle | A forum row per pact, kept in step with pact create, renew and delete | FK `ON DELETE CASCADE` to `habits.pacts` and `main.users` |

`habits.pact_activities` already exists but is **not** reused. It has 0 rows in production and no client
calls it. Its `POST` accepts any activity type from the client (so a client could fake a
`checkin_completed`), and it has no shape for a reaction's target or for a per-user uniqueness rule.
It is left as it is.

The schema is `habits.*`, so it is not one of the brand-scoped `main.*` tables. Like `pact_join_requests`
and `challenges`, every row is reached through a `pactId`, which already belongs to the HABITS app.
Nothing goes into `BRAND_SCOPED_TABLES`, and neither sibling automator reads these tables.

### 2. Schema (migration `20261028000001_habits.pact_chat.js`)

- `habits.pact_messages`: `id`, `pactId` (FK cascade), `userId` (author, FK cascade),
  `text` (≤ 1000 chars, trimmed, non-empty), `clientMessageId` (nullable; UNIQUE with `userId`, so a
  retried send cannot post twice), `reportedAt`, `reportedByUserIds` (jsonb), `createdAt`.
  Index `(pactId, createdAt)`.
- `habits.pact_chat_reactions`: `id`, `pactId` (FK cascade), `userId` (FK cascade), `targetKind`
  (`message` | `checkin`), `targetId` (uuid, polymorphic, no FK), `emoji`, timestamps.
  UNIQUE `(targetId, userId)`: **one reaction per person per item**, and choosing another emoji replaces it.
  When a target is deleted its reactions are orphaned. They do no harm, because reads join from the
  page's own item ids.
- `habits.pact_members."chatLastReadAt"` (timestamptz, nullable): the unread watermark.

All three are additive and idempotent (`hasTable` probes, `ADD COLUMN IF NOT EXISTS`). Every index sits
inside the new tables' `createTable` callbacks, so no `CONCURRENTLY` build is needed.

### 3. One thread per pact, carried across renewals

A renewal creates a new pact row (`renewedFromPactId`). The thread for pact *P* is *P* plus its
ancestors (up to 12 cycles), so renewing keeps the conversation going. A member added in a later
cycle can see the earlier cycles' history. That is accepted for the MVP, like joining a group chat
that already has history.

### 4. Check-ins appear inline, merged at read time

The timeline is `pact_messages` ∪ completed `habit_checkins` on the thread's pacts, ordered by
`completedAt` (or `createdAt`), with one cursor (`before` for scrolling back, `after` for polling).
A check-in item carries its notes, `hasProof` and the habit's name and emoji. The proof photo is read
through the existing `GET /habits/checkins/:id/proofs`, which enforces the same membership.
Nothing is written into the check-in path, which is the most sensitive request in the app, and every
historical check-in shows up in the chat from day one.

### 5. Who may do what

- **Read:** a member with status `active` or `completed`. Legacy 1:1 pacts with no member rows fall
  back to `creatorUserId` / `partnerUserId`. Pending invitees and members who `left` or were `removed` get 403.
- **Post / react:** the pact is `active` and the caller's membership is `active`. A pact that has ended
  is read-only.
- Messages from users the viewer has blocked (`users.blockedUsers`) are left out of the viewer's
  timeline.

### 6. Delivery: REST plus polling, no websocket

The client sends with `POST`, and the open chat screen polls `?after=<newest>` every 10 s while it has
focus. It also refreshes when the app returns to the foreground and when a chat push opens it.
Websocket fan-out is deliberately deferred:
- users-service cannot emit to sockets. Supporting it would mean a new websocket-service handler,
  a membership check on room join (none exists for forum rooms today) and a users-service →
  websocket-service hop.
- There are 9 active pacts in production. Polling one small indexed query only while the screen is
  open costs almost nothing, and it can't fail silently the way socket rooms can.

The reserved `SocketServerActionTypes.PACT_ACTIVITY` and the `PACT:<id>` room naming in
`HABITS_REALTIME_DESIGN.md` remain the upgrade path if chat proves itself.

### 7. Push: queued, batched, and skipped once read

A message enqueues a `pact-message` push for every other active member who has not muted the pact and
has not blocked the sender:

- `dedupeKey = pact-message:<pactId>:<UTC hour of the message's createdAt>`. The queue's UNIQUE
  `(brandVariation, userId, dedupeKey)` limits each recipient to one chat push per pact per hour,
  however many messages arrive. The key comes from the stored row's timestamp, not from `Date.now()`.
- `scheduledFor = now + 90 s`. At send time a freshness check (`utilities/pactMessageFreshness.ts`)
  skips the row as `already-read` when the recipient's `chatLastReadAt` has passed the message, and also
  when they have muted the pact or are no longer an active member. A partner who is in the chat
  already gets no push.
- The push is data-only, like the other `partner*` types, with press action `pactView`, intent key
  `PACT_MESSAGE` and the "Reminders" (heads-up) channel. Its body is `"{name}: {first line}"`, and the tap
  opens the chat. It counts toward the 5-per-day cap and can be dropped by it, which is correct for a
  key that recurs every hour.

### 8. Reactions and quick replies

- Reactions use a fixed set: 💪 🔥 👏 ❤️ 😂 🙌. They work on any message or check-in in the thread.
  `PUT …/chat/reactions { targetId, targetKind, emoji | null }` sets, replaces or clears the caller's one reaction.
- Quick replies are localized chips above the composer ("💪", "Nice!", "Let's go!", "Proud of you").
  A tap sends an ordinary text message (`isQuickReply` is logged to GA4).
- Reactions send no push. They are seen the next time the chat is opened.

### 9. Mute

`PUT …/chat/mute { isMuted }` writes `pact_members.shouldMuteNotifs`. That flag already means "mute
this pact" for partner check-in celebrations (`selectPactPartnerIds({ onlyCelebrating })`), so one
switch mutes the whole pact and the UI calls it "Mute this pact's notifications". Digest reminders
about the user's own habit are not affected.

### 10. Moderation

- **Report:** `PUT …/chat/messages/:id/report` stamps `reportedAt`, records the reporter, and adds
  the reporter to the author's `users.wasReportedBy`. That is the column the existing "report user"
  path writes, so reports end up where moderators already look. A reported message is hidden from
  the reporter.
- **Block:** the existing `PUT /users/:id/block`. Blocked authors are filtered from the viewer's
  timeline, and the blocker gets no chat pushes from them.
- **No profanity filter.** This is a private chat among people who invited each other.
  `utilities/contentSafety.ts` is available if reports show it is needed.

### 11. Unread

`unreadMessageCount` (messages newer than `chatLastReadAt` from other members, with blocked and
reported ones left out) is attached to the pact list and pact detail responses with one grouped
query. `PUT …/chat/read` moves the watermark forward and is called when the chat opens and as new
messages arrive. The pact card and the pact screen show a badge from it.

## API (through the gateway, under `/v1/users-service`)

| Method | Path | Notes |
|---|---|---|
| GET | `/habits/pacts/:pactId/chat?before=&after=&limit=` | `{ items, users, hasMore, canPost, isMuted, lastReadAt }` |
| POST | `/habits/pacts/:pactId/chat/messages` | `{ text, clientMessageId? }` → 201 `{ item }`. Rate limited to 30 per minute |
| PUT | `/habits/pacts/:pactId/chat/read` | moves the watermark to now |
| PUT | `/habits/pacts/:pactId/chat/reactions` | `{ targetId, targetKind, emoji \| null }` |
| PUT | `/habits/pacts/:pactId/chat/messages/:messageId/report` | |
| PUT | `/habits/pacts/:pactId/chat/mute` | `{ isMuted }` |

## Reading the result

The measurement is `npm run report:retention` (`scripts/retention-report`, PR #3153). It already splits paired
from unpaired retention with internal accounts excluded, and the baseline it reports before chat is
3.6 check-in days for paired users and 0 still active after week 4. Chat users are pact members who
sent at least one message in their first 7 days after joining. The question is whether they retain
better than paired users who did not, at week 1 and week 4. This is the cohort split to add to that
report (it reads `habits.pact_messages`; add the report's own internal-account exclusion):

```sql
WITH paired AS (
  SELECT pm."userId", MIN(pm."joinedAt") AS joined
  FROM habits.pact_members pm
  WHERE pm.status IN ('active','completed') AND pm."joinedAt" >= '2026-11-01'
  GROUP BY 1
), chatted AS (
  SELECT DISTINCT p."userId"
  FROM paired p JOIN habits.pact_messages m
    ON m."userId" = p."userId" AND m."createdAt" < p.joined + interval '7 days'
)
SELECT (c."userId" IS NOT NULL) AS chatted,
       COUNT(*) AS users,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM habits.habit_checkins hc
            WHERE hc."userId" = p."userId" AND hc.status = 'completed'
              AND hc."completedAt" >= p.joined + interval '7 days')) AS active_after_w1,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM habits.habit_checkins hc
            WHERE hc."userId" = p."userId" AND hc.status = 'completed'
              AND hc."completedAt" >= p.joined + interval '28 days')) AS active_after_w4
FROM paired p LEFT JOIN chatted c USING ("userId")
GROUP BY 1;
```

At ~25 installs/week this is a directional read and will not reach significance. Revisit after 6–8 weeks.

## Deliberately left out

Media upload in chat (beyond what check-ins already carry), editing or deleting messages, typing
indicators and presence, websocket real-time, a chat-only mute, an email fallback for chat pushes,
chat on pending pacts, @mentions, link previews, search, and a web client.
