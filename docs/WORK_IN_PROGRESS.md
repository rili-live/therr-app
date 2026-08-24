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
> - `therr-workspace/docs/MARKETING_ATTRIBUTION_PLAN.md` — **cross-repo**
>   (therr-app + therr-landing + GA4 config). Phased plan to make the B2B funnel
>   measurable: UTM tagging and capture, a real `purchase` event, claim-funnel
>   instrumentation, GA4 property consolidation, then the Google Analytics MCP.
>   Audited 2026-08-07; it is the concrete build-out of `docs/AUTOMATION_ROADMAP.md`
>   #7. Its Phase 2 is the same missing post-checkout hop as § 1.5 below — build
>   the two together.

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
- [ ] **Re-verify `/.well-known/` responses** after any change to the static
  middleware in either web server (`therr-client-web/src/server-client.tsx`,
  `therr-client-web-dashboard/src/server-client.tsx`). `express-static-gzip@3`
  bundles its own `serve-static`/`send`, whose `dotfiles` default is `'ignore'`,
  so any dot-directory path that stops being explicitly routed falls out of the
  static middleware into the SSR catch-all and answers **HTTP 200 with an HTML
  page** — no 404, no alert, and Android App Links verification silently stops
  passing. Confirm every claimed host returns `application/json`:
  `for h in therr.com www.therr.com habits.therr.com www.habits.therr.com dashboard.therr.com; do curl -s -o /dev/null -w "$h %{http_code} %{content_type}\n" https://$h/.well-known/assetlinks.json; done`
- [ ] **Verify Stripe webhook signature secret** is set in production env after
  a webhook handler change (`therr-services/users-service/src/api/stripe.ts`).
  Mismatched secrets silently 401 — no error is surfaced to the user.
- [ ] **Warm up AWS SES sender reputation** before scaling unclaimed-space
  email batches. Stay ≤ 50/day for the first week; monitor bounce rate < 5%
  in the AWS SES dashboard. See `docs/GROWTH_STRATEGY.md` Email Deliverability.
- [ ] **Confirm Firebase / FCM credentials match the brand variation being
  deployed** (`therr-services/push-notifications-service/src/api/firebaseAdmin.ts`).
  Per-brand Firebase apps are loaded by env var; a stale value will silently
  send pushes from the wrong project. Verify without guessing:
  `GET /v1/push-notifications-service/notifications/diagnostics` (SUPER_ADMIN)
  reports the resolved project id and apns topic per brand — see
  `docs/PUSH_NOTIFICATIONS_DEBUGGING.md`.
- [ ] **Run unconsumed migrations** on each service after any change under
  `therr-services/<service>/src/migrations/**` lands on `main`.
  **Now automated for `main` deploys** via `_bin/cicd/run-migrations.sh`
  (invoked from `_bin/cicd/deploy.sh`): it runs `npm run migrations:run` inside
  the freshly rolled-out pod for each of the five migration-owning services
  whose `src/store/migrations` changed. Still run manually when the opt-out
  (`RUN_MIGRATIONS_ON_DEPLOY=false`) is set, for stage/non-`main` DBs, or to
  apply a migration ahead of its image. Command per service:
  `npm run migrations:run` (verify per-service `package.json`).
- [ ] **Invalidate CDN cache for assets** (`docs/CLOUDFLARE_CDN.md`) after any
  change to global CSS, brand assets, or favicons.
- [ ] **Add any new web origin to `URI_WHITELIST`** in
  `k8s/prod/api-gateway-service-deployment.yaml` in the same change that adds it
  to `k8s/prod/ingress-service.yaml`. Production CORS is enforced
  (`therr-api-gateway/src/index.ts` uses `cors(corsOptions)` gated on
  `URI_WHITELIST`), and a missing origin surfaces only as a preflight with no
  `Access-Control-Allow-Origin` — which reads like a frontend bug, not a config
  one. This exact gap broke `dashboard.therr.com` login in July 2026. After
  applying, confirm the env is live on the running pod rather than just in the
  image: `kubectl set env deployment/api-gateway-service --list | grep URI_WHITELIST`.
  Mobile is unaffected (it sends no Origin header).
- [ ] **Verify users-service reaches the ephemeral Redis after deploy.**
  `REDIS_EPHEMERAL_HOST`/`REDIS_EPHEMERAL_PORT` were missing from
  `k8s/prod/users-service-deployment.yaml` while `src/store/redisClient.ts`
  read them. `Number(undefined)` is `NaN`, so ioredis rejected the socket
  outright rather than falling back to a default — production logs
  `RangeError [ERR_SOCKET_BAD_PORT]` on every boot and the client never
  connects, so cross-app handoff codes and the thought-distributor gate have
  never worked in production. Confirm the pod logs `users-service connected to
  ephemeral Redis` (and no `REDIS_EPHEMERAL_CONNECTION_ERROR`), then exercise
  one handoff.

## Marketing attribution (docs plan: `therr-workspace/docs/MARKETING_ATTRIBUTION_PLAN.md`)

Phases 1–4 have shipped in code. These are the steps code cannot do — external
console configuration, and one verification that gates a payments change.

- [x] **Verify the plan → Stripe product mapping before enabling Checkout Sessions.**
  Done 2026-08-12: the ids in
  `therr-services/users-service/src/handlers/helpers/checkoutSessionPlans.ts` were confirmed
  against the Stripe dashboard and `isStripeCheckoutSessionsEnabled` is now `true` in every
  env block. Checkout Sessions therefore serve **production** buyers; the legacy Payment
  Links remain only as the in-code fallback when session creation fails.
- [ ] **Run one live-mode purchase per plan now that the flag is on.** Confirm the amount,
  the 14-day trial, and that `/payment-complete/:sessionId` grants the right access level for
  basic, advanced and pro. The flag is armed in production, so a wrong price or a missed
  grant now affects real customers rather than falling back to a Payment Link.
- [ ] **Add `stripe.com` to the GA4 referral exclusion list** (Admin → Data Streams → the
  stream → Configure tag settings → List unwanted referrals). Checkout redirects off-site
  and back, so without this the return is attributed to `stripe.com / referral` and the
  `purchase` event is severed from the campaign that produced it — which defeats the point
  of moving off Payment Links.
- [ ] **Configure cross-domain measurement in GA4 admin** for therr.app, therr.com,
  business.therr.com, dashboard.therr.com, habits.therr.com (Admin → Data Streams →
  Configure tag settings → Configure your domains). The tag-side `linker` config is now
  deployed on all surfaces, but it only decorates outbound links — the receiving property
  honours `_gl` only when the admin list includes the domain.
- [ ] **Register `surface` as an event-scoped custom dimension** in GA4 admin. Every hit now
  carries it (`landing` / `web` / `dashboard`); without registration it is collected but
  not reportable, and the three surfaces cannot be separated after consolidation.
- [ ] **Mirror the consolidated GA4 measurement id into `therr-landing`.** The property exists
  and `global-config.js` → `googleAnalyticsKeyUnified` is set to `G-R7CY0Z1ZRM` in all three
  env blocks, so this repo's clients already dual-report. Still owed: the commented block in
  `therr-landing/index.html` (a sibling repo — no CI here covers it), or the landing page
  keeps reporting into the old property alone. GA4 cannot backfill across properties, so
  leave the old properties running for at least a month before retiring them.
- [ ] **Set up the Google Analytics MCP** and run the loop —
  `therr-landing/.claude/commands/marketing-loop.md` has the analysis; the plan doc's
  Phase 5 has the three setup commands. Client-side config, not a repo artifact.

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
- [ ] (2026-08-15, habits-production-readiness) **Create the Google Play in-app product before
  the paywall can work.** Product id `habits_lifetime_founder` on `com.therr.habits`, one-time
  **non-consumable**, $20 USD, active. In-app products do not resolve until the app is published
  on a track, so this must happen on the same release that ships the paywall. If the id differs
  from the default, set `HABITS_LIFETIME_PRODUCT_ID` to match — the server validates the id on
  every verification and will reject a token bought under a different SKU.
  **Prerequisite:** Play Console hides the "In-app products" section entirely until a track has an
  uploaded artifact declaring `com.android.vending.BILLING`. Every `com.therr.habits` build up to
  versionCode 23 predates `react-native-iap`, so the first upload that unlocks the section is the
  one built from the manifest change in `TherrMobile/android/app/src/main/AndroidManifest.xml` —
  bump `versionCode` past whatever is already on the track, `npm run build:release`, and upload to
  internal testing before trying to create the product.
- [ ] (2026-08-15, habits-production-readiness) **Create a Play Console service account and set
  `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` + `GOOGLE_PLAY_PACKAGE_NAME` in the prod users-service
  secrets.** The account needs "View financial data, orders, and cancellation survey responses"
  — that is the permission `purchases.products.get` checks. The value may be raw JSON or base64.
  Until it is set, `GET /habits/lifetime` reports `isStoreConfigured: false` and the client hides
  the CTA, so the failure mode is a missing offer rather than a broken purchase.
- [ ] (2026-08-15, habits-production-readiness) **Re-answer the Play Data Safety form for
  `com.therr.habits`.** `docs/niche-sub-apps/HABITS_PLAY_LISTING.md` currently declares Financial
  info "No" and Purchase history "No", justified by there being no payment path. Adding Play
  Billing changes that answer, and the listing doc's own note says to re-evaluate if a payment
  path is added. Update the doc and the console together.
- [ ] (2026-08-15, habits-production-readiness) **Add license testers in Play Console** before
  QAing the purchase flow — a test purchase comes back with `purchaseType: 0` (`1` is promo, `2` is
  rewarded) and is the only way to exercise verification end to end without spending real money.
- [ ] (2026-08-15, habits-production-readiness) **Unset `HABITS_FREE_PACT_LIMIT` on the prod
  users-service** after this deploy. Nothing reads it any more; the cap is now
  `HABITS_FREE_HABIT_LIMIT` (default 5, on habits tracked rather than pacts created). Harmless if
  left, but it will mislead the next person who greps for it.
- [ ] (2026-08-15, habits-production-readiness) **Run the three new migrations** on users-service
  (`20260815000001` user_habits, `20260815000002` lifetime_purchases, `20260815000003`
  journal_entries). The first backfills `habits.user_habits` from existing streaks and active pact
  memberships — verify it produced rows before the mobile release ships, or every existing user
  sees an empty dashboard and can re-add habits past the cap:
  `SELECT count(*) FROM habits.user_habits;`
- [ ] (2026-08-15, habits-production-readiness) **Play refunds are not yet handled.** A refunded
  or charged-back buyer keeps `HABITS_LIFETIME` indefinitely — `habits.lifetime_purchases.status`
  and `LifetimePurchasesStore.setStatus` exist for it, but nothing consumes Play's Real-Time
  Developer Notifications. Until a Pub/Sub subscriber lands, revocations have to be done by hand.
- [ ] (2026-08-14, /work-plan) **Password change from web and dashboard starts working
  after this api-gateway deploy — it has been returning 400.** `PUT /users-service/users/change-password`
  was registered after `PUT /users/:id`, so express matched the param route and
  `updateUserValidation`'s leading `param('id').exists().isUUID(4)` rejected the literal
  segment `change-password` before the proxy ran. Both surfaces reach it through
  `therr-react`'s `UsersService`, so nobody could change a password from the web; the error
  reads as a client payload problem, which is why it survived. Confirm one real password
  change end to end after deploy. Note the request never reached users-service, so there is
  no bad data to repair — but if support tickets exist for "the password form is broken",
  this is them.
- [ ] (2026-08-14, /work-plan) **api-gateway now refuses to boot if a route is shadowed.**
  `assertNoShadowedRoutes` (`src/utilities/routeOrdering.ts`) runs after the router mounts
  in `src/index.ts` and throws, so a bad route ordering crash-loops the pod rather than
  serving a broken chain. The same check runs in CI over the real router
  (`tests/unit/utilities/routeOrdering.test.ts`), so this should never be how you find out —
  but if api-gateway ever crash-loops right after a deploy that added a route, read the
  boot log: the error names both the unreachable route and the one claiming it, and the fix
  is to register the literal route before its `:param` sibling.
- [ ] (2026-08-14, /work-plan) Seven previously-shadowed routes now run their own middleware
  chain for the first time — expected, no action unless something regresses. They already
  proxied to the right downstream path (`handleServiceRequest` forwards `req.url` verbatim),
  so this changes only which gateway middleware they pass through:
  `GET /users/notifications` and `GET /users/organizations` no longer run `GET /users/:id`'s
  `authenticateOptional`; the four `social-sync/oauth2-*` callbacks no longer run
  `/social-sync/:userId`'s chain; `GET /forums/categories` no longer runs
  `GET /forums/:forumId`'s. Watch for auth-shaped 401s on those six read paths after deploy.
- [ ] (2026-08-12, /work-plan) **Subscription upgrades now require the Stripe billing email to
  match the account — watch for legitimate purchases that stop upgrading.** `register`, `login`
  and `activateUserSubscription` all grant a plan's access level only when the Checkout
  Session's billing email normalizes to the claiming account's email. Previously
  `activateUserSubscription` granted to whoever presented the session id, so a customer who
  paid Stripe with a *different* address than their Therr account (a personal card on a work
  account, or vice versa) was upgraded then and will not be now. They fail closed and silently:
  the response still 200s with `isAccessLevelUpdated: false`. The signal is the warn span
  `Checkout session billing email does not match the account claiming it` — if it fires for
  real customers rather than probes, the fix is an explicit "link this purchase" confirmation,
  not widening the match. Note the subscription webhook has always keyed off the same billing
  email, so those customers were already relying on manual rectification.
