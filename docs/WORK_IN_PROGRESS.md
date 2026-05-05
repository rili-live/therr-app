# Work In Progress — TODO Backlog & Manual Steps

**Last Updated:** April 2026
**Audience:** Developers and coding agents
**Status:** Living document — update when TODOs are resolved or added

> This is the canonical backlog of cross-cutting code TODOs and the operational
> follow-ups required after deploys. It is **not** a feature roadmap — see
> `docs/niche-sub-apps/PROJECT_BRIEF.md`, `docs/GROWTH_STRATEGY.md`, and the
> per-niche project briefs for product direction. The backlog below is sorted
> by **business value** (Tier 1 = revenue-blocking; Tier 5 = nice-to-have),
> and items within each tier are roughly ranked by **impact × effort**.
>
> **Related trackers:**
>
> - `docs/PEER_REVIEW_FOLLOWUP.md` — narrower scope: items deferred during
>   `general → stage` peer reviews (e.g., shared-store unification, shadow→
>   enforce flips, mobile tsc baseline payoff). Use that file when the work
>   originated from a specific review's residue; use this file for
>   long-standing code TODOs and for post-deploy manual steps.

---

## How to use this document

- **Coding agents:** When you start a session, scan **§ Manual Operational
  Follow-ups** for unchecked items and offer to help the user complete them.
  When you fix a TODO, remove it from this file in the same commit.
  When skills (`/quality-peer-review`, `/quality-peer-review-niche`,
  `/seo-audit`, etc.) discover a manual step required after a code deploy,
  append it to **§ Manual Operational Follow-ups** with a checkbox.
- **Developers:** Use this as the prioritized backlog when you have spare
  time. Tier 1 items are the only ones that should pre-empt active feature
  work on the current niche/general branch.
- **Plausibility:** This audit removed dead-code, debug-print, and duplicate
  TODOs. Everything below has been confirmed plausible against the current
  codebase (April 2026 audit).

---

# Manual Operational Follow-ups

Items that require human action — typically post-deploy, or external system
configuration that code alone cannot complete. **Coding agents should
proactively encourage the user to check off open items at the start of each
session.** Skills with `Manual Steps Required After Deploying` output should
append new items here rather than only printing them once.

## Standing items (always re-verify after a deploy that touches the area)

- [ ] **Submit / re-submit sitemap to Google Search Console** after any change
  that adds, removes, or restructures SSR routes (`therr-client-web/src/server-client.tsx`,
  `therr-client-web/src/sitemap.ts`). See `docs/GROWTH_STRATEGY.md` Priority 1.
- [ ] **Verify Stripe webhook signature secret** is set in production env after
  a webhook handler change (`therr-services/users-service/src/api/stripe.ts`).
  Mismatched secrets silently 401 — no error is surfaced to the user.
- [ ] **Warm up AWS SES sender reputation** before scaling unclaimed-space
  email batches. Stay ≤ 50/day for the first week; monitor bounce rate < 5%
  in the AWS SES dashboard. See `docs/GROWTH_STRATEGY.md` Email Deliverability.
- [ ] **Confirm Firebase / FCM credentials match the brand variation being
  deployed** (`therr-services/push-notifications-service/src/api/firebaseAdmin.ts`).
  Per-brand Firebase apps are loaded by env var; a stale value will silently
  send pushes from the wrong project.
- [ ] **Run unconsumed migrations** on each service after any change under
  `therr-services/<service>/src/migrations/**` lands on `main`. There is no
  auto-migrate step in the deploy pipeline.
  Command per service: `npm run migrations:run` (verify per-service `package.json`).
- [ ] **Invalidate CDN cache for assets** (`docs/CLOUDFLARE_CDN.md`) after any
  change to global CSS, brand assets, or favicons.

## Pending campaign / outreach actions

- [ ] **Run the first unclaimed-space email batch** (`scripts/import-spaces/send-unclaimed-emails`,
  start with `--city chicago --limit 50`). 90-day validation milestone — see
  `docs/GROWTH_STRATEGY.md`.
- [ ] **Register Apple Developer account and submit iOS build** —
  removes the iOS gap from the B2B pitch.
- [ ] **Run OSM import for Chicago/LA at scale** to populate email inventory.
- [ ] **Run `source-emails-websites` overnight cron for highest-density city**
  to populate `businessEmail` before the next batch.

## Skill-generated items (auto-appended)

> Skills (`/quality-peer-review`, `/quality-peer-review-niche`, `/seo-audit`,
> `/security-review`, `/db-migration-scaffold`) append items to this section
> when their report identifies a step that must run after deploy. Format:
> `[ ] (YYYY-MM-DD, /<skill-name>) <action> — <why>`

