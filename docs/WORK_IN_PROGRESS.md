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
- [ ] **Expect users-service to land on a preemptible node after its next
  deploy.** The strategy moved `Recreate` → `RollingUpdate` with
  `maxUnavailable: 0`, so a deploy now briefly runs two pods. main-pool has
  ~103Mi of its 1358Mi allocatable memory uncommitted, and the surge pod
  requests 144Mi, so it cannot fit alongside the outgoing pod. Node affinity is
  `preferred`, not `required`, so it will schedule onto a preemptible node
  instead of sitting `Pending` — the rollout succeeds, but users-service then
  runs somewhere it can be preempted. Either accept that, or free ~150Mi on
  main-pool before the deploy. Check with
  `kubectl describe node <main-pool-node> | grep -A5 'Allocated resources'`.
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
- [ ] (2026-08-04) **Finish credential sharing now that `/.well-known/assetlinks.json` actually serves.** The `delegate_permission/common.get_login_creds` relation is live on `therr.com`/`www.therr.com` (`app.therrmobile`) and `dashboard.therr.com`, and the web login form now sends `autocomplete="username"` / `"current-password"` so Chrome has a credential worth sharing. Three gaps remain, each a decision rather than an oversight: (1) `assetlinks.habits.json` still declares only `handle_all_urls`, so Friends with Habits (`com.therr.habits`) gets App Links but no credential sharing — add the relation there if HABITS should share credentials with `habits.therr.com`. (2) `get_login_creds` is Android-only; the iOS equivalent is shared web credentials, which needs `webcredentials:therr.com` in `TherrMobile/ios/Therr/Therr{Debug,Release}.entitlements` (currently `applinks:therr.com` only) **and** a `webcredentials: { apps: ['22AN4MZ6H5.com.therr.mobile.Therr'] }` block alongside `applinks` in the `appLinksJson` object in `therr-client-web/src/server-client.tsx`. (3) That same AASA is served at `/apple-app-site-association` but its `/.well-known/` twin is still commented out one line below — Apple's CDN fetches the `.well-known` path, which now works, so uncomment it. Verify on-device after deploy: save a password on the website, then confirm Android offers it in the app — that is the only end-to-end proof the association resolved.
- [ ] (2026-08-08, notification-queue) **Enable the notification queue worker and migrate
  the digest onto it.** `main.notificationQueue` + `NotificationQueueStore` +
  `startNotificationQueueWorker` are deployed but inert: nothing enqueues, and the worker
  no-ops unless `NOTIFICATION_QUEUE_WORKER_ENABLED=true` on users-service. Next step is to
  move the digest's three types (`streakAtRisk`, `partnerMissedDay`, `pactExpiring`) to
  `enqueueNotification`, turn the worker on, and confirm dedup by running the digest twice
  — which retires the standing "never add a second trigger path" rule in root CLAUDE.md,
  since dedup becomes a UNIQUE constraint rather than a convention. Also wire
  `deleteCompletedBefore` to something before the table grows. Design and sequencing:
  `docs/NOTIFICATION_QUEUE_DESIGN.md`.
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
  (the digest at `habitsDigest.ts` is the natural home for the daily three, but note it
  has no server-side dedup and runs from a single Cloud Scheduler job), schedule them
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
- [ ] (2026-07-03, deferred-phone-verification) Frontend follow-up: add a contextual re-prompt when a phone-unverified user hits a `MOBILE_VERIFIED`-gated action (currently only bulk `multi-invite` returns 403). **Partially resolved 2026-08-01:** `TherrMobile/main/routes/Invite/PhoneContacts.tsx` no longer swallows the 403 — it surfaces a "Verify Your Phone" toast, and the SMS/email composer opens regardless, so the button is never a silent no-op. Still open: turn that toast into a prompt that deep-links to phone verification (verification currently only exists inside the `CreateProfile` onboarding stack, so it needs a reachable entry point first), and audit any other action that assumes phone presence. Note this still hits the *already-deployed* app, which cannot be force-updated.
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
- [ ] (2026-05-07, /quality-peer-review) (Optional) Set
  `HABITS_FREE_PACT_LIMIT` env var on production users-service if you want to
  override the default of 5. Project brief target is 1 once HABITS payment
  workflow is live and users can actually upgrade — see
  `docs/niche-sub-apps/habits/HABITS_PAYMENT_WORKFLOW.md`. Lowering before
  payments ship will block early HABITS adopters from creating pacts.
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
- [ ] (2026-07-28, /quality-peer-review) Apply the
  `20260727000000_main.userInterests.affinityScore` columns on production
  **before** the users-service image rolls out. `run-migrations.sh` runs
  migrations *after* `kubectl set image` and after `kubectl rollout status`
  returns, but the new `incrementUserInterestsByKey` names `affinityScore` /
  `lastEngagedAt` / `source` in its INSERT column list, so against the
  pre-migration schema every interest-engagement flush raises
  `column "affinityScore" ... does not exist` for the whole rollout window.
  Failures are caught and logged by the maps/reactions flush buffers (dropped
  increments + `Failed to flush interest engagement` error spans), so this is
  lost preference-learning data and alert noise rather than user-facing 500s —
  but it is avoidable. The migration is written `IF NOT EXISTS` specifically so
  the columns can be added by hand ahead of the deploy and the automated run
  becomes a no-op. Reads are unaffected (`getByUserIds` selects `*`).
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
- [ ] (2026-08-03, /quality-peer-review) Run the reactions-service migration
  `20260803000002_main.thoughtReactions.algorithmKey` BEFORE (or in the same
  window as) the users-service deploy. users-service now sends `algorithmKey` in
  the `createReactions` body, and reactions-service's
  `createOrUpdateMultiThoughtReactions` spreads the whole body into the INSERT
  and UPDATE. If the column is missing, every thought-activation batch fails with
  `column "algorithmKey" does not exist` — the error is caught and logged by
  `createReactions`, so the feed silently stops seeding rather than erroring
  visibly. Introduced by c15466695.