- [ ] (2026-08-12, /work-plan) **Free-trial signups will start upgrading on the redirect
  instead of on the webhook — expected, watch the volume.** `activateUserSubscription` gated on
  `payment_status === 'paid'`, which a trial-only Checkout Session never satisfies
  (`no_payment_required`), so trials were upgraded solely by `customer.subscription.*`. Both
  paths now grant, and both are idempotent (the levels are unioned, not replaced), so a double
  grant is a no-op. If trial conversions look like they jumped, this is why — the upgrade was
  always meant to happen, it just used to depend on the webhook arriving.
- [ ] (2026-08-12, /work-plan) Optional one-off audit for accounts damaged by the
  `getUserByEmail` bug fixed in this batch: an `activateUserSubscription` call with no
  `x-userid` used a lookup that omits `accessLevels`, so the update **replaced** the account's
  levels with just the subscription level. Symptom is an account holding a
  `DASHBOARD_SUBSCRIBER_*` level and nothing else — login rejects it for lacking
  `EMAIL_VERIFIED`, which reads to the user as "my password stopped working" right after
  paying. Query: `SELECT id, email, "accessLevels" FROM main.users WHERE "accessLevels"::text
  LIKE '%DASHBOARD_SUBSCRIBER%' AND "accessLevels"::text NOT LIKE '%EMAIL_VERIFIED%';` Repair
  by re-adding the missing levels; the fix only stops new occurrences.
- [ ] (2026-08-12, /work-plan) **After the reactions-service deploy, confirm event RSVP still
  persists.** Reaction write columns are now allow-listed
  (`reactions-service/src/utilities/pickReactionWriteFields.ts`) instead of spread from
  `req.body`, so any client field not on a list is silently dropped. `attendingCount` is the one
  that would not have been found by reading the validators — mobile's ViewEvent attending modal
  sends it on `POST /event-reactions/:eventId`, and the gateway's
  `createOrUpdateEventReactionValidation` does not declare it. It **is** on the event allow-list,
  but it is the field to check by hand: set an RSVP with a guest count on a real device and
  confirm `main."eventReactions"."attendingCount"` holds the value after a reload. If any other
  undeclared field turns out to be in use, its symptom is the same — the write 200s and the value
  quietly does not persist, with nothing in the logs. No migration, no env var.
- [ ] (2026-08-12, /work-plan) Optional one-off audit of rows written before the allow-list, all
  of which were client-settable: `SELECT count(*) FROM main."thoughtReactions" WHERE
  "relevanceScore" IS NOT NULL AND "algorithmKey" IS NULL;` — a scored row with no algorithm
  recorded cannot have come from the distributor, which always sends the two together. Also
  `SELECT count(*) FROM main."momentReactions" WHERE "contentLatitude" IS NOT NULL;` (same for
  `spaceReactions` / `eventReactions`): nothing in the monorepo has ever written those columns, so
  any non-zero result is client-supplied geo. Expect zero on both. The allow-list only stops new
  writes; it does not repair history.
- [ ] (2026-08-12, /work-plan) **TherrCoin rewards start being awarded after this deploy —
  expected, watch the balances.** `updateUserCoins` passed
  `userSearchResults[0] + req.body.settingsTherrCoinTotal` to the store: the whole user row
  rather than the column, so the value stringified to `"[object Object]<delta>"`, failed
  `UsersStore.updateUser`'s `settingsTherrCoinTotal > 0` guard, and **no reaction has ever
  awarded a coin through this path**. It now passes the delta the store expects. Volume is
  bounded by `getReactionValuation` and still gated on `settingsPushBackground`, but the
  baseline is zero, so treat the first days as the real baseline rather than a regression.
  Note negative valuations remain dropped by that same store-side `> 0` guard — deliberately
  left alone, since fixing it would start applying penalties that have never applied. No
  migration, no env var; the route (`PUT /users/:id/coins`) is internal-only and unchanged.
- [ ] (2026-08-12, /work-plan) After the users-service deploy, watch for users landing in a
  re-verify-phone state they did not expect. A profile save that changes `phoneNumber` now
  revokes `MOBILE_VERIFIED`, which gates bulk `multi-invite` at the gateway. This is correct
  — the level attested to the *old* number — and the recovery routes now exist (tappable
  toast, profile checklist, `therr.com/verify-phone` deep link, `/verify-phone` on web). The
  caveat that remains is version skew: **the already-deployed app has none of them**, so an
  existing install that hits this sees only the old dead-end toast. Until a mobile release
  ships, the web route is the only recovery path for those users — worth knowing before
  answering a support ticket. Verify after deploy that `/verify-phone` renders for a signed-in
  user whose profile is already complete (it is gated `ANY` on EMAIL_VERIFIED /
  EMAIL_VERIFIED_MISSING_PROPERTIES precisely so that user is not bounced to `/create-profile`).
- [ ] (2026-08-12, /work-plan) Smoke-test `habits.therr.com/verify-phone` after the web deploy,
  end to end on a real handset: sign in, request a code, enter it, then confirm
  `main."users"` shows the new number **and** `MOBILE_VERIFIED` in `accessLevels` for that row.
  New `habits/verify-phone.hbs` — the habits-subdomain counterpart of the React
  `/verify-phone` route, since that host short-circuits React SSR and hard-404s anything
  outside its allowlist. Two things are worth watching specifically. (1) It calls
  `POST /phone/verify` then `POST /phone/validate-code` and makes **no** follow-up write —
  `validate-code` already persists the number and grants MOBILE_VERIFIED server-side via
  `PUT /users/:id/verify-phone`, so a second write would be redundant here (the React routes
  still make one, but only to refresh their Redux store). (2) It reads `therrUser` from
  storage in the **flat** shape `habits/login.hbs` writes and `store.tsx` wraps in `details`;
  a change to either side breaks the session handoff silently, showing the signed-out state
  to a signed-in user. `habits/login.hbs` also gained `?returnTo=` support (same-origin
  relative paths only) so the signed-out state can round-trip back here.
- [ ] (2026-08-12, /work-plan) Optional one-off audit: `SELECT count(*) FROM main."users" u
  WHERE u."billingEmail" IS NOT NULL AND EXISTS (SELECT 1 FROM main."users" o WHERE o.id <>
  u.id AND (o.email = u."billingEmail" OR o."billingEmail" = u."billingEmail"));` The new
  guard only stops *new* claims. Any pre-existing row where one account's `billingEmail`
  matches another account's login email is currently able to capture that other user's Stripe
  checkout attribution (`payments.ts` resolves via `getUserByEmail(billingEmail)`) and
  receives their billing mail. Expect zero — no client has ever sent the field — but it is
  cheap to confirm rather than assume.
- [ ] (2026-08-11, /work-plan) **Deploy order for the account-deletion fan-out: messages-service
  and websocket-service before users-service.** users-service now issues
  `DELETE /delete-user-data` to both, and neither endpoint existed before this change. If
  users-service rolls out first, every account deletion in the window logs
  `Failed to delete user data` with `service.name` of the lagging service and leaves that
  service's rows behind — the user row is already gone by then, so there is nothing to retry
  from afterwards. The fan-out is `allSettled`, so this degrades rather than 500s, which is
  exactly why it needs watching rather than alerting. No migration and no new env var:
  `baseWebsocketServiceRoute` is derived in `global-config.js` from the existing
  `websocket-service-cluster-ip-service` (port 7743), which is already deployed.
- [ ] (2026-08-11, /work-plan) After the deploy, confirm one real account deletion end to end:
  the response is still 200, and `main."notifications"`, `main."notificationQueue"`,
  `main."directMessages"`, `main."forumMessages"` hold zero rows for that user id **under every
  brand**, while `main."forums"` they authored now show `authorId` = the environment's
  `SUPER_ADMIN_ID` rather than having disappeared. The brand half is the part worth checking by
  hand — these deletes are intentionally unscoped, and a regression that re-scopes them would
  look correct for a single-brand test user.
- [ ] (2026-08-04) **Finish credential sharing now that `/.well-known/assetlinks.json` actually serves.** The `delegate_permission/common.get_login_creds` relation is live on `therr.com`/`www.therr.com` (`app.therrmobile`) and `dashboard.therr.com`, and the web login form now sends `autocomplete="username"` / `"current-password"` so Chrome has a credential worth sharing. Three gaps remain, each a decision rather than an oversight: (1) `assetlinks.habits.json` still declares only `handle_all_urls`, so Friends with Habits (`com.therr.habits`) gets App Links but no credential sharing — add the relation there if HABITS should share credentials with `habits.therr.com`. (2) `get_login_creds` is Android-only; the iOS equivalent is shared web credentials, which needs `webcredentials:therr.com` in `TherrMobile/ios/Therr/Therr{Debug,Release}.entitlements` (currently `applinks:therr.com` only) **and** a `webcredentials: { apps: ['22AN4MZ6H5.com.therr.mobile.Therr'] }` block alongside `applinks` in the `appLinksJson` object in `therr-client-web/src/server-client.tsx`. (3) That same AASA is served at `/apple-app-site-association` but its `/.well-known/` twin is still commented out one line below — Apple's CDN fetches the `.well-known` path, which now works, so uncomment it. Verify on-device after deploy: save a password on the website, then confirm Android offers it in the app — that is the only end-to-end proof the association resolved.
- [ ] (2026-08-10, notification-queue) **Update `therr-messaging-automator` now that the
  digest dedups.** Sibling repo, separate PR. `src/api/habitsDigest.ts` still documents the
  endpoint as having "NO internal dedup" and treats an `ECONNABORTED` timeout as
  `dispatched-pending` explicitly to avoid a retry that would double-send. Both are now
  false: a retry conflicts on the UNIQUE (brandVariation, userId, dedupeKey) constraint.
  Fix the comments, and consider retrying on timeout. Also add `deduped` to
  `IHabitsDigestCounters` — the existing `*Sent` fields kept their names for compatibility
  but now count rows *queued*, and `deduped` is the only field that distinguishes a second
  run of the day from a quiet one.
- [ ] (2026-08-08, notification-queue) **No push preference is honored server-side — fix
  before raising send frequency.** `settingsPushMarketing`, `settingsPushBackground`,
  `settingsPushInvites`, `settingsPushLikes`, `settingsPushMentions` and
  `settingsPushTopics` are real columns, settable through the API and carried by
  `therr-react`, and `sendEmailAndOrPushNotification` reads none of them (it checks only
  `isUnclaimed`). `TherrMobile/main/routes/Settings/ManageNotifications.tsx` renders email
  toggles only. So a user's sole control over push is the OS switch, which is
  all-or-nothing. The queue worker is the natural enforcement point — mark such rows
  `skipped`, not `failed`, so suppression stays measurable.
- [ ] (2026-08-08, notification-queue) **Add a user timezone column.** Nothing in the
  schema records one, so the daily digest's "run it in the evening" is evening in exactly
  one timezone worldwide. `notificationQueue.scheduledFor` exists and cannot mean anything
  but "now" until this lands. Prerequisite for roadmap item #2 (send-time personalization,
  15-40% on opens).

- [ ] (2026-08-07, push-notifications-debug) **Seven HABITS notification types have no
  sender.** `dailyHabitReminder`, `morningMotivation`, `eveningCheckIn`, `streakBroken`,
  `newPersonalRecord`, `partnerCelebrated` and `pactCompleted` have copy in all three
  locales, Android channel routing, per-brand intent actions and test coverage — and
  nothing in this repo ever calls them. They are not scheduled on-device either
  (`sendTriggerNotification` is used only by Moments/Events). The daily-reminder loop,
  which `docs/PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md` treats as the core HABITS
  retention mechanic, is therefore delivery-half-only. Decide per type: wire a trigger
  (the digest at `habitsDigest.ts` is the natural home for the daily three, and it now
  queues through `enqueueNotification`, so a new type there gets dedup and the 5/day cap
  for free — give it a period-stamped `dedupeKey`), schedule them
  locally via Notifee, or delete the dead copy. Verify with:
  `grep -rn "Types.dailyHabitReminder" --include=*.ts therr-services/ | grep -v push-notifications-service`

- [ ] (2026-08-07, push-notifications-debug) **Verify the iOS APNS-topic fix on a real
  Habits handset after this deploys.** `apns-topic` for HABITS/TEEM was
  `com.therr.mobile.habits` / `com.therr.mobile.Teem` — bundle ids no Xcode target
  builds — so APNS silently dropped every *data-only* push to an iOS Habits install
  (streakAtRisk, partnerCheckedIn, all 21 pact/partner types) while FCM reported
  success and the service logged "Push successfully sent". Display-type pushes
  (dailyHabitReminder, morningMotivation, eveningCheckIn, streakBroken, pactDeclined)
  set no apns block and were unaffected, as was all of Android. Now addressed to
  `com.therr.mobile.Therr`, which is what an iOS Habits build actually is.
  Confirm with `./_bin/push-debug.sh --user <id> --brand habits --device-token <t> --send`
  and a `pact-invitation`. If Habits later ships its own iOS target, change
  `iosApnsTopic` in the same commit — the pbxproj-reading test in
  `brandRouting.test.ts` will fail until you do.