<!-- skill-followups:start -->
- [ ] (2026-04-27, /quality-peer-review) Run users-service migrations on production
  (`20260425000001_main.users.brandVariations_v2`,
  `20260425000002_main.notifications.brandVariation`,
  `20260425000003_main.userDeviceTokens`,
  `20260426000001_main.userAchievements.brandVariation`) — Phase 2/5 multi-app
  data isolation; brand-scoped reads will filter to zero rows until columns/tables
  exist with the 'therr' default backfill.
- [ ] (2026-04-27, /quality-peer-review) Run messages-service migrations on production
  (`20260425000004_main.directMessages.brandVariation`,
  `20260425000005_main.forums.brandVariation`,
  `20260425000006_main.forumMessages.brandVariation`) — Phase 3 multi-app
  isolation; same reasoning.
- [ ] (2026-04-27, /quality-peer-review) Configure per-brand Firebase service
  account env vars on push-notifications-service production
  (`PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_HABITS`,
  `PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_TEEM`) — until set, HABITS/TEEM
  pushes fall back to the THERR Firebase project, which is wrong for token
  routing once niche apps go live.
- [ ] (2026-04-27, /quality-peer-review) After one release cycle with clean
  shadow logs, flip `BrandScopedStore` mode from `'shadow'` to `'enforce'` in
  `NotificationsStore`, `UserAchievementsStore`, `UserDeviceTokensStore`,
  `DirectMessagesStore`, `ForumsStore`, `ForumMessagesStore` — comments in each
  store mark this. Same release should also delete the legacy fallback in
  `resolveDeviceTokenForBrand` once `main.userDeviceTokens` is authoritative.
- [ ] (2026-04-27, /quality-peer-review) After the dual-write window closes
  (mobile clients have re-registered against `main.userDeviceTokens`), drop the
  legacy `users.deviceMobileFirebaseToken` column in a follow-up migration —
  documented in `20260425000003_main.userDeviceTokens` migration header.
- [ ] (2026-04-28, /quality-peer-review) Run users-service migration
  `20260427000001_main.thoughts.brandVariation` on production before deploying
  this `general` merge. Adds `brandVariation` (NOT NULL DEFAULT 'therr') +
  index `idx_thoughts_brand_variation` to `main.thoughts`. Therr-brand reads
  preserve "see everything" via the `BRAND_THOUGHTS_VISIBILITY` allowlist, but
  HABITS/TEEM reads will reference the column and 500 until the column exists.
<!-- skill-followups:end -->

---

# TODO Backlog by Business Value

## Tier 1 — Revenue-Blocking & Trust-Critical

These TODOs directly block the **B2B-first** revenue funnel
(`docs/GROWTH_STRATEGY.md`) or expose user data / spoofable mechanics. Fix
before any consumer growth investment.

### 1.1 SEO completeness (B2B funnel — Step 2 of 8)

The space landing page **is** the B2B sales pitch. Missing OG/meta on
sibling content types (moments, user profiles) leaks indexing weight and
breaks share previews from claim-emails.

- `therr-client-web/src/server-client.tsx:849` — Mimic best-SEO practices for
  moment SSR meta tags
- `therr-client-web/src/server-client.tsx:940` — Mimic best-SEO practices for
  space SSR meta tags
- `therr-client-web/src/server-client.tsx:1378` — Mimic best-SEO practices for
  user-profile SSR meta tags
- `therr-client-web/src/server-client.tsx:1384` — Use an image optimized for
  the OG `meta` image (current path uses unsized media)
- `therr-client-web/src/routes/ListSpaces.tsx:31` — Geo-targeted meta tags +
  URL slugs for category/location landing (compounds with city-category page
  work in `docs/GROWTH_STRATEGY.md` Priority 7)
- `therr-client-web/src/server-client.tsx:1892` — Locale-first guide rendering
  per `docs/CONTENT_LOCALE_FIRST_PLAN.md`

### 1.2 Spoofable / unauthenticated mutation endpoints

These reaction/activation endpoints are public and can be triggered by an
unauthenticated client to mutate engagement metrics on demand. This corrupts
analytics that the B2B dashboard charges for.

- `therr-services/reactions-service/src/handlers/momentReactions.ts:12, 77` —
  Endpoint should be secure/non-public
- `therr-services/reactions-service/src/handlers/thoughtReactions.ts:12, 62` —
  Same
- `therr-services/reactions-service/src/handlers/spaceReactions.ts:57, 126` —
  Same
- `therr-services/reactions-service/src/handlers/eventReactions.ts:10, 53, 111`
  — Same