- [ ] (2026-08-03, /quality-peer-review) Run the users-service migration
  `20260803000001_main.users.settingsContentAlgorithm` before the mobile release
  that ships the Settings picker. It backfills every row to `'pulse'`, which
  reproduces the pre-abstraction ranker exactly, so no existing feed changes.
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
- [ ] (2026-08-09, /quality-peer-review) Run `npm run migrations:run` on production for
  `20260808000001_main.notificationQueue.js` (users-service). Creates `main.notificationQueue`
  plus its UNIQUE dedupe constraint and two indexes. Nothing reads the table until the
  worker is enabled, so this is safe to land ahead of the flag below.
- [ ] (2026-08-09, /quality-peer-review) Leave `NOTIFICATION_QUEUE_WORKER_ENABLED` **unset**
  on the first users-service deploy — the queue is designed to go out dark so it can be
  observed filling before it is allowed to send. Turn it to `'true'` only after confirming
  rows accumulate with the expected `brandVariation` / `dedupeKey` and no producer is
  writing a `dedupeKey` containing a timestamp (which would silently disable dedup).
  Introduced by 66e3d8fd8.
- [ ] (2026-08-09, /quality-peer-review) Before enabling that worker, decide how send
  failures should be recorded. `sendEmailAndOrPushNotification` ends in a `.catch` that
  logs and resolves, so `sendOne` reaches `markSent` even when the push actually failed —
  which means `markFailed`, `requeueFailed` and `MAX_ATTEMPTS` only ever catch a crash
  between claim and mark, never a real FCM or push-service failure. The retry story in
  docs/NOTIFICATION_QUEUE_DESIGN.md does not hold until this is addressed. Not fixed in
  review because the swallow is in a shared function with many inline callers.
- [ ] (2026-08-09, /quality-peer-review) Wire up `NotificationQueueStore.deleteCompletedBefore`
  — it is implemented but has no caller, so queue retention never runs and the table grows
  without bound. Note it deletes only `sent`/`skipped`, so rows exhausted at `MAX_ATTEMPTS`
  stay `failed` forever and permanently hold their `(brandVariation, userId, dedupeKey)`
  slot, blocking any re-enqueue of that key.
- [ ] (2026-08-09, /quality-peer-review) After the push-diagnostics endpoints deploy, re-run
  `_bin/push-debug.sh` against production to confirm the iOS Habits fix (13e0e4058) actually
  lands — the `apns-topic` for HABITS and TEEM now resolves to `com.therr.mobile.Therr`, and
  APNS drops a wrong topic silently, so only a real device test closes this out.
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

Still open in this area:

- Reaction handlers force `userHasActivated: true` regardless of the request
  body, so an authenticated user can still mark any addressable content as
  activated. Closing this needs proximity/view verification, not a bounds check