- [ ] (2026-08-03, /quality-peer-review) **Habits partner push volume will rise after this deploy — expected, watch it anyway.** `createCheckin` now resolves the active pacts backing a check-in's habit goal (`PactsStore.getActiveByUserAndHabitGoal`) instead of relying on a `pactId` no client has ever sent. Three code paths behind the old `if (pactId)` guard were dead and go live at once: the `partnerCheckedIn` push, mid-pact Wing Person achievement credit, and writes to `habit_checkins.pactId`. A per-pact mute already applies to the push (`shouldMuteNotifs` / `celebratePartnerCheckins`, honored via `selectPactPartnerIds({ onlyCelebrating: true })`) and recipients are deduplicated across pacts, so the ceiling is one push per check-in per active pact-mate — but nobody has ever received one, so treat the first days' volume as the real baseline rather than a regression. No migration, no env var.
- [ ] (2026-08-03, /quality-peer-review) Optional one-off backfill of `habits.habit_checkins."pactId"`. Every check-in row written before the deploy above has a NULL `pactId`, so `GET /pacts/:pactId/checkins` stays empty for all historical activity even though new check-ins populate it. `HabitCheckinsStore.createOrUpdate` backfills the column on conflict, so a row self-heals only if that user re-submits the same (habitGoalId, scheduledDate). A backfill would set `pactId` from the earliest-started active pact on each row's `habitGoalId` for that user — the same attribution rule the handler uses. Purely cosmetic for pact history views; derived progress stats do not read this column (see `utilities/pactMemberStats`), so nothing is blocked on it.
- [ ] (2026-08-03, /quality-peer-review) Web/mobile users carry one stale `user.userInView` through the first load after the persistConfig transform deploys. `stripUserInView` drops the key on the way *into* storage only — the outbound transform is deliberately identity (`persistConfig.test.ts`: "rehydrates whatever is in storage without alteration") — so a blob already in localStorage/AsyncStorage rehydrates its old `userInView` once, and is clean from the next persist write onward. This is the same one-launch window the `version` bump in the 2026-08-02 entry above would close for every persisted slice at once; decide the two together rather than adding an outbound strip just for this key.
- [ ] (2026-08-02, /quality-peer-review) Confirm the Friends with Habits Play listing (`com.therr.habits`) resolves for a signed-out, non-tester browser before this web deploy goes public. The habits landing page CTA changed from a disabled "Coming soon" placeholder to a live link at `play.google.com/store/apps/details?id=com.therr.habits`, and an *open* testing track only serves that URL to accounts that joined via the opt-in link — a closed track returns "item not found". If the track is still closed, the landing page's only CTA dead-ends. Same URL is now used by `landing.hbs`, `verify-account.hbs`, `invite.hbs` and `ClaimPactLanding.tsx`, so one check covers all four. Purge any CDN/edge cache for `/habits` after deploying, since the previous HTML said "Internal testing in progress".
- [ ] (2026-08-02, /quality-peer-review) Mobile follow-up (must land on `niche/HABITS-general` / `TherrMobile`, not `general`): the profile response now reports `isNotConnected: true` for PENDING/DENIED/BLOCKED rows, where it previously reported `false`. In the **already-deployed** app `UserDisplayHeader.getActionableOptions` sent that case to the "connected" branch and left `remove-connection-request` in the overflow menu, which was the only way to withdraw a pending request; it now falls to the pending branch, and `pending-connection-request` is commented out of `actionMenuOptions`, so the menu shows neither. Uncomment that option (or add a cancel action) and wire it to the withdraw path. The server change is correct and should not be reverted — but the deployed app cannot be force-updated, so the gap persists until a mobile release ships.
- [ ] (2026-08-02, /quality-peer-review) Decide whether to bump `version` in `therr-public-library/therr-react/src/redux/persistConfig.ts` (currently `1`). `purgeOnLogoutMiddleware` now clears persisted state on logout in web as well as mobile, but only on a *future* logout — browsers and installs that already hold a previous account's `content` / `userConnections` / `notifications` keep them until that account signs out again. A version bump with no migrate function makes redux-persist discard the old payload for everyone on next load, which is the only way to clear the existing leak. Note this is shared config: bumping it purges mobile too, costing one cold feed/notification fetch per user.
- [ ] (2026-08-01, /quality-peer-review) Niche follow-up on `niche/HABITS-general`: `GET /users-service/habits/goals/` (`getUserHabitGoals`) now returns goals the user **joined** via an accepted pact, not just ones they created. The Habits habit-list UI renders an edit/delete affordance per row, but `updateHabitGoal` and `deleteHabitGoal` both gate on `createdByUserId` and will 403 / no-op for a joined goal. Hide or disable those controls when `goal.createdByUserId !== me`. Backend behaviour is correct and this is UI-only, so it cannot be fixed on `general`.
- [ ] (2026-08-01, /quality-peer-review) Bump and submit the iOS build for the 3.12.4 release. `TherrMobile/android/app/build.gradle` moved to `versionName 3.12.4` / `versionCode 443`, but `TherrMobile/ios/Therr.xcodeproj/project.pbxproj` is still `MARKETING_VERSION = 1.70.0` / `CURRENT_PROJECT_VERSION = 212`. iOS uses a separate version scheme, so this is a bump-and-submit step, not a value to copy across. (Supersedes the earlier 3.12.1 entry — Android has since moved three times with no matching iOS submission, so the two stores are now three releases apart.)
- [ ] (2026-07-21, bot-personas) Run the `005_bot_users.js` seed on production users-service (`npm run seeds:run` from `therr-services/users-service`) — creates 10 persona-matched bot accounts (isBot=true) for therr-ai-automator content generation. Idempotent (fixed UUIDs, ON CONFLICT DO NOTHING). Optionally set `BOT_SEED_PASSWORD` beforehand; bots never log in, so the default hash is only a placeholder.
- [ ] (2026-07-30, /work-plan) After the reaction-metrics bounds deploy, watch api-gateway for a rise in 400s on `POST /v1/reactions-service/{moment,thought,space,event}-reactions/:id`. Every client today sends `userViewCount: 1` (`TherrMobile/main/routes/Map/TherrMapView.tsx`) and no client sends `userBookmarkPriority`, so legitimate traffic should never trip the new bounds (view count 0–100, bookmark priority 0–100, rating 1–5) — a sustained 400 rate means either a client path nobody mapped or a real abuse attempt, and the two are worth telling apart before widening the range. Note the already-deployed mobile app cannot be force-updated, so a bad assumption here reaches users who cannot upgrade away from it. No migration and no env var; bounds live in `therr-js-utilities/constants` → `Reactions`.
- [ ] (2026-07-30, /work-plan) One-off data check before trusting space ratings: `rating` was previously unbounded, so any existing `main."spaceReactions"` / `main."eventReactions"` row outside 1–5 is still averaged into the rating shown on public space pages. Query `SELECT COUNT(*) FROM main."spaceReactions" WHERE rating IS NOT NULL AND (rating < 1 OR rating > 5);` (and the same for `eventReactions`) — if it returns non-zero, those rows need clearing or clamping, since the new validation only stops *new* bad writes.
- [ ] (2026-07-28, dwelling-location-notifications) Post-deploy tuning check: watch for the `BackgroundGeolocation - Suppressing nearby push notifications at dwelling location` info span. If it fires for places users clearly do not live (a daily-commute office, a gym), raise `Location.DWELL_MIN_DISTINCT_DAYS` from 3; if users still report notification spam at home after ~a week of data, lower `Location.DWELL_LOCATION_RADIUS_METERS` scrutiny first (both live in `therr-public-library/therr-js-utilities/src/constants/Location.ts`).
- [ ] (2026-07-29, /quality-peer-review) **Notification volume will drop after this deploy — expected, watch it anyway.** `UserLocationCache.setLastMomentNotificationDate`/`setLastSpaceNotificationDate` passed `this.keys.<x>KeyPrefix`, which was always `undefined` (`this.keys` holds hash *field* names, not key prefixes). ioredis coerces a nullish key to the empty string rather than throwing, so every write silently landed on the bare client keyPrefix while the getters read the real per-user hash — `hasSentNotificationRecently()` therefore always returned falsy and `MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS` (3 min) has never been enforced since the method was written in `165d2a30e`. Now fixed. Two effects: proximity-required area pushes are throttled to one per 3 min, and `activateAreasAndNotify` will skip the `NEW_AREAS_ACTIVATED` in-app notification *and* push for 3 min after any moment/space notification (it gates on both dates being stale — pre-existing logic that was simply never reachable). If engagement metrics dip after deploy, this is the cause and the lever is `MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS` in `therr-public-library/therr-js-utilities/src/constants/Location.ts`. Also worth a one-off cleanup: the stray `push-notifications-service:` hash (empty-suffix key, no TTL) that accumulated these writes in each environment can be deleted.
- [ ] (2026-07-29, /quality-peer-review) Dwellings are now cached in redis for 6 hours (`DWELLING_CACHE_TTL_SEC`, key `push-notifications-service:user:<id>:dwelling-locations`). Two consequences for the tuning work above: (1) a change to `DWELL_MIN_DISTINCT_DAYS` or `DWELL_LOCATION_RADIUS_METERS` will not take full effect until cached entries expire — flush the `*:dwelling-locations` keys after deploying a constant change if you want an immediate read; (2) when judging whether suppression is working, remember a newly-qualifying dwelling can take up to 6 hours to start suppressing. The key is deliberately excluded from `clearCache()`/`invalidateCache()`, so travelling does not evict it.
- [ ] (2026-07-28, /quality-peer-review) Expectation-setting for the dwelling rollout: the migration's backfill recovers almost no day history, so dwelling suppression will look like it is doing nothing for the first ~3 days after deploy. Before this change the create/on-conflict merge only bumped `visitCount` and left `updatedAt` at its insert value, so for nearly every existing row `updatedAt = createdAt`, the spanned-day count lands on 1, and `distinctDayCount` backfills to 1. Only rows where the user explicitly set `isDeclaredHome` are recognized immediately. Do **not** read a quiet first day or two as a broken feature or start tuning `DWELL_MIN_DISTINCT_DAYS` off it — wait for the tuning check above to have real data.
- [ ] (2026-07-27, reward-claim-feedback) Rebuild the mobile native projects for the new `react-native-audio-api` dependency — `cd TherrMobile && npm install --legacy-peer-deps && npm run ios:pod:install`, then a clean Android build (`npm run android:clean` before `npm run android`). This is a JSI/native module: an over-the-air JS-only update cannot pick it up. Until the rebuild lands, `main/utilities/rewardFeedback.ts` catches the missing module and reward claims stay silent (haptics still fire), so nothing breaks — the sound just doesn't play. Verify on a physical device: haptics are simulator no-ops, and the iOS ringer-switch behavior (session is `ambient` + `mixWithOthers`) can only be checked on hardware.
- [ ] (2026-07-25, /quality-peer-review) Before the passwordless phone auth release goes live, confirm the Twilio A2P 10DLC campaign and messaging throughput cover the two **new unauthenticated** SMS-dispatching routes (`POST /v1/phone/auth/start`, `POST /v1/phone/register/start`) — previously only the authenticated `/phone/verify` sent SMS. Set a Twilio spend alert at the same time. Sends are now capped per destination number (5/hour, `chargeSmsSendBudget` in `therr-api-gateway/src/services/phone/verificationCodes.ts`) on top of the per-IP limiter, so the exposure is bounded — but the bound is `5 × distinct numbers/hour`, which is still worth a billing alarm.
- [ ] (2026-07-25, /quality-peer-review) Product decision to confirm on the passwordless sign-in flow: `POST /v1/phone/auth/start` no longer returns `INVALID_REGION`. It cannot — an SMS is only attempted for a number that *has* an account, so surfacing a region error would confirm the account exists, which is the one fact the uniform response withholds. Consequence: a user in a Twilio-unroutable region who has an account gets "code sent" and never receives one. Twilio failures are logged (`Failed to dispatch passwordless sign-in code`); watch that log after launch and consider a static country-code allow-list on the client if it shows real volume. Sign-*up* (`/register/start`) is unaffected and still reports the region error.
- [ ] (2026-07-25, /quality-peer-review) Bump the iOS app version for the passwordless-phone-auth release. `TherrMobile/android/app/build.gradle` moved to `versionName 3.9.0` / `versionCode 436`, but `TherrMobile/ios/Therr.xcodeproj/project.pbxproj` is still at `MARKETING_VERSION = 1.70.0` (iOS uses a separate scheme, so this is a bump-and-submit step, not a value to copy).
- [ ] (2026-07-25, /quality-peer-review) Post-deploy smoke test of passwordless phone sign-in against a **real production account whose phone was set via profile edit** (not via the `/phone/verify` flow). Those two paths store different dialects in `main.users.phoneNumber` — `createUser`/`updateUser` write `req.body.phoneNumber` verbatim (compact E.164, `+13175551234`) while `updatePhoneVerification` writes the gateway's normalized display format (`+1 317-555-1234`). `UsersStore.getByPhoneNumber` / `getAllByPhoneNumber` now match the full candidate set, so both resolve; before that fix the compact-E.164 rows resolved to zero accounts and, because `/phone/auth/start` is enumeration-safe, the user got a "code sent" response and no SMS. Verify by checking that the SMS actually arrives, not by the API response.
- [ ] (2026-07-25, /quality-peer-review) (Optional, no longer required for correctness) One-off backfill to normalize legacy `main.users.phoneNumber` rows onto the canonical display dialect. `UsersStore` now normalizes on write, so *new* rows no longer diverge, and `getByPhoneNumber` / `getAllByPhoneNumber` / `findUser` match a candidate set covering both dialects — so the mixed column works as-is. This is cleanup: until it happens, every future phone lookup has to keep replicating the candidate set. Do **not** add a phone-format CHECK constraint to the column as part of this — Apple SSO signups deliberately write the non-phone sentinel `'apple-sso'` there (`createUserHelper`, `handlers/helpers/user.ts`).
- [ ] (2026-07-19, /quality-peer-review) Post-deploy verification for the cross-app push fix: on a device with **both** Therr and Friends with Habits installed, confirm a Therr "New Spots Unlocked" push lands in Therr (not Habits). Existing installs self-heal on next launch — mobile compares its FCM token against `/users/me` and re-registers via `updateUser`, which dual-writes the brand-scoped row — so expect one launch of latency per app before routing is correct.
- [ ] (2026-07-18, leaderboards) After one release cycle with clean shadow logs, flip `UserLeaderboardScoresStore` from `'shadow'` to `'enforce'` mode (users-service `src/store/UserLeaderboardScoresStore.ts`).
- [ ] (2026-07-18, leaderboards) Product/QA note: the HABITS achievement allow-list is re-enabled (habit ladder + socialite + weeklyChampion — reverses the interim a55bce90d policy). Verify in the Friends with Habits build that check-ins surface streak/consistency achievements and that Therr-shaped classes (explorer, influencer…) still do not appear.
- [ ] (2026-07-13, manual) Set the `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` CircleCI
  project env var (full Play service-account key JSON with the "Release manager"
  permission) so the `eas_build_therr_android` job can auto-populate Google Play
  release notes. Until it is set, the release-notes step logs a skip and the
  pipeline still succeeds — notes just won't update. See
  `docs/SECRETS_AND_LOCAL_BOOTSTRAP.md`.