- `therr-api-gateway/src/services/maps/router.ts:144` — Backend logic to
  prevent location spoofing (rapid-change detection)

### 1.3 User deletion completeness (GDPR / app-store compliance)

The user-deletion path drops the row in users-service but leaves orphans in
notifications, messages, forums, websocket sessions, and cloud media. This
is a privacy-policy violation and an Apple/Google review risk.

- `therr-services/users-service/src/handlers/users.ts:1041` — Delete
  notifications in users service
- `therr-services/users-service/src/handlers/users.ts:1042` — Delete messages
  in messages service
- `therr-services/users-service/src/handlers/users.ts:1043` — Delete forums
  / forumMessages
- `therr-services/users-service/src/handlers/users.ts:1046` — Delete user
  session from websocket-service redis
- `therr-services/users-service/src/handlers/users.ts:1047` — Delete user
  media from cloud storage

### 1.4 Auth / billing-email integrity

- `therr-services/users-service/src/handlers/auth.ts:279` — Prevent users
  claiming the same billing email as another user (duplicate-charge / refund
  dispute risk)
- `therr-services/users-service/src/handlers/auth.ts:69` — Mitigate user
  with multiple accounts attached to same phone number
- `therr-services/users-service/src/handlers/users.ts:619` — Don't allow
  updating phone number unless already verified
- `therr-services/users-service/src/handlers/userConnections.ts:44` —
  RSERV-24: Get requestingUserId from header token, not request body
  (impersonation vector)
- `therr-services/users-service/src/handlers/users.ts:703, 911` — Investigate
  flagged security issue (open as of audit date)

### 1.5 Payment / subscription closure

- `therr-services/users-service/src/handlers/users.ts:148` — Use
  paymentSessionId to fetch subscription details and add accessLevels (the
  Stripe checkout completes but the user account is not upgraded with tier
  metadata)
- `therr-services/users-service/src/handlers/auth.ts:67` — Same path on auth
- `therr-services/users-service/src/handlers/payments.ts:53` — Only update
  user if subscription has started free trial or paid

---

## Tier 2 — Consumer Growth Engine (Habits, Push, Engagement)

The viral loop in Friends With Habits (`docs/niche-sub-apps/HABITS_PROJECT_BRIEF.md`)
and the engagement roadmap (`docs/PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md`)
depend on these working correctly.

### 2.1 Push notification engagement

- `TherrMobile/main/components/Layout.tsx:1698` — Wrap engagement tracking in
  soft opt-in UX with in-app messaging (biggest single push lever per
  engagement roadmap)
- `therr-services/push-notifications-service/src/handlers/helpers/areaLocationHelpers.ts:222`
  — RDATA-3: Smart rules around when to send push notifications
- `therr-services/push-notifications-service/src/api/firebaseAdmin.ts:676` —
  RDATA-3: ML to predict whether to send a push
- `therr-services/push-notifications-service/src/api/firebaseAdmin.ts:200, 222`
  — Add brandVariation to dynamically set app bundle identifier (per-brand
  Firebase routing)
- `therr-services/push-notifications-service/src/api/firebaseAdmin.ts:262` —
  iOS Notification Service Extension so iOS can fetch message content before
  showing
- `therr-services/push-notifications-service/src/api/firebaseAdmin.ts:312` —
  Use brandVariation for icon color
- `therr-services/push-notifications-service/src/handlers/notifications.ts:47, 112`
  — Endpoint should accept a type parameter
- `therr-services/websocket-service/src/handlers/messages.ts:168` — Send a
  push notification to each user in the room (excluding sender) — DM
  re-engagement is currently silent

### 2.2 Pact / habit infrastructure (HABITS-specific)

These TODOs live in shared backend and `therr-react`, so they ship from
`general` even though the consumer is the HABITS app. None today block the
MVP, but several block the **viral** loop in Phase 3.

- `therr-services/users-service/src/handlers/userConnections.ts:724` —
  RSERV-32: Return associated users (same as search userConnections does)