- The reaction handlers spread `...req.body` straight into the store, and
  express-validator only validates listed fields rather than stripping unlisted
  ones — so any column on the table is mass-assignable. Prefer an explicit
  allow-list at the store boundary
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

The analytics half of this same gap is tracked in
`therr-workspace/docs/MARKETING_ATTRIBUTION_PLAN.md` Phase 2: checkout is a Stripe
**Payment Link** opened with `target="_blank"` (`therr-client-web-dashboard`:
`PricingCards.tsx:97,134,172`, `Sidebar.tsx:280,283`, and the four `*Menu.tsx`
components), so the GA4 session ends at the click and **no `purchase` event exists in
any property**. Moving to a Checkout Session with a `success_url` back into the
dashboard closes both problems at once — the redirect is what lets the account get
upgraded *and* what keeps the session alive for attribution. Doing only the
`paymentSessionId` half leaves revenue permanently unattributable to a campaign.

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

- `therr-services/users-service/src/handlers/userConnections.ts:661` —
  `getUserConnection` has no brand filter. Needs a judgment call first: it reads a
  single connection by `(requestingUserId, acceptingUserId)`, so it is a targeted
  lookup rather than discovery. Separately, `requestingUserId` comes from the route
  param and is never checked against the caller's token — the IDOR question is
  probably the more valuable one here
- `therr-services/users-service/src/handlers/users.ts:841` —
  `updateLastKnownLocation` is not brand-aware (lower risk — a mutation on the
  caller's own row, listed for completeness)

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
- `clearUserDeviceToken` (users.ts:1321) looks correct as written — it deletes via
  `deleteByToken`, and FCM token strings are unique per device *install*, so each
  brand's app holds a distinct token and deletion by token cannot hit the wrong
  app. Worth a confirming read of `UserDeviceTokensStore.deleteByToken` before
  deleting this note outright

Closed 2026-07-20 (/work-plan): `searchUserPairings` is now brand-scoped via a new
`brandVariation` arg on `UsersStore.searchUserSocials` (regression tests added).
`getInviteByToken` now resolves cross-brand *by design* and returns the invite's
origin `brandVariation` (new `20260720000001_main.invites.brandVariation` migration)
so the landing page can route the invitee to the right app.

Frontend follow-up for the invite change (therr-client-web, separate commit — the
backend half only makes the field available):

- Invite-landing page — consume the new `brandVariation` field from
  `GET /users/invites/:token` and deep-link the invitee to the app the invite was
  minted in. Until this lands, a Habits invite opened on a Therr-branded landing
  page still points the user at the Therr install

Related routing hygiene, found while fixing the `POST /users/search` 400 on
2026-07-20 (gateway `/users/:id` was registered before the literal routes and
shadowed `/users/search`, `/users/search-pairings`, `/users/forgot-password`,
and `/users/notifications`): the other gateway routers have not been audited
for the same param-before-literal ordering bug. A shadowed route fails with a
validation 400 that looks like a client payload bug, so these are expensive to
diagnose.

- `therr-api-gateway/src/services/*/router.ts` — Audit every router for
  `:param` routes registered before literal sibling routes on the same method
  and path prefix. Prefer a startup assertion or lint rule over a one-time
  sweep, since new routes reintroduce the bug

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

The free-tier pact gate is wired (`isPactCapExempt` in `pacts.ts`, env var
`HABITS_FREE_PACT_LIMIT`, default 5; pact-create returns HTTP 402 when
exceeded). The actual purchase flow is documented in
`docs/niche-sub-apps/habits/HABITS_PAYMENT_WORKFLOW.md` — 4 components still
to build:

- Stripe Product + webhook handler that grants `AccessLevels.HABITS_PREMIUM`
  on subscription activation and removes it on cancellation.
- Web checkout page on `habits.therr.com` (Stripe Checkout, hosted) gated
  by a short-lived JWT minted by the mobile app.
- Mobile paywall UI (`UpgradePaywall.tsx`) that opens the web URL in the
  external browser on the 402 response.
- `habits://upgrade-complete` deeplink handler that refreshes the user's
  access levels.

Once shipped, lower `HABITS_FREE_PACT_LIMIT` env var on prod from 5 to 1 to
match the project brief target.

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
- `_bin/cicd/publish.sh:104` — Output a list of all services that should be
  deployed for the given commit
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