- [ ] (2026-07-03, deferred-phone-verification) Frontend follow-up: add a contextual re-prompt when a phone-unverified user hits a `MOBILE_VERIFIED`-gated action (currently only bulk `multi-invite` returns 403). **Resolved 2026-08-12** for the reachable-entry-point half — four routes into verification now exist: the `PhoneContacts` 403 toast is tappable and resumes `CreateProfile` at its `phone` stage; the profile checklist treats an *unverified* number as an unfinished step (`isPhoneVerified` in `TherrMobile/main/utilities/profileCompletion.ts`) so it permanently surfaces the same entry point; `therr.com/verify-phone` is handled in `Layout.handleAppUniversalLinkURL` and deep-links to that stage; and `/verify-phone` on therr-client-web is the standalone web equivalent for users without the app. **Still open:** audit any other action that assumes phone presence — `multi-invite` is the only one that 403s today, so any *new* `MOBILE_VERIFIED` gate needs the same treatment. Note this still hits the *already-deployed* app, which cannot be force-updated, so the web route is the only path that reaches existing installs.
- [ ] (2026-07-22, retention work) Schedule the HABITS daily partner-activity
  digest: an internal cron (k8s CronJob or equivalent) must POST once daily —
  ideally early evening US time (~23:00 UTC) — to
  `users-service:7771/habits/pacts/digest/run-daily` with headers
  `x-brand-variation: habits` and `x-localecode: en-us`. The route is
  deliberately not exposed through the API gateway. Running it more than once
  a day duplicates streakAtRisk/partnerMissedDay/pactExpiring pushes.