- `therr-services/users-service/src/handlers/users.ts:454` — Implement
  prediction algorithm for relevant user discovery (powers "people you may
  know" → invite chains)
- `therr-services/users-service/src/handlers/socialSync.ts:95, 115, 124, 134`
  — "Clout Score" calculation (gates premium tier, see HABITS brief)
- `therr-public-library/therr-react/src/redux/actions/Users.ts:347` —
  RMOBILE-26: SSO logout action (HABITS uses same auth — affects multi-app
  account switching)

### 2.3 Direct-message engagement loop

The websocket service currently relies on socket presence for unread state,
which fails on app-killed iOS — users see read state on a phone that never
saw the message.

- `therr-services/websocket-service/src/handlers/messages.ts:25, 137` —
  RSERV-36: Derive `isUnread` from frontend message instead of socket
  presence
- `therr-services/websocket-service/src/handlers/rooms.ts:55` — Same
- `therr-services/websocket-service/src/handlers/messages.ts:116, 190` —
  RSERV-36: Emit error message to user
- `therr-services/websocket-service/src/handlers/rooms.ts:92` — Same

### 2.4 Reactions / bookmarks (engagement signals)

- `therr-services/websocket-service/src/handlers/reactions.ts:13, 62` —
  Notify active users on bookmark of moment/space/thought (drives back-to-app
  loops)

---

## Tier 3 — Operational Quality (Scale, Performance, Cost)

The platform handles ~50 users today but the SEO + outreach push will create
a step-function in load. These items prevent that load from breaking the
service or burning unbounded cost.

### 3.1 Hard caps that will throttle growth

- `therr-services/reactions-service/src/store/EventReactionsStore.ts:97, 109`
  — RSERVE-52: Remove hard limit on reaction-count fetch
- `therr-services/reactions-service/src/store/MomentReactionsStore.ts:91` —
  Same
- `therr-services/reactions-service/src/store/SpaceReactionsStore.ts:99, 111`
  — Same
- `therr-services/reactions-service/src/store/ThoughtReactionsStore.ts:91` —
  Same
- `therr-services/websocket-service/src/store/redisClient.ts:17` — RSERV-6:
  Configure redis clusters
- `therr-services/websocket-service/src/store/redisClient.ts:30` — Use
  separate publish and subscribe Redis hosts

### 3.2 Cost / billing protection

- `therr-public-library/therr-react/src/services/MapsService.ts:424` — Use
  Google Maps `sessiontoken` to prevent over-billing on autocomplete
- `therr-services/maps-service/src/handlers/createMediaUrls.ts:46, 59` —
  Cache signed-URL responses per user with TTL to cut S3 API spend

### 3.3 Read-path performance hot spots

- `therr-services/users-service/src/store/ThoughtsStore.ts:333, 340` — Try
  redis/cache before DB; broader optimization
- `therr-services/users-service/src/handlers/userConnections.ts:166` —
  Collapse multiple DB requests into one
- `therr-services/users-service/src/store/UserConnectionsStore.ts:250` —
  Compare query plans and use `findUserConnections` if faster
- `therr-services/push-notifications-service/src/handlers/locationProcessing.ts:160`
  — Cache nearby spaces along with discoverable areas
- `therr-services/reactions-service/src/handlers/moments.ts:47` — Switch
  pagination from offset to cursor (`last id` filter)
- `therr-services/reactions-service/src/handlers/events.ts:49` — Same
- `therr-client-web-dashboard/src/utilities/media.ts:17` — Signed-URL
  generation is too slow
- `TherrMobile/main/routes/EditMoment/index.tsx:242` — Image signing too slow
- `TherrMobile/main/routes/EditSpace/index.tsx:350` — Same
- `TherrMobile/main/routes/EditThought/index.tsx:176` — Same
- `TherrMobile/main/routes/Events/EditEvent.tsx:310` — Same
- `TherrMobile/main/routes/Groups/EditGroup.tsx:380` — Same
- `TherrMobile/main/utilities/getActiveCarouselData.ts:33, 128` — Sort on
  server; avoid loading unnecessary data
- `TherrMobile/main/utilities/content.ts:49` — Content filtering is too slow
- `TherrMobile/main/routes/Areas/Nearby/NearbyWrapper.tsx:182, 451` — Reduce
  duplicate requests; throttle
- `TherrMobile/main/routes/Map/index.tsx:1247` — Consolidate multiple map
  requests into one dynamic request

### 3.4 Resilience & error paths

- `therr-api-gateway/src/middleware/rateLimiters.ts:9` — Add store fallback
  to prevent single source of failure
- `therr-api-gateway/src/utilities/isBlacklisted.ts:3` — Move blacklist from
  in-memory array to DB
- `therr-services/users-service/src/handlers/campaigns.ts:118` — Parse error
  messages so the dashboard can surface them
- `TherrMobile/main/socket-io-middleware.ts:11` — Fallback to polling / REST
  when socket.io fails (offline-first plan, Phase 2+)
- `TherrMobile/main/components/LoginButtons/AppleSignInButton.tsx:42` — Call
  `signOut()` when token expires
- `TherrMobile/main/components/LoginButtons/GoogleSignInButton.tsx:66` —
  Same
- `TherrMobile/main/routes/Login/LoginForm.tsx:113` — Handle malformed
  Google SSO key errors gracefully
- `TherrMobile/main/routes/EditMoment/index.tsx:459` — Delete uploaded file
  if moment creation fails
- `TherrMobile/main/routes/EditSpace/index.tsx:517` — Same for space
- `TherrMobile/main/routes/Events/EditEvent.tsx:586` — Same for event
- `therr-client-web-dashboard/src/components/forms/EditCampaignForm.tsx:27` —
  Refresh OAuth token if almost expired
- `therr-client-web-dashboard/src/routes/Campaigns/CreateEditCampaign.tsx:309, 363, 574, 618, 707, 861`
  — Error handling, alerts, multi-provider OAuth in campaign create/edit
- `therr-client-web-dashboard/src/routes/OAuth2Landing.tsx:75` —
  React Router v6 navigation flicker after new-user login (also at
  `routes/Login/index.tsx:76`, `routes/Register/index.tsx:69`)

---

## Tier 4 — Content Safety, Data Quality, Observability

Required for Apple/Google App Store compliance, paid-business trust, and
post-incident debuggability. None block today's revenue but each is a
ticking risk.

### 4.1 Content moderation (NSFW / mature)

The audit identified 7+ instances of "leaves room for gap of time where
users may find explicit content before flag updated" — this is the single
biggest App Store rejection risk.

- `therr-services/maps-service/src/handlers/moments.ts:466` — Abstract and
  add nudity filter (sightengine.com)
- `TherrMobile/main/components/0_First_Time_UI/onboarding-stages/CreateProfilePicture.tsx:76`
  — Same
- `TherrMobile/main/routes/EditMoment/index.tsx:259` — Same
- `TherrMobile/main/routes/EditThought/index.tsx:190` — Same
- `TherrMobile/main/routes/Events/EditEvent.tsx:327` — Same
- `TherrMobile/main/routes/Groups/EditGroup.tsx:397` — Same
- `TherrMobile/main/routes/Settings/index.tsx:352` — Same
- `therr-services/maps-service/src/handlers/spaces.ts:140, 764, 968, 985, 1002`
  — Tighten window where unflagged explicit content is reachable
- `therr-services/maps-service/src/handlers/events.ts:435` — Same
- `therr-services/maps-service/src/handlers/moments.ts:313, 511` — Same
- `therr-services/maps-service/src/handlers/spaces.ts:255, 1083` — Check
  user settings for mature-content visibility
- `therr-services/maps-service/src/handlers/events.ts:1068` — Same
- `therr-services/maps-service/src/handlers/moments.ts:1261` — Same
- `therr-services/users-service/src/handlers/thoughts.ts:253, 469` — Same
  for thoughts
- `therr-services/maps-service/src/handlers/helpers/index.ts:105` — Fine
  tune content-safety classifier
- `therr-services/maps-service/src/handlers/helpers/index.ts:163` — Email
  admin on flagged content

### 4.2 Locale-aware date formatting (RFRONT-25)

Dates are formatted server-side in `en-US` and shipped to mobile/web. Three
locales are supported (`en-us`, `es`, `fr-ca`) — Spanish/French users see
English-formatted timestamps.

- `therr-services/websocket-service/src/index.ts:42` — Localize dates
- `therr-services/websocket-service/src/handlers/auth.ts:35, 114` — Same
- `therr-services/websocket-service/src/handlers/messages.ts:28, 140` —
  Same
- `therr-services/websocket-service/src/handlers/rooms.ts:35, 106` — Same
- `therr-services/messages-service/src/handlers/forumMessages.ts:63` — Same
- `therr-services/messages-service/src/handlers/forums.ts:403` — Same
- `therr-services/messages-service/src/handlers/directMessages.ts:47, 93` —
  Same
- `therr-public-library/therr-react/src/redux/actions/Messages.ts:16, 48` —
  Format with locale timezone in mind
- `TherrMobile/main/routes/Map/index.tsx:251` — Derive locale from user
  settings instead of hardcoded `en-US`
- `TherrMobile/main/routes/Map/TherrMapView.tsx:153` — Same

### 4.3 Phone-number internationalization

- `therr-public-library/therr-js-utilities/src/normalize-phone-number.ts:10`
  — "We can't assume US, this is BAAAAD" — international users currently
  fail phone verification
- `therr-api-gateway/src/services/users/validation/users.ts:10` — RMOBILE-26:
  Centralize password requirements
- `TherrMobile/main/routes/Settings/index.tsx:627` — RMOBILE-26: Use
  `react-native-phone-input`

### 4.4 Data quality / audit trail

- `therr-services/users-service/src/handlers/socialSync.ts:196` — Store
  response details in `socialSyncs` for audit trail
- `therr-services/users-service/src/handlers/socialSync.ts:272` — Verify
  `requestId` for OAuth security
- `therr-services/users-service/src/handlers/userConnections.ts:549` — DB
  constraint preventing `requestingUserId == acceptingUserId`
- `therr-services/users-service/src/handlers/users.ts:879` — Reward
  increment/decrement on blockchain for auditability (long-term, but is the
  legal record once paid tier exists)
- `therr-services/users-service/src/store/InvitesStore.ts:49` — Filter out
  invites with neither phone nor email
- `therr-services/users-service/src/handlers/auth.ts:181, 182` — Encrypt
  stored OAuth `access_token`s in DB
- `therr-services/users-service/src/handlers/auth.ts:315` — Same
- `therr-services/maps-service/src/store/EventsStore.ts:524` — Make
  `createdAt` more secure (only for social sync)
- `therr-services/maps-service/src/store/MomentsStore.ts:497` — Same
- `therr-services/users-service/src/handlers/userVerification.ts:183` —
  Supply user agent to determine web vs mobile
- `therr-services/users-service/src/handlers/users.ts:1076, 1149` — Same
- `therr-services/websocket-service/src/index.ts:155, 156, 278, 279` — Get
  platform / brandVariation from request instead of hardcoded default
- `therr-services/push-notifications-service/src/handlers/helpers/areaLocationHelpers.ts:65`
  — Gradually reduce `tempLocationExpansionDistMeters` toward zero as users
  join (avoids stale "discovery radius" once cities densify)
- `therr-api-gateway/src/services/users/router.ts:569` — Validate AWS SNS
  signatures on bounce webhook

### 4.5 Observability gaps

- `therr-public-library/therr-react/src/redux/actions/Users.ts:287` — Send
  registration / login event to Google Analytics and Datadog
- `therr-services/users-service/src/handlers/auth.ts:242` — Log OAuth
  endpoint response
- `therr-services/users-service/src/handlers/users.ts:98` — Better error
  logging
- `therr-services/maps-service/src/handlers/events.ts:981` — Make this
  endpoint internal-only
- `therr-services/maps-service/src/handlers/spaces.ts:347` — Check user is
  part of organization and has access to view (currently any auth'd user can
  view any org space)
- `therr-services/maps-service/src/handlers/createMediaUrls.ts:8, 11` — More
  security on media access (verify requesting user has permission)
- `therr-services/maps-service/src/store/EventsStore.ts:37` — Same
- `therr-services/maps-service/src/store/MomentsStore.ts:33` — Same
- `therr-services/maps-service/src/store/SpacesStore.ts:57` — Same
- `therr-services/maps-service/src/handlers/spaces.ts:1053` — Verify address
  is close to provided lat/lng

### 4.6 Test coverage gaps

- `therr-services/users-service/src/handlers/users.ts:331` — Unit test
  needed
- `therr-services/users-service/tests/unit/handlers-helpers-user.test.ts:64`
  — Add tests for `sendEmail` args
- `therr-services/maps-service/src/handlers/createMediaUrls.ts:46` — Test
  cache-control headers
- `therr-services/maps-service/src/store/SpacesStore.ts:508` — Test with
  various interests lists
- `therr-services/push-notifications-service/src/api/firebaseAdmin.ts:617` —
  Make data-only message and test

---

## Tier 5 — Refactoring & Developer Experience

Pure code-quality work. None of these change user-visible behavior. Pick
these up only when in the area for another reason — do not schedule them.

### 5.1 Redux state consolidation (dashboard)

The dashboard repeatedly threads `spacesInView` / `campaignsInView` through
component trees. Hoist to Redux for a single source of truth.

- `therr-client-web-dashboard/src/routes/Campaigns/BaseCampaignsOverview.tsx:47`
- `therr-client-web-dashboard/src/routes/InfluencerPairings/index.tsx:106`
- `therr-client-web-dashboard/src/routes/Dashboards/BaseDashboard.tsx:99`
- `therr-client-web-dashboard/src/routes/Dashboards/OverviewModules/OverviewOfSpaceMetrics.tsx:34`
- `therr-client-web-dashboard/src/routes/Dashboards/OverviewModules/OverviewOfCampaignMetrics.tsx:20`
- `therr-client-web-dashboard/src/routes/ManageSpaces/index.tsx:84`
- `therr-client-web-dashboard/src/routes/Dashboards/BaseDashboard.tsx:207` —
  Get current user spaces and organization spaces from backend (not frontend)

### 5.2 Redux duplication (mobile)

- `TherrMobile/main/routes/ViewUser/index.tsx:330, 355` — "Ugly code for
  reactions" — refactor to consolidated reaction-state pattern
- `TherrMobile/main/routes/ViewUser/index.tsx:409, 422, 433, 446` — Move
  reaction calls from Redux actions to direct service requests where the
  side-effect is unwanted
- `TherrMobile/main/routes/Connect/index.tsx:180, 185` — Connect Redux UI
  prefetch (currently dead state)
- `TherrMobile/main/routes/Notifications/index.tsx:258` — Same prefetch
  pattern
- `TherrMobile/main/components/Input/HeaderSearchUsersInput.tsx:76` — Move
  search state to Redux to share with Contacts page

### 5.3 SQL / store-layer cleanups

- `therr-services/reactions-service/src/handlers/momentReactions.ts:18, 96` —
  Use `INSERT … ON CONFLICT … MERGE` for upserts (also at
  `thoughtReactions.ts:23, 81`, `spaceReactions.ts:65, 172`,
  `eventReactions.ts:18, 72`)
- `therr-services/users-service/src/store/UserConnectionsStore.ts:161` —
  RSERV-25: Make this dynamic to accept multiple queries
- `therr-services/messages-service/src/store/CategoriesStore.ts:22` — Match
  `searchCategories` for infinite scroll
- `therr-services/messages-service/src/store/ForumsStore.ts:87` — Same for
  `searchForums`
- `therr-services/messages-service/src/store/ForumsStore.ts:262, 284` —
  Wrap update in transaction
- `therr-services/messages-service/src/store/ForumCategoriesStore.ts:22` —
  Match `searchForumCategories`
- `therr-services/maps-service/src/store/SpacesStore.ts:673` — Implement use
  of `Categories.ts`
- `therr-public-library/therr-react/src/redux/reducers/content.ts:59` —
  Replace `Set` dedup with `Map` keyed on area ID

### 5.4 Magic strings / constants

- `therr-services/websocket-service/src/index.ts:265` — Use constants for
  disconnect reasons instead of magic strings
- `therr-services/maps-service/src/handlers/spaces.ts:985`,
  `events.ts:1074`, `moments.ts:1267` — Use env variables
- `therr-services/websocket-service/src/store/redisSessions.ts:24, 25, 37, 38`
  — RSERV-4: Namespace by app+ip; create token to send back to frontend
- `therr-services/websocket-service/src/store/redisSessions.ts:5, 11` —
  Strategy for grouping users in rooms; reuse connections
- `therr-api-gateway/src/services/maps/validation/areas.ts:21, 28, 70` —
  Add granularity to media validation
- `therr-api-gateway/src/services/phone/router.ts:91, 134` — Use Redis
  pipeline
- `therr-api-gateway/src/services/maps/limitation/map.ts:36` — Reduce or
  limit to admin users
- `therr-api-gateway/src/store/MapsService.ts:90`,
  `UsersService.ts:19, 27` — Centralize cache invalidation in a base class
- `therr-api-gateway/src/store/index.ts:7` — Move shared store code to
  `therr-public-library`

### 5.5 Mobile UX polish

These small toasts/dialogs each individually look minor but the
post-onboarding feel is the sum of them.

- `TherrMobile/main/components/0_First_Time_UI/onboarding-stages/CreateProfilePhoneVerify.tsx:178`
  — Replace alert dialog with toast
- `TherrMobile/main/routes/Login/LoginForm.tsx:133`,
  `routes/Register/RegisterForm.tsx:294` — RMOBILE-26: UI alert for
  registration failures
- `TherrMobile/main/routes/ViewUser/index.tsx:552, 555, 583` — Success
  toast on follow / unfollow / block
- `TherrMobile/main/routes/Settings/index.tsx:142` — Message when password
  fields don't match
- `TherrMobile/main/routes/Settings/ManageAccount.tsx:111`,
  `Settings/ManageNotifications.tsx:156` — Confirmation modal on destructive
  action
- `TherrMobile/main/routes/Areas/Nearby/NearbyWrapper.tsx:505, 532, 571`,
  `routes/Map/index.tsx:1087, 1172` — Display modal/instructions for
  enabling location after `never_ask_again`
- `TherrMobile/main/components/Input/HeaderSearchInput.tsx:131`,
  `HeaderSearchUsersInput.tsx:95` — Red dot to show filters enabled
- `TherrMobile/main/components/BottomSheet/MapBottomSheetContent.tsx:56` —
  Add last element to prevent final-item cutoff
- `TherrMobile/main/components/UserContent/UserImage.tsx:33` — Image
  cropping fails with some datatypes; upgrade or disable crop initially

### 5.6 Backwards-compat sweeps to drop after rollout

These exist purely as transitional shims. Each carries a "delete after X"
note that should be honored on a calendar reminder.

- `therr-services/maps-service/src/handlers/createMediaUrls.ts:17` —
  "Provides temporary backwards compatibility" — verify if still needed
- `TherrMobile/main/routes/Map/index.tsx:672`,
  `utilities/getActiveCarouselData.ts:129` — Remove `translate()` after
  backwards-compatibility rollout
- `TherrMobile/main/routes/EditMoment/index.tsx:253`,
  `routes/EditSpace/index.tsx:360`,
  `routes/Events/EditEvent.tsx:321`,
  `routes/Groups/EditGroup.tsx:391`,
  `routes/ViewMoment/index.tsx:379`,
  `therr-client-web-dashboard/src/utilities/media.ts:55` — Replace `media`
  field with `medias` after backend migration
- `therr-services/maps-service/src/handlers/moments.ts:653` — Endpoint
  marked for deletion after it has served its purpose (verify zero callers
  before removing)
- `react-native.config.js:10` — LogRocket workaround on Android; re-test
  after a future RN/LogRocket upgrade

### 5.7 Build / config tidy-ups

- `therr-client-web/webpack.app.config.js:121`,
  `therr-client-web-dashboard/webpack.app.config.js:105` — Only load the
  current theme's CSS instead of all themes
- `therr-client-web/src/index.tsx:21`,
  `therr-client-web-dashboard/src/index.tsx:15` — RSERV-8: Use themes
  endpoint to dynamically load theme styles
- `therr-client-web/src/server-client.tsx:38`,
  `therr-client-web-dashboard/src/server-client.tsx:28` — RFRONT-9: Replace
  the `window is undefined` SSR hack
- `therr-client-web-dashboard/src/server-client.tsx:124` — Define all
  favicon variations (sizes, platforms)
- `therr-client-web-dashboard/src/components/Layout.tsx:172` — Persist
  integrations to localStorage with TTL
- `therr-client-web-dashboard/src/api/login.ts:11` — Use scopes needed for
  meta ads / campaigns
- `_bin/pre-commit.sh:16` — Use `CHANGEME.json` to verify dev changes and
  rebuild affected pages
- `_bin/pre-push.sh:16` — Add conditions to prevent bad commits
- `_bin/cicd/publish.sh:104` — Output a list of all services that should be
  deployed for the given commit
- `TherrMobile/env-config.js:43` — Import config from a shared location
  instead of duplicating
- `scripts/generate-content/utils/contentSchema.ts:143` — Implement planned
  new content section types per `docs/CONTENT_GUIDES_ROADMAP.md`

---

# How to maintain this document

## When closing a TODO in code

1. Remove (or update) the source TODO comment as part of the same commit.
2. Delete the corresponding bullet in `WORK_IN_PROGRESS.md` (do **not** strike
   through; the file is not a journal).
3. If the TODO referenced a ticket prefix (`RSERV-`, `RFRONT-`, `RMOBILE-`,
   `RDATA-`), search the file for siblings — these are usually clusters that
   were intended to be closed together.

## When discovering a new TODO

Add it to the appropriate tier. If you can't decide between two tiers, place
it lower (the cost of under-prioritizing is a delay; the cost of over-
prioritizing is wasted top-of-list attention).

Use the same one-line format as existing entries: `path:line — short verb-
phrase description`. Keep it terse — this file is read by humans and agents
many times more often than it's written.

## When adding a Manual Operational Follow-up

Append to **§ Manual Operational Follow-ups** with a checkbox. If the item
was generated by a skill run, place it under "Skill-generated items" between
the `<!-- skill-followups:start -->` and `<!-- skill-followups:end -->`
markers, prefixed with the date and originating skill:

```
- [ ] (2026-04-26, /quality-peer-review) Run main.userDeviceTokens migration on
  users-service after deploy — required by Phase 5 brand-isolation work.
```

When a follow-up is completed, **delete** the line. Do not move it to a Done
section — this list is meant to be short.

## When two trackers seem to overlap

`WORK_IN_PROGRESS.md` (this file) is for long-standing code TODOs and
post-deploy operational steps. `PEER_REVIEW_FOLLOWUP.md` is for residue
deferred during a specific peer review. If a peer-review item is
broadly applicable beyond that single review, link it from here too. Don't
duplicate the body — a one-line cross-reference is enough.

## Audit cadence

A full re-audit (`grep -rn "TODO\|FIXME\|HACK\|XXX"` across the monorepo
followed by tier reassignment) is cheap and worth running:

- After any major feature ships (scan for resolved TODOs to delete)
- Before each quarterly planning cycle (re-tier; demote stale items to
  Tier 5 or remove)
- Whenever the file grows past ~600 lines (signals stale entries
  accumulating)