- [ ] (2026-06-11, /memory-management) Activate MemSearch recall — on your local machine, run `pip install 'memsearch[onnx]'` then `scripts/memsearch-index.sh`. First run downloads the bge-m3-onnx-int8 model (~558 MB, HuggingFace, cached permanently at `~/.cache/memsearch/`). No API key needed — fully local ONNX inference on CPU. Re-run after `git pull` to pick up new session logs and external docs. See `docs/MEMORY_SYSTEM_SETUP.md` for team-sharing and Notion/Confluence ingestion setup.
- [ ] (2026-04-27, /quality-peer-review; corrected 2026-08-07) Per-brand Firebase
  service account env vars
  (`PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_HABITS`, `..._TEEM`) on
  push-notifications-service production. **Only needed if the brand moves to its
  own Firebase project** — the original wording ("the THERR fallback is wrong for
  token routing once niche apps go live") was mistaken. Every brand is an app
  inside the single `therr-app` project, and one service account can address
  every app in its own project, so the fallback is correct today. Setting these
  to a service account from `therr-app` changes nothing; setting them to one from
  a *different* project without also re-registering every device breaks delivery
  outright. See `docs/PUSH_NOTIFICATIONS_DEBUGGING.md` → "Do we need a separate
  Firebase project per brand?".
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
- [ ] (2026-05-07, /quality-peer-review) Add new SSR routes to
  `habits.therr.com` sitemap if applicable (`/login`, `/verify-account`,
  `/emails/unsubscribe` — these are `noindex` so likely skip, but the
  sitemap-generator script may still emit them). Re-submit sitemap to Search
  Console after deploy.
- [ ] (2026-05-10, /quality-peer-review) Add `/claim-pact/:token` to
  `habits.therr.com` sitemap if you want Search Console coverage (likely
  skip — the page is a transient install bouncer, not indexable content),
  and confirm Android App Links verification picks up the new
  `assetlinks.habits.json` once habits.therr.com serves it (visit
  `https://habits.therr.com/.well-known/assetlinks.json` and re-run the
  Play Console "App links" check for `com.therr.habits`).
- [ ] (2026-06-05, /quality-peer-review) After deploying the JWT claims-hardening
  change (general→stage→main), confirm `JWT_ISSUER` / `JWT_AUDIENCE` env vars are
  actually present on the running prod pods for users-service, api-gateway, and
  websocket-service (`kubectl describe deploy ... | grep JWT_`). The signer and all
  verifiers must agree per-environment (`https://api.therr.com` in prod, `therr-app`
  audience everywhere); if the deploy pipeline updated the image but did not re-apply
  the deployment manifest's env block, services silently fall back to the
  `therr-api` default — still internally consistent, so issuer-based cross-env token
  separation would be inactive without any error surfacing. Verify, don't assume.
- [ ] (2026-06-20, /quality-peer-review) `JWT_SECRET` and `JWT_EMAIL_SECRET` are
  now hard-required at boot — api-gateway middleware (`authenticate`,
  `authenticateOptional`, `authenticateUnsubscribe`) throws at import if missing,
  and users-service `validateEnv` lists them in `requiredKeys`. Confirm both are
  present on prod api-gateway AND users-service before deploy; a missing var now
  crash-loops the service on startup instead of silently signing/verifying with an
  empty secret.
- [ ] (2026-06-20, /quality-peer-review) Generic gateway rate limit was lowered
  from 1000 → 300 req/min per IP (`therr-api-gateway/src/middleware/rateLimiters.ts`).
  After deploy, watch for a spike in 429s — clients behind carrier-grade NAT or a
  shared corporate/office egress IP collectively count against one bucket and may
  trip the lower ceiling. If false positives appear, raise the limit or move to a
  per-user/token keyed limiter.
- [ ] (2026-07-26, /quality-peer-review) First feed load after the relevance
  rollout reshuffles for every existing user: rows activated before the migration
  have `relevanceScore IS NULL` and sort last (`NULLS LAST`). Expected and in the
  intended direction, but it is user-visible — worth knowing before support
  tickets arrive.
- [ ] (2026-07-26, /quality-peer-review) Optional env tuning introduced this
  cycle, all with working defaults — set only if the defaults misbehave under
  real traffic: `THOUGHT_DISTRIBUTOR_MIN_INTERVAL_SECONDS` (users-service, default
  900s; `0` disables the per-user distributor gate),
  `INTEREST_ENGAGEMENT_FLUSH_INTERVAL_MS` and
  `INTEREST_ENGAGEMENT_MAX_BUFFERED_USERS` (maps-service and reactions-service,
  defaults 10000ms / 1000 users).
- [ ] (2026-07-28, /quality-peer-review) Before flipping the interest read path
  (ALGORITHM_AUDIT phase 5), review the sampled `INTEREST_RANKING_SHADOW` spans
  emitted by `getTopRankedConnections` — `interest.shadowFootrule` and
  `interest.shadowTopOverlap`. Shipping this write-only is only worthwhile if
  those distributions are actually read before the flip.
- [ ] (2026-07-28, /quality-peer-review) Optional env tuning added this cycle,
  all with working defaults: `INTEREST_AFFINITY_HALF_LIFE_DAYS` (default 45 —
  must be changed in users-service only, where both the write-side decay in
  `UserInterestsStore` and the read-side decay in `interestWeights` read the
  same variable; setting them to different values silently describes two
  different curves), `INTEREST_IMPLICIT_DISCOUNT` (default 0.6; note `0` falls
  back to the default rather than disabling the discount), and
  `INTEREST_SHADOW_LOG_SAMPLE_RATE` (default 0.02; `0` does disable logging).
- [ ] (2026-07-30, /quality-peer-review) After deploying the reaction-metric
  bounds (0392f95ce + the follow-up fix), audit and clean the rows the bounds
  now reject but that were written before them. The new validation only stops
  new bad data; it does not repair history. Two queries against the reactions
  DB: `SELECT count(*) FROM main."spaceReactions" WHERE rating IS NOT NULL AND
  (rating < 1 OR rating > 5);` (same for `main."eventReactions"`) — any hit is
  currently skewing the `avg(rating)` shown on public space pages, so decide
  whether to clamp or NULL them; and `SELECT count(*) FROM
  main."thoughtReactions" WHERE "userViewCount" > 100;` (same for
  `momentReactions`, `spaceReactions`, `eventReactions`) — inflated totals from
  the string-concatenation bug where `existing + '1'` wrote `'91'` instead of
  10.
- [ ] (2026-08-01, /quality-peer-review) Merge `general` into
  `niche/HABITS-general` and confirm the `build.gradle` merge KEPT the
  `appLinkHostsByAppId` block from ad82b0ae1. `AndroidManifest.xml` now
  substitutes `${appLinkHost}` / `${appLinkHostWww}`, but the habits branch
  still carries the old single-entry `manifestPlaceholders` line, so the two
  files conflict. Resolving in favour of the habits side leaves both
  placeholders undefined and the Android manifest merger fails the build
  outright. This commit is a no-op on `general` (applicationId there is
  `app.therrmobile`, which resolves to the unchanged therr.com defaults) — it
  only does anything once merged to the habits branch.
- [ ] (2026-08-01, /quality-peer-review) Ship a new `com.therr.habits` Android
  build after that merge. Android runs App Links domain verification at
  install/update time only, so already-installed Friends with Habits users keep
  opening habits.therr.com invite and pact links in the browser until they
  update.
- [ ] (2026-08-01, /quality-peer-review) Post-deploy smoke check on
  habits.therr.com, which hard-404s anything outside its allowlist: confirm
  `/invite/<username>`, `/invite/link/<uuid>`, and `/claim-pact/<token>` all
  render the new landing, and that
  `https://habits.therr.com/.well-known/assetlinks.json` still returns the
  `com.therr.habits` file (App Links verification silently fails if that host
  ever serves the default `app.therrmobile` one).
- [ ] (2026-08-03, /quality-peer-review) Make the maps-service surfaces
  profile-aware so WANDER can be released. It is fully implemented in
  `content-ranking` but stays out of `SELECTABLE_CONTENT_ALGORITHMS` because it is
  geo-dominant and no profile-aware surface supplies coordinates: `main.thoughts`
  has none, and the mobile carousels rank a cached page with no distance. Until
  maps-service ranks through `getScoreSqlExpression` with a `distanceMeters`
  column, `weights.geo`, `geoScaleMeters`, `searchRadiusMeters`,
  `getGeoSqlExpression`, and `getGeoTerm` have no production consumer. Either land
  that surface or drop the geo half of the module — it should not sit unconsumed
  indefinitely.
- [ ] (2026-08-03, /quality-peer-review) Know the rollback lever before rollout:
  `CONTENT_ALGORITHM_OVERRIDE=pulse` on users-service forces every user onto
  PULSE regardless of their stored setting, without a deploy
  (`content-ranking/profiles.ts` → `getAlgorithmProfile`). Leave it unset unless
  a profile misbehaves.
- [ ] (2026-08-04, /quality-peer-review) Watch mobile carousel engagement after the
  3.13.0 release. "PULSE reproduces production exactly" holds for the *server* hot
  score only — `TherrMobile/main/utilities/feedRanking.ts` previously ranked with its
  own constants, and folding it onto the shared profile changed the default carousel
  ordering for every user: recency gravity 1.1 → 1.5 (PULSE `recencyGravity`) and the
  category-affinity boost 1.25 → 1.5 (PULSE `interestMatchBoost`). Both make the
  Discoveries/Thoughts carousels noticeably fresher. If that reads as too aggressive,
  it is tunable without a mobile release only on the server — the client compiles the
  defaults in (`ALGO_*` env overrides are deliberately server-side), so a client-side
  correction needs a new build. Introduced by 787472c3e.
- [ ] (2026-08-05, /quality-peer-review) Re-submit `sitemap-static.xml` in Google Search
  Console after the web deploy. f3b1556a7 adds `/api-access` to the static sitemap and to
  `publicRoutePatterns` in `therr-client-web/src/server-client.tsx`; it is the SEO landing
  page for the API funnel, so it should be indexed rather than waiting on an organic
  recrawl.
- [ ] (2026-08-05, /quality-peer-review) Cut a mobile release before promoting the
  marketing site's "Get an API key" CTA. `therr.com/api-access` is an auto-verified
  Android App Link, so on any device with the app installed the tap opens the **app**,
  not the browser — and only builds containing 81f94b546 have the `ApiAccess` screen to
  land on. Installs older than that still fall through to
  `handleOpenByNotifeeNotification` and dead-end. Same release carries 541701457's eager
  Android channel registration.
- [ ] (2026-08-05, /quality-peer-review) Accept that 541701457 cannot repair existing
  installs whose `reminders` channel was already created at the wrong importance —
  Android locks a channel's importance and vibration at first creation, so the eager
  registration only settles the values on installs that had not yet posted to it. If
  HABITS reminder engagement stays flat for the pre-3.13.0 cohort after the release,
  that is the reason, and the only fix is a new channel id.
- [ ] (2026-08-05, /quality-peer-review) One hop of the dashboard deep-link chain still
  drops `returnTo`. `AuthRoute` attaches it only when the visitor has **no session** —
  an authenticated-but-under-privileged user gets the bare `redirectPath`, because Login
  forwards an already-authenticated visitor straight to `returnTo` and that would bounce
  off the same guard forever. The cost is that a newly-registered dashboard user who is
  redirected to `/create-profile` for missing props arrives without a `returnTo` and
  finishes on `/dashboard` rather than `/settings`. Preserving it there is safe in
  principle (`/create-profile` only navigates on a successful submit, so it cannot
  auto-loop), but it needs a per-route opt-in prop rather than hardcoding the path into
  `therr-react`. Worth doing if the API funnel's register→subscribe conversion looks
  lossy.
- [ ] (2026-08-06, /quality-peer-review) Convert the Play prominent-disclosure copy to
  `{appName}`. 848389103 landed the mechanism (`BRAND_DISPLAY_NAME` +the `translator.ts`
  wrapper that defaults the param) and a test that guards it, but no dictionary string
  uses `{appName}` yet — it appears 0 times in all three mobile locales, so the guard is
  vacuous and the disclosure the change was written for is still hardcoded. The strings
  are `permissions.accessFineLocation.message`, `permissions.accessFineLocation.title`
  ("Therr Mobile") and `permissions.backgroundLocation.description2`, each naming "Therr"
  literally in `en-us`, `es` and `fr-ca`. On `niche/HABITS-general` the Friends with
  Habits app therefore renders "Therr uses background location…" — the exact Play
  compliance problem the work targeted. Convert only these app-naming strings; the other
  ~52 "Therr" mentions are the company, `api.therr.com` and TherrCoin, and are correct
  for every variant. While in `en-us`, fix the typo "acces" → "access" in
  `permissions.accessFineLocation.message`.
- [ ] (2026-08-10, notification-queue) **Verify the first real digest run in production.**
  `NOTIFICATION_QUEUE_WORKER_ENABLED=true` is now in `k8s/prod`, so the next digest firing
  (`0 9 * * *` America/Chicago) both queues and sends. `20260808000001_main.notificationQueue.js`
  was run on 2026-08-12, so the table now exists and enqueues should succeed. If they don't:
  `enqueueNotification` swallows the exception rather than aborting the run, and the digest
  reports those as `errors` (not as
  `deduped`), so a non-zero `errors` with all `*Sent` at zero is the signature of exactly
  this. After the run, confirm in
  `main."notificationQueue"`: rows carry `brandVariation = 'habits'`, every `dedupeKey`
  ends in a `YYYY-MM-DD` (a timestamp in one silently disables dedup), and rows reach
  `sent` within a couple of minutes rather than sitting `pending` (worker off) or
  accumulating `attempts` (send failing). Then re-run the digest by hand and confirm the
  response reports `deduped` equal to the previous run's total with all `*Sent` at zero —
  that is the end-to-end proof, and it is now a safe thing to do.
- [ ] (2026-08-09, /quality-peer-review) After the push-diagnostics endpoints deploy, re-run
  `_bin/push-debug.sh` against production to confirm the iOS Habits fix (13e0e4058) actually
  lands — the `apns-topic` for HABITS and TEEM now resolves to `com.therr.mobile.Therr`, and
  APNS drops a wrong topic silently, so only a real device test closes this out.
- [ ] (2026-08-12, /quality-peer-review) **Confirm the websocket leg of account deletion
  actually reaches the service in production.** `requestToDeleteUserData` gained a fourth
  target built from the new `baseWebsocketServiceRoute`
  (`http://websocket-service-cluster-ip-service:7743`, no `/v1` prefix — this service serves
  off the container root). The fan-out is `Promise.allSettled` and its failures are only
  logged, never surfaced, so a wrong service name or port looks identical to success from the
  client. After deploy, delete a throwaway account with a socket open and confirm no
  `Failed to delete user data` span with `service.name: websocket-service` appears, and that
  the redis keys `users:<id>` / `userSockets:<socketId>` are gone.
- [ ] (2026-08-12, /quality-peer-review) **Consider denying `/delete-user-data` at the
  `websocket-service.therr.com` ingress rule.** That host maps `/?(.*)` to the websocket
  cluster-ip service so browsers can open sockets, which makes every express route on the
  service internet-facing — including the new delete endpoint. The handler now verifies the
  forwarded bearer token and requires it to match `x-userid`, so the endpoint is no longer a
  remote "log any user out" button, but the internal caller reaches it over the cluster IP and
  never needs the public host. Blocking the path at the ingress would remove the public
  attack surface entirely. Lives in `therr-infra-terraform` / `k8s/prod/ingress-service.yaml`.
- [ ] (2026-08-12, /quality-peer-review) **Android 3.14.0 (versionCode 447) needs Play
  release notes before rollout.** The bump ships the phone-verification entry points
  (deep link, profile checklist, tappable invite toast); the checklist step now keys on
  MOBILE_VERIFIED rather than mere presence of a number, so users who changed their number
  will see the phone step reopen — worth a line in the notes so it does not read as a bug.
- [ ] (2026-08-12, /quality-peer-review) **Confirm a real checkout still upgrades on the
  redirect now that grants are gated on live subscription status.** Peer review found that
  `resolveCheckoutSessionGrant` accepted `payment_status === 'paid'` as an alternative to the
  subscription being `trialing`/`active`. That field is frozen at `paid` for the life of a
  session object, so a subscriber who cancelled (and was revoked by `handleSubscriptionDeleted`)
  could replay the session id still in their browser history against
  `/login?paymentSessionId=` and re-grant themselves the plan, indefinitely and for free — a
  hole this batch widened from one redirect endpoint to every login and registration. The
  disjunct is gone; `GRANTING_SUBSCRIPTION_STATUSES` is now the sole gate, matching
  `handleSubscriptionCreateUpdate`. The one case this narrows is a redirect that beats Stripe's
  own flip to `active`: the session path then grants nothing and `activateUserSubscription`
  returns `isAccessLevelUpdated: false`, with the subscription webhook granting a beat later.
  Buy a real plan against the live keys and confirm the level lands on the redirect rather than
  only on the webhook; if the race turns out to be common, poll or retry rather than restoring
  the `payment_status` check. No migration, no env var.
- [ ] (2026-08-12, /quality-peer-review) **Smoke-test the anonymous buy-then-register path once
  Checkout Sessions reach production.** Both `POST /payments/checkout/sessions` and
  `POST /payments/checkout/sessions/:id` were added without a matching entry in
  `therr-api-gateway/src/config/unauthenticatedPaths.ts`, so every signed-out caller got a 401
  from `authenticate`. On the dashboard that 401 is not inert: `interceptors.ts` dispatches
  `logout()` and navigates to `/login`, which bounced a buyer returning from Stripe off
  `/payment-complete/:sessionId` before the GA4 `purchase` event could fire — the one conversion
  event the whole Checkout Sessions change exists to produce. Fixed in this review (both paths
  exempted, both routes now use `authenticateOptional`), covered by unit tests. Verify on stage
  with a signed-out browser: complete a checkout, confirm `/payment-complete/:sessionId` renders
  its sign-up/sign-in links instead of redirecting, and confirm one `purchase` hit in GA4
  Realtime. No migration, no env var.
- [ ] (2026-08-13, /quality-peer-review) **Verify parent-thread context and reply creation on
  stage with a real private thread.** Three gates changed and none is observable end-to-end from
  unit tests: the banner is gated on the reader being able to open the parent, the parent is no
  longer activated as a side effect of viewing a reply, and `createThought` now rejects a
  `parentId` the caller cannot read. Walk it: (1) open a reply on a *non-public* thread as a user
  who reached it through the parent, and confirm the "Replying to @user" banner and "Back to
  Thread" still render; (2) post a reply from that same thread and confirm it still succeeds;
  (3) confirm a reply on someone else's private thought you have never activated shows no banner
  rather than linking to a 400. Watch users-service logs for unexpected 403s on `POST /thoughts` —
  that would mean a legitimate reply path does not activate the parent the way the gate assumes.
  No migration, no env var.
- [ ] (2026-08-13, /quality-peer-review) **Run the two `habits.habit_phases` migrations before
  the messaging automator's next firing.** `20260810000001_habits.habit_phases.js` creates the
  table and `20260810000002_...emailTracking.js` adds `maintenanceEmailedStage`,
  `lastComebackEmailedAt` and `lastConsistencyPercent`. `therr-messaging-automator`'s
  `habits-milestone-emails` task reads that row and **writes** the first two over a direct Knex
  connection, so if the automator ships (or is chained on via
  `HABITS_MILESTONE_EMAILS_ON_DIGEST=true`) before these run, it fails on a missing relation at
  its next scheduler firing with no alert — the failure mode §1 of docs/CROSS_REPO_INTEGRATION.md
  describes. Order: migrate here first, then enable the automator task.
- [ ] (2026-08-13, /quality-peer-review) **Watch the first digest runs after
  `HABIT_PHASE_ENGINE_ENABLED=true` reaches prod.** The flag is now set in
  `k8s/prod/users-service-deployment.yaml`, so the engine goes live with the next
  `general → stage → main` deploy rather than on a deliberate cohort flip — there is no
  ramp, every habit is evaluated on the first run. Two things to check: (1) the backfill
  burst of `habitEstablished` / `habitAutomaticity` messages, bounded but not eliminated by
  the queue worker's per-user daily cap of 5 — look for `status='skipped'` rows on
  `main.notificationQueue`; (2) the digest's `nudgesTapered` counter, which rising is the
  only direct evidence the taper is cutting send volume rather than just adding four new
  message types on top. If the burst is unacceptable, set the value back to `"false"` —
  phase rows are left in place and re-enabling resumes from recorded state. It also depends
  on `NOTIFICATION_QUEUE_WORKER_ENABLED=true` (already set in prod and test); with the
  worker off, the lifecycle pushes queue and nothing is delivered.
- [ ] (2026-08-13, /quality-peer-review) **Create the `cloudflare-api-token` secret in the
  `cert-manager` namespace of every cluster before applying `k8s/prod/issuer.yaml`.** The
  ClusterIssuer moved from HTTP-01 to DNS-01, and `deploy.sh` runs `kubectl apply -f k8s/prod`
  wholesale, so this issuer lands on *every* cluster. A cluster missing the secret (key
  `api-token`, scope Zone → DNS → Edit on the therr.com zone) goes NotReady and silently stops
  renewing certificates — existing certs keep serving until they expire, so there is no
  immediate signal. Verify with `kubectl describe clusterissuer letsencrypt-prod` on each
  cluster after the apply.
- [ ] (2026-08-13, /quality-peer-review) **Consider `use-gzip: "true"` in the ingress-nginx
  controller ConfigMap.** The dead `server-snippet` gzip block was removed from
  `k8s/prod/ingress-rewrite-service.yaml` (it was already being dropped as a risky annotation —
  the live nginx.conf reads `gzip off;`). Removing it is behavior-neutral and unblocks the apply
  on a new cluster, but it also means gzip is still genuinely off at the ingress. If compression
  is wanted, the supported route is the controller ConfigMap Helm value, applied deliberately to
  both clusters. No migration, no env var.
- [ ] (2026-08-14, /quality-peer-review) **Watch the first prod deploy under the new
  three-wave plan with `DEPLOY_DRAIN_TIMEOUT` defaulted to 0.** `_bin/cicd/deploy.sh` dropped
  from seven waves to three and no longer waits for superseded Pods to finish terminating
  between waves. Both changes assume the new cluster's nodes can absorb the whole surge
  footprint at once — the assumption the old seven-wave plan existed to avoid testing. The
  failure mode is the 2026-08-12 one: a rollout wedged on an over-subscribed node, which
  `wait_for_rollouts` surfaces as a timeout rather than anything subtler. If it recurs, the
  gate is still there — set `DEPLOY_DRAIN_TIMEOUT=90` to restore the old behavior without a
  code change. No migration, no env var required for the default path.
- [ ] (2026-08-14, /quality-peer-review) **Wire `validate` into the 14 gateway routes that
  declare express-validator chains without it.** Listed as `KNOWN_UNENFORCED` in
  `therr-api-gateway/tests/unit/routes/validationWiring.test.ts`, which now fails on any
  *new* one. Each declares a body contract that never runs — the chain populates the error
  bag and nothing reads it, so malformed bodies proxy straight through to the service.
  Deliberately not fixed in bulk: enforcing a chain that has never run is a live behavior
  change for clients that cannot be force-updated (`POST /users/search` and
  `PUT /users/connections` are both on deployed mobile paths). Each needs its shipped-client
  payload checked against the chain before `validate` is added, then its line deleted from
  the list. No migration, no env var.
- [ ] (2026-08-17, /quality-peer-review-niche) **Reconcile `docs/WORK_IN_PROGRESS.md` between
  `general` and `niche/HABITS-general`.** Four unchecked blocks live only on the niche branch
  and are therefore invisible to anyone working on `general`: the 2026-08-06 Play Console +
  privacy-policy steps for the contacts rejection, the 2026-07-22 automator daily-digest
  scheduling item, the two 2026-08-06 `/quality-peer-review` items (brand-identity merge-down,
  mobile tsc baseline growth), and the HABITS-only `react-native-maps` removal. They were not
  bulk-copied because at least one adjacent niche-side block — the 2026-07-28
  `userLocations.dwelling` migration — was **deliberately deleted from `general`** as completed
  (`55d2c0478`) and still survives on the niche branch, so copying the file diff wholesale
  would resurrect finished operational work. Each block needs a done/not-done call before it
  moves. The file is owned by `general`; the niche copy should end up a subset, never a
  superset.
- [ ] (2026-08-17, /quality-peer-review-niche) **Verify `com.android.vending.BILLING` survives
  into the built artifact**, not just the source manifest. `react-native-iap` ships an empty
  `AndroidManifest.xml`, so the permission arrives either from our explicit declaration or
  transitively from the Play Billing AAR. Check the merged manifest
  (`TherrMobile/android/app/build/intermediates/merged_manifests/release/AndroidManifest.xml`)
  or `aapt dump permissions` on the AAB before uploading — this is the gate on the in-app
  product item above, and a dependency change could silently drop it.
- [ ] (2026-08-17, /quality-peer-review-niche) **Push `general` before merging
  `niche/HABITS-general` into `niche/HABITS-main`.** The entire three-invite solo-habit
  threshold — `getSoloInviteProgress`, `countDistinctInvitedByCreator`,
  `HABITS_SOLO_UNLOCK_INVITE_COUNT`, and the `invitedCount` / `soloUnlockInviteCount` fields on
  `GET /habits/user-habits/eligibility` — sits in five **unpushed** commits on local `general`
  (`7795559f3`, `1fd821afc`, `87cd4a774` plus two docs commits). Production (`origin/main`)
  still runs `hasSentPactInvite`, which unlocks solo habits after **one** invite and returns no
  counts. The mobile client degrades cleanly against that (`hasProgress` is false, so every
  progress surface simply hides), so this is not a crash — it is worse in a quieter way: the
  Play build would ship looking finished while the threshold it advertises silently is not in
  effect. Push `general`, then `general → stage → main`, and confirm the new response shape is
  live before cutting the Android build.
- [ ] (2026-08-18, /quality-peer-review) **Send one real Friends with Habits invite in prod
  once `general → stage → main` lands.** This is the first release where a niche invite leaves
  the Therr host: the email subject, the email body pitch, the SMS body and the magic-link host
  are all now brand-resolved, and the habits link points at `https://habits.therr.com/invite/link/:token`
  rather than therr.com. The unit tests stub SES and compose the SMS string directly, so nothing
  in CI exercises Twilio, SES, or the habits subdomain actually resolving that route in prod.
  Send one invite to each channel from a Habits account and confirm the subject names Friends
  with Habits, the body reads "be the change" rather than "explore your local community", and
  the link lands on the invite page instead of bouncing to therr.com.
- [ ] (2026-08-18, /quality-peer-review) **Android 3.15.1 (versionCode 449) needs Play release
  notes before rollout.** The bump ships three user-visible fixes: bottom sheets no longer sit
  for 300ms before animating, the Connect lists stop snapping back to the top mid-scroll, and
  the sign-in field no longer swaps the keyboard out from under you partway through a phone
  number (with a new toggle button beside the field for the cases the automatic pick gets
  wrong). Note the keyboard toggle explicitly — it is a new control, not just a fix. If
  versionCode 447 never rolled out, the 2026-08-12 item above folds into this one and the notes
  must cover both bumps.
- [ ] (2026-08-18, /quality-peer-review) **Smoke-test every bottom sheet on a real Android
  device before cutting 3.15.2.** `BaseActionSheet` now renders every sheet with
  `isModal={false}`, so sheets are in-tree absolutely-positioned views instead of native Dialog
  windows. Nothing in Jest or tsc covers that difference — the library keeps a `hardwareBackPress`
  listener on the non-modal path (verified in `dist/src/index.js`) and `SheetProvider` sits inside
  `GestureHandlerRootView` above `Layout`, so z-order and back should hold, but both are runtime
  properties of the native view tree. Open content-options, group, user, user-profile,
  image-picker, visibility-picker and list-picker sheets; confirm each draws over the bottom tab
  bar, that the hardware back button dismisses it, that swipe-down dismisses (all but list-picker,
  which opts out), and that the list-picker's text input is not covered by the keyboard.
- [ ] (2026-08-18, /quality-peer-review) **Android 3.15.2 (versionCode 450) release notes —
  supersedes the versionCode 449 item above.** 449 was bumped to 450 in the same cycle, so write
  one set of notes covering both. On top of the 449 fixes, 450 adds: blank gaps in the Discovered
  feed and the Connect lists are gone (`removeClippedSubviews` off, wider render window, Connect
  back on FlatList), and the post options sheet no longer pops back open a moment after you react
  to a post.
- [ ] (2026-08-19, /quality-peer-review) **The habits landing page now advertises the $20 founder
  unlock publicly — confirm the Play in-app product is live and the offer endpoint is configured
  before this web deploy goes out.** `therr-client-web/src/views/habits/landing.hbs` and
  `_static/habits-llms.txt` state the price, the 5,000-account cap and the 5-habit free limit as
  fact, including in `Offer` JSON-LD that search engines will index. Two items above become
  ordering constraints on this deploy rather than independent tasks: `habits_lifetime_founder`
  must exist and be active, and `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` must be set, or the page sends
  people into an app that hides the CTA (`isStoreConfigured: false`).
- [ ] (2026-08-19, /quality-peer-review) **Confirm `TWILIO_SENDER_PHONE_NUMBER` and
  `TWILIO_SENDER_PHONE_NUMBER_GB` are both set in the prod users-service secrets.**
  `dispatchPactInvitation` now returns `undeliverableReason: 'noContactMethod'` for a phone-only
  partner when no sender is configured for their country, instead of reporting the invite as sent.
  That is the correct outcome, but it means a missing GB sender becomes user-visible as "we could
  not reach them" on every UK pact invite and nudge, where it previously failed silently.
- [ ] (2026-08-22, /quality-peer-review) **Run the `main.thoughts` location migration and the
  location-bot seed in production.** `20260821000001_main.thoughts.location.js` adds nullable
  `latitude`/`longitude`/`locality` plus a partial index (additive, verified re-runnable), and
  `006_local_bot_users.js` seeds the 12 metro bot accounts with declared homes in
  `main.userLocations`. The seed is the this-repo half of the bot contract — without it the
  distributor's local query has no bot content to find.
- [ ] (2026-08-22, /quality-peer-review) **Build the `therr-ai-automator` half before expecting
  any location-aware bot content.** Verified against the sibling repo on 2026-08-22: it has no
  `src/config/locales.ts`, does not read `main.userLocations`, and never writes
  `main.thoughts.latitude/longitude/locality`. Until that ships, human city detection
  (`detectLocality`) is the only source of location-tagged posts and the "Location-aware bots"
  feature is inert. `docs/CROSS_REPO_INTEGRATION.md` § "a bot's home city lives here" and the
  `docs/FEATURES.md` bullet describe that contract in the present tense — both are now marked as
  pending, and the markers should be removed when the automator side deploys.
- [ ] (2026-08-22, /quality-peer-review) **Keep the `locality` label spelling identical across
  repos when the automator lands.** Human posts render `"${name}, ${stateAbbr}"` from the `Cities`
  catalog; the automator must emit the same form ("Chicago, IL") or one place shows up under two
  spellings in the feed. No CI can see both sides.
- [ ] (2026-08-23, /quality-peer-review) **Watch the first `stage` → `main` deploy after the
  pipeline rewrite lands, and confirm the plan table before letting it roll.** No service has a
  `PUBLISHED_*` row yet, so all eight resolve through `LAST_PUBLISHED_GIT_SHA=3f1d5ba` — a tag the
  publish job only ever pushed for the services that merge rebuilt. Services already on that tag
  come out `up-to-date` and are skipped; any the cluster is genuinely behind on will come out
  `missing-image` and block before touching the cluster. The fix in that case is to re-run the
  stage pipeline so it publishes and writes per-service rows — not to hand-edit `VERSIONS.txt`.
- [ ] (2026-08-23, /quality-peer-review) **After the first successful deploy, confirm `VERSIONS.txt`
  on `stage` has grown a `PUBLISHED_*` row per service.** That is the signal the ledger transition
  is complete and the `LAST_PUBLISHED_GIT_SHA` fallback is no longer load-bearing.
- [ ] (2026-08-23, /quality-peer-review) **Make a CircleCI rerun of the stage publish job
  reconcile with `origin/stage` before committing `VERSIONS.txt`.** A rerun starts from a fresh
  checkout at `CIRCLE_SHA1`, so the working tree holds the pre-publish ledger while
  `origin/stage` already carries the `[skip ci]` commit the first run pushed. `publish.sh` then
  builds a sibling commit and `git push` is rejected as non-fast-forward — the job reports a
  broken publish that actually succeeded. Pre-existing (the pre-rewrite script failed the same
  way), and not something the empty-index guard addresses. Fix is to `git fetch origin stage` and
  re-load the ledger from the remote tip before `ledger_write`, so the guard sees the real state.
  Until then, recover by re-running the *stage pipeline* rather than the single job.
- [ ] (2026-08-23, /quality-peer-review) **After the reposts deploy, confirm
  `20260809000001_main.thoughts.repostThoughtId` actually applied to production.**
  `_bin/cicd/run-migrations.sh` runs migrations *after* `kubectl set image`, so the new
  users-service pod serves the pre-migration schema for the length of the rollout. Repost
  hydration (`ThoughtsStore.attachRepostDetails`) is deliberately fail-soft so that window
  degrades to "no embeds, no counts" instead of 500ing every thoughts feed — which also means an
  unapplied migration is now **silent**. Verify explicitly: the column exists
  (`\d main.thoughts`), and a repost created from the app comes back with a populated
  `repostOf`. If migrations were skipped (`RUN_MIGRATIONS_ON_DEPLOY=false`), run
  `npm run pr:migrate:users`.

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

_All open Tier 1.1 items closed (2026-05-11)._

### 1.2 Spoofable mutation endpoints

These endpoints let a client mutate engagement metrics on demand, corrupting
analytics that the B2B dashboard charges for.

Corrected 2026-07-30 (/work-plan): this section previously described the
reaction endpoints as reachable by an **unauthenticated** client. They are not.
`therr-api-gateway/src/index.ts` applies `authenticate.unless({ path: [...] })`
and no reaction route appears in that exclusion list. The real exposure was
narrower — any *authenticated* user could set unbounded values on the numeric
reaction fields. Recording this so the claim is not re-derived from the old
wording.

Closed 2026-07-30 (/work-plan): client-supplied reaction metrics are now bounded.
`userViewCount` and `userBookmarkPriority` (0–100) and `rating` (1–5) are
rejected with a 400 outside those ranges — at the gateway for the single-reaction
routes, and in `reactions-service/src/utilities/validateReactionMetrics.ts` for
the internal `/create-update/multiple` routes, which are not registered in the
gateway's reactions router and so never saw gateway validation. Bounds are shared
via `therr-js-utilities/constants` → `Reactions` so the two cannot drift.
`rating` mattered most: `SpaceReactionsStore` averages it into the rating shown
on public space pages, so one out-of-range write permanently skewed it.

Closed 2026-08-12 (/work-plan): reaction write columns are now allow-listed. The four
handlers spread `...req.body` straight into the store, and the store passes its params
object to `knex.insert()`/`knex.update()` unfiltered — the `ICreate*Params` interfaces
are compile-time only and the handlers are untyped `(req, res)`. express-validator at
the gateway validates the fields it lists but does not strip the ones it does not, so
every column on every reaction table was writable by any authenticated user. All 13
spread sites now go through `reactions-service/src/utilities/pickReactionWriteFields.ts`.

The column that mattered most was `main."thoughtReactions"."relevanceScore"` — the feed
ordering key (`ORDER BY "relevanceScore" DESC NULLS LAST`). A client could pin any
activated thought to the top of its own stream and stamp an `algorithmKey` naming a
profile that never scored the row, which is the one invariant that column exists to make
observable. Also closed: client-writable `contentLatitude`/`contentLongitude`/
`contentLocation`/`contentAuthorId` on moment/space/event reactions, the space visit
columns (`visitCount`, `visitedAt`, `lastVisitedAt`) that are derived server-side from
`recordVisit`, and `updateCount`/`createdAt`/`updatedAt`/`isArchived`. The
`/create-update/multiple-users` event route matters separately: it writes rows for every
member of an event's group, so the unfiltered spread let its caller set any column on
*other users'* reactions.

Unlisted fields are dropped silently rather than rejected with a 400. `attendingCount`
is why: mobile's ViewEvent RSVP modal sends it on `POST /event-reactions/:eventId`, the
gateway validator does not declare it, and it only ever reached the table through the
spread — so a 400 would have broken RSVP for installs that cannot be force-updated. It
is on the event allow-list. The real client field set is wider than any validator
declares, which is the general reason to drop rather than reject here.

Still open in this area:

- Reaction handlers force `userHasActivated: true` regardless of the request
  body, so an authenticated user can still mark any addressable content as
  activated. Closing this needs proximity/view verification, not a bounds check
- `therr-api-gateway/src/services/maps/router.ts:144` — Backend logic to
  prevent location spoofing (rapid-change detection)

### 1.3 User deletion completeness (GDPR / app-store compliance)

The user-deletion path drops the row in users-service but left orphans in
notifications, messages, forums, websocket sessions, and cloud media. This
is a privacy-policy violation and an Apple/Google review risk.

Closed 2026-08-11 (/work-plan): the `requestToDeleteUserData` fan-out now reaches
messages-service and websocket-service alongside maps and reactions, and
users-service deletes its own `main.notifications` and `main.notificationQueue`
rows. Direct messages and the user's own forum messages are deleted; forums they
created are reassigned to `SUPER_ADMIN_ID` so other members' conversations survive
(the same trade-off maps-service already makes for spaces). All of these deletes
are deliberately **unscoped by brand** — the identity row is gone, so there is no
brand under which the rows should survive. The fan-out moved from `Promise.all` +
`console.log` to `Promise.allSettled` with a per-service error span carrying the
deleted user id, since one unreachable service must not cancel erasure at the rest
and the row cannot be re-derived afterwards.

Still open:

- `therr-services/users-service/src/handlers/users.ts:1367` — Delete user
  media from cloud storage. Greenfield: no `deleteObject` / `DeleteObjectCommand`
  call exists anywhere in the monorepo, so this needs both an S3 delete path and a
  decision on how to enumerate a user's media keys (uploads are named from the
  message text, not from a per-user prefix). Deferred as its own batch

### 1.4 Auth / billing-email integrity

Closed 2026-08-12 (/work-plan), four items:

- **Duplicate billing-email claim.** `billingEmail` was accepted verbatim from the
  login body — a field no client sends, so it was pure attacker surface. It now
  writes only when the address is the caller's own or is held by no other account
  (checked against both `email` and `billingEmail`, fail-closed on lookup error).
  The exposure was worse than the original wording: `payments.ts` attributes an
  incoming Stripe checkout to an account via `getUserByEmail(billingEmail)` and
  falls back to `user.billingEmail` for receipts, so claiming another user's
  address redirected their subscription, not just a refund dispute.
- **Phone change no longer keeps its old verification.** A profile save could move
  `phoneNumber` to any value while the account kept the `MOBILE_VERIFIED` level the
  *old* number earned. `computeAccessLevelsAfterProfileUpdate` now revokes it when
  the number actually changes (dialect-insensitive, so a reformatted-but-identical
  number is not treated as a change). The save still succeeds; only the trust is
  withdrawn, and the user re-earns it through the normal SMS flow.
- **RSERV-24 was already fixed** — `createUserConnection` has carried a
  `requestingUserId !== userId` guard for some time; only the TODO comment was
  stale. Replaced with a note explaining why the body field still exists (the
  deployed app sends it and cannot be force-updated).
- **"Investigate security issue / Lockdown updateUser"** resolved: the flagged code
  was `updateUserCoins`, which built the same broad `updateArgs` as `updateUser` —
  `phoneNumber`, `userName`, `media`, `deviceMobileFirebaseToken`, `accessLevels` —
  with none of `updateUser`'s guards (no accounts-per-phone cap, no media-safety
  check, no username-uniqueness handling). Severity is bounded by the route not
  being registered in the api-gateway: `PUT /users/:id/coins` is internal-only and
  its sole caller is reactions-service's `sendUserCoinUpdateRequest`, which sends
  `settingsTherrCoinTotal` and nothing else. The handler is now scoped to that one
  field, so there is no broad path left to lock down. Its dead password branch went
  too — `updateUserPassword` is the real, gateway-registered path.

Still open:

- `therr-services/users-service/src/handlers/auth.ts:69` — Mitigate user with
  multiple accounts attached to same phone number. The *write* half is enforced
  (accounts-per-phone cap in `createUser` and `updateUser`); what remains is login
  resolution — password login still resolves to whichever row the OR-lookup returns
  first, as the NOTE above `userNameOrEmailOrPhone` in `login` records. The
  passwordless flow already lets the user pick

### 1.5 Payment / subscription closure

Closed 2026-08-12 (/work-plan), all three items. A completed Stripe checkout now
upgrades the account on the redirect rather than only via the subscription webhook.
`register` and `login` both received `paymentSessionId` already — the dashboard's
`PaymentComplete.tsx` redirects to `/register?paymentSessionId=` and
`/login?paymentSessionId=`, and the gateway validates the field — but `createUser`
had an empty `else if (paymentSessionId)` branch and `login` had the read commented
out entirely. Both now resolve the session through a shared helper,
`users-service/src/handlers/helpers/checkoutSessionAccessLevels.ts`.

The `payments.ts` item was a live bug, not a hardening task: `activateUserSubscription`
gated on `payment_status === 'paid' && status === 'complete'`, but a Checkout Session
that only starts a **free trial** completes with `payment_status: 'no_payment_required'`.
That session granted nothing, so a trial signup was upgraded only when the
`customer.subscription.*` webhook arrived — making the upgrade silently dependent on
`STRIPE_WEBHOOK_SIGNING_SECRET` being configured (still an unchecked standing item
above). The helper now grants on subscription status `trialing` or `active`, the same
two `handleSubscriptionCreateUpdate` branches on, so the session and webhook paths agree.

A session id is a bearer token for a *purchase*, not for an account, and nothing in the
session ties it to the caller presenting it. All three paths therefore require the
session's billing email to match the account claiming it (normalized, the same key the
webhook grants on) and fail closed — otherwise any registration or login quoting a
leaked session id would inherit that subscription's plan. Grants fail **open** in the
other direction: a Stripe outage or a mismatch returns no levels rather than throwing,
so registration and sign-in are never blocked by the upgrade path.

Also fixed while refactoring: `activateUserSubscription`'s no-`userId` branch looked the
account up with `Store.users.getUserByEmail`, which selects only `id`/`email`/
`isUnclaimed`. The subsequent `updateUser` unions the grant with `existingUser.accessLevels`
— `undefined` on that path — so an email-matched activation **replaced** the account's
access levels with just the subscription level, stripping `EMAIL_VERIFIED` and locking the
user out of login (which rejects accounts without it). That path now selects
`accessLevels` explicitly via `getUsers`.

Still open — the analytics half of this same gap, tracked in
`therr-workspace/docs/MARKETING_ATTRIBUTION_PLAN.md` Phase 2: checkout is a Stripe
**Payment Link** opened with `target="_blank"` (`therr-client-web-dashboard`:
`PricingCards.tsx:97,134,172`, `Sidebar.tsx:280,283`, and the four `*Menu.tsx`
components), so the GA4 session ends at the click and **no `purchase` event exists in
any property**. Moving to a Checkout Session with a `success_url` back into the
dashboard closes both problems at once — the redirect is what lets the account get
upgraded *and* what keeps the session alive for attribution. The upgrade half is now
done (above), so what remains here is purely the attribution half.

Re-verify that premise before acting on it (noted 2026-08-12, /work-plan): a return
path into the dashboard **does** already exist — `therr-client-web-dashboard/src/routes/
PaymentComplete.tsx` reads a session id and forwards it to `/register` and `/login` —
which is what made the upgrade half fixable without touching checkout at all. Whether
the `target="_blank"` Payment Link is still how every plan is purchased, and whether
GA4 genuinely sees no `purchase` event, should be checked against the current dashboard
rather than inherited from this entry.

### 1.6 Unscoped user / connection endpoints (cross-brand leakage)

`searchUsers` and `findPeopleYouMayKnow` were brand-scoped during the Phase 5
brand-isolation work, but their siblings on the same identity-shared
`main.users` / `main.userConnections` tables were not. Because `main.users` has
no brand column (membership lives in the `brandVariations` JSONB array), an
endpoint that omits `brandContainment` silently returns **every** brand's
accounts — a Habits or Teem user sees Therr profiles, which undermines the
premise of the niche apps. These fail open and produce no error, so they will
not surface until a user reports it.

Audited 2026-07-20 (handler-level, users-service). Each needs a judgment call
on whether brand scoping is correct — direct-link profile views may legitimately
be brand-agnostic, but discovery and contact-matching paths are not.

Closed 2026-08-14 (/work-plan) — both remaining entries were resolved as *decisions*,
not as missing scoping, and each is now recorded in a comment on the handler so the
question is not re-derived:

- `getUserConnection` stays brand-agnostic. It reads one connection by its
  `(requestingUserId, acceptingUserId)` pair — a targeted lookup, not discovery — and
  the IDOR guard added 2026-08-12 already restricts it to pairs the caller belongs to.
  `main.userConnections` records no brand, and a connection is a fact about two
  identities, so scoping it would 404 a connection that demonstrably exists for a user
  who is in both apps
- `updateLastKnownLocation` stays brand-agnostic, and scoping it would be a live bug:
  it already 403s unless the route param is the caller's own id, so it writes exactly
  one identity row. A `brandContainment` predicate would match zero rows for a user
  whose `brandVariations` array had not yet picked up the brand they are signed in
  under, and the handler reports success without reading `rowCount` — so their location
  would silently stop being recorded

Re-audited 2026-07-20 (/work-plan) — three entries in the original audit were
misdiagnosed and are **not** bugs. Recording the findings so they are not
re-flagged:

- `getUserByPhoneNumber` (users.ts:393) is **not** the contact-matching path. Its
  only caller is the api-gateway phone-verification route
  (`therr-api-gateway/src/services/phone/router.ts:60`), which uses it to enforce
  "one personal + one creator + one business account per phone number". Brand
  scoping it would *break* that anti-abuse rule by letting the same phone register
  again under each brand. Phone-book contact matching is `findUsersByContactInfo`,
  which is already brand-scoped
- `getUser` (users.ts:369) and `getUserByUserName` (users.ts:456) are deliberately
  brand-agnostic: both back direct-link and SEO-indexed profile views, so scoping
  them would 404 valid cross-brand profile links. Decision is now recorded in a
  comment on each handler
- `clearUserDeviceToken` (users.ts:1321) is correct as written — **confirmed
  2026-08-14 (/work-plan)**, this note is now closed. `UserDeviceTokensStore.deleteByToken`
  deletes on the token string alone, and the store already carries a comment stating the
  reasoning: a token value is globally unique to a device install regardless of brand, so
  the input identifies the row(s) without a brand predicate. The migration
  (`20260425000003_main.userDeviceTokens`) indexes `token` for exactly this
  invalid-token cleanup path

Closed 2026-07-20 (/work-plan): `searchUserPairings` is now brand-scoped via a new
`brandVariation` arg on `UsersStore.searchUserSocials` (regression tests added).
`getInviteByToken` now resolves cross-brand *by design* and returns the invite's
origin `brandVariation` (new `20260720000001_main.invites.brandVariation` migration)
so the landing page can route the invitee to the right app.

Closed 2026-08-14 (/work-plan): the frontend half of the invite change shipped.
`therr-client-web/src/routes/InviteLinkLanding.tsx` now reads `brandVariation` off
`GET /users/invites/:token` and resolves install links through a new
`src/utilities/brandAppStores.ts`, so a Habits invite offers the
`com.therr.habits` listing instead of the Therr one. HABITS deliberately gets no App
Store badge — no HABITS iOS target exists, so that badge would install the Therr app,
which cannot see the invite. Unknown, missing and shelved brands fall back to Therr.
The username-based `/invite/:username` landing is unchanged: it has no token, so no
`brandVariation` is available to it.

Related routing hygiene, found while fixing the `POST /users/search` 400 on
2026-07-20 (gateway `/users/:id` was registered before the literal routes and
shadowed `/users/search`, `/users/search-pairings`, `/users/forgot-password`,
and `/users/notifications`): the other gateway routers have not been audited
for the same param-before-literal ordering bug. A shadowed route fails with a
validation 400 that looks like a client payload bug, so these are expensive to
diagnose.

Closed 2026-08-14 (/work-plan): all 8 gateway routers are audited, and the audit is now
enforced rather than one-time. `therr-api-gateway/src/utilities/routeOrdering.ts` walks
the live Express stack (not the source) and `assertNoShadowedRoutes` runs at boot in
`src/index.ts`, with the same check over the real router in
`tests/unit/utilities/routeOrdering.test.ts` so CI fails first.

The sweep found **8 shadowed routes**. One of them was a live user-facing outage; the
other seven were latent. The distinction is worth keeping, because it is not obvious:
`handleServiceRequest` proxies to `` `${basePath}${req.url}` ``, forwarding the original
URL verbatim. A shadowed route therefore still reaches the *correct* downstream path — it
just runs the **wrong middleware chain** on the way. It only breaks when the shadowing
route's middleware rejects the request.

**Live bug, now fixed: `PUT /users-service/users/change-password` returned 400 for every
caller.** It matched `PUT /users/:id`, whose `updateUserValidation` leads with
`param('id').exists().isUUID(4)`; `change-password` is not a UUID, so `validate`
short-circuited with a 400 before the proxy ran. Both web and dashboard reach this route
through `therr-react`'s `UsersService` (`src/services/UsersService.ts:155`), so
password change from the web was failing with what looked like a client payload error.
This is the same failure mode as the 2026-07-20 `/users/search` incident.

Latent (each proxied correctly, but under another route's middleware):

- `GET /users-service/users/notifications`, `GET /users-service/users/organizations` —
  behind `GET /users/:id`, so they ran its `authenticateOptional` rather than their own
  chain. Note the *`POST`* siblings were fixed on 2026-07-20 by moving the param route to
  the bottom of the file with a comment — but only for `POST`. `GET` and `PUT` kept theirs
  mid-file and have now joined it there
- all four `GET /users-service/social-sync/oauth2-{facebook,dashboard-facebook,instagram,tiktok}`
  callbacks — behind `GET /social-sync/:userId`
- `GET /messages-service/forums/categories` — behind `GET /forums/:forumId`

---

## Tier 2 — Consumer Growth Engine (Habits, Push, Engagement)

The viral loop in Friends With Habits (`docs/niche-sub-apps/HABITS_PROJECT_BRIEF.md`)
and the engagement roadmap (`docs/PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md`)
depend on these working correctly.

### 2.1 Push notification engagement

- `therr-services/push-notifications-service/src/handlers/helpers/areaLocationHelpers.ts:222`
  — RDATA-3: Smart rules around when to send push notifications
- `therr-services/push-notifications-service/src/api/firebaseAdmin.ts:676` —
  RDATA-3: ML to predict whether to send a push
- `therr-services/push-notifications-service/src/api/firebaseAdmin.ts:283` —
  iOS Notification Service Extension so iOS can fetch message content before
  showing
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

### 2.5 HABITS payment workflow (Phase 4 monetization)

Backend shipped 2026-08-15. The plan changed on two axes and the doc
(`docs/niche-sub-apps/habits/HABITS_PAYMENT_WORKFLOW.md`) was rewritten to
match:

- **Google Play Billing, not Stripe web checkout.** The web-checkout plan
  avoided Play's 15% but added a policy question to a production submission
  that is already carrying a User Data rejection, and it only works if the app
  never advertises the purchase — untenable for a headline founder offer.
- **The free tier caps active habits, not pacts created.** Counting pacts
  punished the social behaviour the app exists to encourage.

What shipped: `habits.lifetime_purchases` with atomic founder-slot allocation,
`GET/POST /habits/lifetime[/verify]` with server-side Play verification and
acknowledgement, `AccessLevels.HABITS_LIFETIME`, and `assertHabitCapacity` as
the single enforcement point for the 5-habit cap (402 with paywall metadata).

Still open:

- Play Console setup — create the `habits_lifetime_founder` product, the
  service account, and license testers (see Manual Operational Follow-ups).
- Refund / revocation: `LifetimePurchasesStore.setStatus` exists but nothing
  consumes Play's Real-Time Developer Notifications, so a refunded buyer keeps
  the entitlement.
- iOS StoreKit verification — the `platform` column is ready, the code is not.

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
- `TherrMobile/main/routes/Map/index.tsx:207-209` — `mapStateToProps`
  returns new `{}` fallbacks every render (`reactions || {}` etc.); freeze
  module-level empties so child memoization isn't defeated on every state
  update
- `TherrMobile/main/routes/Map/TherrMapView.tsx` — wrap per-marker render
  output in a `React.memo`'d component keyed by stable id; the
  `events.map` / `moments.map` / `spaces.map` projections are unmemoized
  and re-run on every parent render
- `TherrMobile/main/routes/Notifications/index.tsx` — migrate `FlatList`
  to `@shopify/flash-list` (already in deps, currently zero usages),
  memoize the `Notification` row component, add `removeClippedSubviews`
- `TherrMobile/main/routes/Connect/index.tsx` — migrate to FlashList
- `TherrMobile/main/routes/DirectMessage/index.tsx` — migrate to FlashList
- `TherrMobile/main/routes/Groups/index.tsx`,
  `routes/Areas/AreaCarousel.tsx`, `routes/Areas/MyLists.tsx`,
  `routes/ManageSpaces/index.tsx`,
  `routes/Invite/components/CreateConnection.tsx` — props-only FlatList
  tuning: `removeClippedSubviews`, `windowSize`, `maxToRenderPerBatch`,
  `initialNumToRender`, `getItemLayout` where row height is constant; wrap
  rows in `React.memo`
- ~~New `TherrMobile/main/utilities/signedUrlCache.ts`~~ — *investigated
  and dropped*: Map already dedupes via the Redux `content.media` cache
  before calling `MapsService.fetchMedia`
  (`TherrMobile/main/routes/Map/TherrMapView.tsx:573`), and each Edit
  upload constructs a unique filename from the message text so an LRU
  keyed on filename never hits. Caching completed signed URLs would
  also be unsafe on retry (returns the failed URL). The remaining
  "image signing too slow" cost is the network round-trip itself —
  fix is server-side (e.g., pre-warm S3 credentials or move signing
  in-process) rather than a client cache
- `TherrMobile/main/routes/Map/index.tsx` `componentDidMount` — wrap
  non-critical socket subscriptions, analytics setup, and reaction
  prefetches in `InteractionManager.runAfterInteractions(...)` to defer
  work off the cold-start critical path
- `TherrMobile/main/getStore.tsx` — verify `redux-logger@3.0.6` is gated
  on `__DEV__`; confirm production bundle from `npm run ios:bundle:release`
  does not contain it

### 3.3.1 Mobile New Architecture follow-ups

Higher-value items deferred from the cheap-wins batch above because they
cross either the dependency-bump or migration-step risk threshold. Land
these after items in 3.3 are merged and a perf baseline is captured.

- Replace `AsyncStorage` in `redux-persist` with `react-native-mmkv`
  (already in deps at 3.3.3). 10–50× faster cold reads; needs a one-shot
  persisted-state migration step on first launch after the swap.
- Adopt `@shopify/flash-list` across the remaining ~26 `FlatList` usages
  beyond the three hot screens already in 3.3.
- `TherrMobile/main/components/BaseImage.tsx` — replace RN `Image` with a
  caching image component (`expo-image` or `react-native-fast-image`) for
  persistent disk cache; touches 24+ call sites and changes loading-state
  semantics, so audit each consumer.
- iOS New Architecture enablement: explicit `:fabric_enabled => true` and
  `:new_arch_enabled => true` in `TherrMobile/ios/Podfile`; per-pod
  Fabric-compat audit (react-native-maps, lottie-react-native,
  react-native-linear-gradient, react-native-image-crop-picker,
  react-native-webview).
- Replace deprecated `react-native-image-crop-picker@0.51.1` (used in
  Map and 5 Edit* screens) with a maintained Fabric-compatible
  alternative.
- Bump `react-native-linear-gradient` 2.8.3 → 3.x (Fabric support).
- Audit `lottie-react-native@7.3.5` Fabric path on Android with New Arch
  on; today only one usage in `Map/index.tsx`.
- Promote React Compiler from annotation mode (`'use memo'` opt-in) to
  `infer` mode on selected route trees once per-marker memoization and
  list migrations are merged so Compiler-generated memo doesn't fight
  hand-written memo.

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

### 3.5 CI/CD & deploy automation (dev → deploy → debug)

Automation of the build/deploy/debug pipeline so a small team spends less time
babysitting releases. See `docs/AUTOMATION_ROADMAP.md` for the full,
cost-weighted roadmap (including observability, auto-filed bug issues,
dependency automation, and marketing automation that live outside this
backlog).

- ✅ **Automated DB migrations on deploy** (roadmap #2) — **DONE.**
  `_bin/cicd/run-migrations.sh` runs `npm run migrations:run` in the
  freshly rolled-out pod for each migration-owning service whose
  `src/store/migrations` changed on a `main` deploy. Removes the recurring
  "run unconsumed migrations" manual follow-up. Additive/expand-contract
  migrations only; opt out with `RUN_MIGRATIONS_ON_DEPLOY=false`.

- [ ] **Post-deploy staging smoke tests + auto-rollback** (roadmap #3) —
  replace the stubbed `test-e2e-staging` job in `.circleci/config.yml`
  (currently `echo "Hello, Integration Tests"`) with a real synthetic suite
  hitting critical paths (auth, map/space read, post create, push send).
  Gate `stage → main` promotion on it and auto-revert the `kubectl set image`
  (or `kubectl rollout undo`) if post-deploy healthchecks/smoke checks fail.
  Turns a bad deploy into a ~minutes auto-rollback instead of a manual
  scramble. Effort: medium. Depends on a reachable staging cluster (the job
  scaffold and GKE auth already exist).

- [ ] **Unify CI/CD across all repos + CD for the cloud functions & infra**
  (roadmap #4) — standardize on one CI convention and add the missing
  continuous-deploy legs:
  - `therr-ai-automator` has Vitest tests but **no CI workflow** — add one
    (lint / tsc / test / build), mirroring `therr-messaging-automator/.github/workflows/ci.yml`.
  - Both automators deploy via a manual `npm run package:zip` + Terraform —
    add build→zip→deploy CD (GitHub Actions → Terraform apply) so a merge to
    the default branch ships the function.
  - `therr-infra-terraform` has **no CI** — add `terraform plan` on PR and
    `terraform apply` on merge so infra changes are reviewable and applied
    automatically instead of by hand.
  Effort: medium, mostly YAML + service-account wiring. Removes the
  manual-zip/manual-apply toil and makes infra diffs auditable.

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
- `main.moments` has **no foreign key on `spaceId`**, in every environment.
  `20230316132958_main.moments.js` intended to drop and re-add it with
  `onDelete('SET NULL')`, but it was written as an `async` alterTable callback,
  so knex emitted only the `dropForeign` and silently discarded the re-add (see
  the comment in that migration). Verified against a from-scratch replay: zero
  FK constraints on the table. If the constraint is wanted, it needs a **new
  forward migration** — do not edit the historical one, which would diverge
  fresh databases from production. That migration must first find and clear
  orphaned `moments.spaceId` values accumulated since 2023, or the
  `ADD CONSTRAINT` will fail.

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
- `SUPER_ADMIN_ID` is now defined identically in three services
  (`users-service`, `maps-service`, `messages-service/src/constants/index.ts` —
  the third added 2026-08-11 with the account-deletion fan-out, following the
  existing per-service convention rather than deviating from it mid-batch). Three
  copies of an env-keyed UUID map is one too many; hoist to
  `therr-js-utilities/constants` and re-export from each service so the existing
  import paths keep working

### 5.5 Mobile UX polish

These small toasts/dialogs each individually look minor but the
post-onboarding feel is the sum of them.

- `TherrMobile/main/routes/Login/LoginForm.tsx:133`,
  `routes/Register/RegisterForm.tsx:294` — RMOBILE-26: UI alert for
  registration failures
- `TherrMobile/main/routes/Areas/Nearby/NearbyWrapper.tsx:505, 532, 571`,
  `routes/Map/index.tsx:1087, 1172` — Display modal/instructions for
  enabling location after `never_ask_again`
- `TherrMobile/main/components/Input/HeaderSearchUsersInput.tsx:95` — Red
  dot to show filters enabled (blocked: user-search has no filter UI yet)
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
- `TherrMobile/env-config.js:43` — Import config from a shared location
  instead of duplicating
- `scripts/generate-content/utils/contentSchema.ts:143` — Implement planned
  new content section types per `docs/CONTENT_GUIDES_ROADMAP.md`
- `TherrMobile/main/**` (~56 import sites) — Migrate
  `react-native-vector-icons` (deprecated monolith, ships classic-JSX-
  transform builds → React 19 warning currently suppressed in `App.tsx`) to
  per-family packages: `@react-native-vector-icons/material-icons`,
  `/font-awesome`, `/font-awesome-5`, `/ionicons`, `/octicons`. Removes the
  suppression and unblocks future RN/React upgrades.

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
the `<!-- skill-followups:start -->` and `- [ ] (2026-08-23, /quality-peer-review) **Watch the first `stage` → `main` deploy after the
  pipeline rewrite lands, and confirm the plan table before letting it roll.** No service has a
  `PUBLISHED_*` row yet, so all eight resolve through `LAST_PUBLISHED_GIT_SHA=3f1d5ba` — a tag the
  publish job only ever pushed for the services that merge rebuilt. Services already on that tag
  come out `up-to-date` and are skipped; any the cluster is genuinely behind on will come out
  `missing-image` and block before touching the cluster. The fix in that case is to re-run the
  stage pipeline so it publishes and writes per-service rows — not to hand-edit `VERSIONS.txt`.
- [ ] (2026-08-23, /quality-peer-review) **After the first successful deploy, confirm `VERSIONS.txt`
  on `stage` has grown a `PUBLISHED_*` row per service.** That is the signal the ledger transition
  is complete and the `LAST_PUBLISHED_GIT_SHA` fallback is no longer load-bearing.
- [ ] (2026-08-23, /quality-peer-review) **Make a CircleCI rerun of the stage publish job
  reconcile with `origin/stage` before committing `VERSIONS.txt`.** A rerun starts from a fresh
  checkout at `CIRCLE_SHA1`, so the working tree holds the pre-publish ledger while
  `origin/stage` already carries the `[skip ci]` commit the first run pushed. `publish.sh` then
  builds a sibling commit and `git push` is rejected as non-fast-forward — the job reports a
  broken publish that actually succeeded. Pre-existing (the pre-rewrite script failed the same
  way), and not something the empty-index guard addresses. Fix is to `git fetch origin stage` and
  re-load the ledger from the remote tip before `ledger_write`, so the guard sees the real state.
  Until then, recover by re-running the *stage pipeline* rather than the single job.
<!-- skill-followups:end -->`
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
