# Therr App - Feature List

**Last Updated:** August 2026
**Scope:** TherrMobile (React Native) and therr-client-web (React SSR)

> **For AI agents:** Update this file whenever you add, remove, or significantly change a feature.
> Keep entries to one line each. This document is intentionally concise to minimize context usage.

---

## Platform-Wide Features (Mobile + Web)

### Authentication & Accounts
- **Email/password registration & login** — with email verification code flow
- **Google OAuth** — social sign-in on both platforms
- **Apple OAuth** — social sign-in (mobile)
- **Phone verification** — optional during profile creation
- **Passwordless phone sign-in** (mobile) — entering a phone number in the sign-in field swaps the password step for a texted 6-digit code (`POST /v1/phone/auth/start` → `/auth/verify`). Enumeration-safe: the "code sent" response is identical whether or not an account exists. When a number is attached to several accounts, an account picker completes sign-in via `/auth/select`
- **Phone-first sign-up** (mobile) — verify a phone number by SMS, then add an e-mail and (optionally) an invite code; the account is created already `MOBILE_VERIFIED` and a password is optional. The e-mail still receives its normal verification message
- **Accounts per phone number** — brand-configurable cap (`getMaxAccountsPerPhone`): Therr allows one personal + one creator + one business account per number, Friends with Habits allows exactly one. When a number already holds an account, sign-up asks which type the new one is and offers only the free types; a first account still picks its type on the profile-creation screen
- **Remembered profiles** (mobile) — the sign-in field pre-fills the account last used on the device, with a chevron that opens a switcher to change accounts, remove a saved one, or start fresh. Stored locally through `SecureStorage`; holds no credentials or tokens
- **Password reset** — forgot-password email flow
- **Account types** — personal, business, and creator accounts
- **Organization management** — business account grouping

### User Profiles
- **Guided profile completion (mobile)** — a single-row "Finish your profile" link on the user's own profile summarizes how many steps are left and opens the dedicated `ProfileCompletion` screen, which lists the remaining steps (name, interests, photo, phone, contact sync) with a progress bar; each row hands off to the matching stage of the guided `CreateProfile` flow, which carries a Duolingo-style step progress bar and per-stage back navigation. The home-feed nudge banner reads the same step model. The link disappears once every step is resolved
- **Contact sync step (mobile)** — a first-class onboarding stage that asks to match phone contacts against existing accounts, with an explicit "Not Now". A completed sync is recorded per user, which collapses the sync prompt on the people list to a single "sync again" link
- **Collapsing profile header (mobile)** — the profile photo, bio, socials and action buttons scroll away as the user moves down a content tab and slide back in on the way up, leaving the tab bar pinned to the top. Every tab shares one header position, so switching tabs never makes it jump
- **Profile editing** — name, bio, profile picture, privacy settings
- **View other users** — public profile with content tabs (spaces, events, thoughts)
- **User search & discovery** — search by username, "people you may know" suggestions
- **Social sync** — link Twitter and YouTube accounts

### Social & Connections
- **User connections** — friend requests with 5 types (blocked, removed, pending, accepted, friend)
- **Direct messaging** — real-time 1-on-1 chat via WebSocket (Socket.IO)
- **Groups/Forums** — create/join public or private communities with admin/moderator roles
- **Group chat** — real-time forum messaging within groups
- **Group events** — events associated with a group
- **Invite friends** — referral system with TherrCoin rewards
- **Magic invite links** — per-invite tokenized links (`/invite/link/:token`) that pre-fill the invitee's known email/phone, trust the invited channel (emailed token → email verified, SMS token → phone verified), auto-accept the invite, and auto-connect the two users on signup
- **Deferred phone verification** — users reach the app with just a username; phone is optional at onboarding and enforced only on phone-sensitive actions (bulk invites require `MOBILE_VERIFIED`)

### Location-Based Content
- **Moments** — geo-tagged ephemeral photo posts; proximity-gated visibility, max view limits
- **Spaces** — persistent location/business pages; claim storefronts, menu/reservation/order URLs, ratings, check-ins
- **Events** — time-bound location happenings; start/stop scheduling, group/space association
- **Thoughts** — micro-posts with categories, reply threads, mentions, hashtags
- **Ranked social feed (mobile)** — Discoveries/Thoughts tabs ordered by engagement score (recency decay × likes/replies/views × category affinity from the user's own reactions); backend stream activation ranks candidates by the same scoring contract. Both sides read the curve from the user's selected content algorithm (see § Content Algorithms), so client re-ranking and server activation agree
- **Auto-expanded thread previews (mobile & web)** — engaging thought threads show their top reply inline with a "View all N replies" link (Twitter-style); each post card also carries a reply-count control. Auto-expand criteria are shared: 2+ replies always expand, single-reply threads need a like signal on the parent or the reply
- **Nested reply counts (mobile & web)** — in the thought details view only, each reply renders a reply icon with its own nested reply count; tapping it opens that reply's details view so threads can be walked one level at a time
- **Inline reply likes (mobile)** — replies in the thought details view carry their own like control with an optimistic toggle (reverted if the request fails), so a reply can be liked without opening it. `getThoughtDetails` returns each reply's like count and the requesting user's reaction
- **Parent thread context (mobile & web)** — a thought that is itself a reply opens with a quoted "Replying to @user" banner above it, linking up to the post it answers, plus a "Back to Thread" action and a breadcrumb/header that reads "Reply". `getThoughtDetails` takes `withParent` and returns `thought.parent` (author + message). The parent is only returned when the caller could open it in its own right — public, authored by them, or already activated — and is never activated as a side effect of viewing a reply. `createThought` applies the same test to `parentId` before minting a reply, so "is a reply of X" cannot be used to reach an X the author was never allowed to see
- **Local posts in a new user's feed** — thoughts can carry their own coordinates (`main.thoughts.latitude/longitude/locality`), and the stream distributor runs a third candidate query for posts about where the user lives, boosted above equally hot general content (`localMatchBoost`). The home point comes from `main.userLocations` — a declared home, an established dwelling, or, for an account minutes old, its first location ping. Sharing a location re-seeds the stream immediately (gated on the same per-user window as the notifications poll) rather than waiting for the next sign-in
- **City detection on human posts** — a public top-level thought joins its city's local feed when it clears two gates: it explicitly names exactly one city (`detectLocality`, matched against the existing `Cities` catalog), **and** its author is within `LOCAL_AUTHOR_MAX_DISTANCE_METERS` (60km) of that city. Post text is user-controlled, so the proximity gate is what stops anyone from farming a city's feed by typing its name; the distance is measured from the same point the feed uses to pick that user's local content, so you can only tag a city whose local feed you would be served. Nothing is accepted from the request body. Names that double as people or as the same city in another state (Austin, Charlotte, Arlington) additionally need a place cue — "in Austin", "Austin, TX" — **or** an author who lives there, since locals name their own city bare constantly and their location is what disambiguates it; names that collide with an ordinary word (Phoenix, Mesa, Aurora) always need the cue, because where someone lives says nothing about which sense they meant. A post naming two cities is left untagged rather than assigned one of them
- **Location-aware bots** *(pending — this repo's half only)* — `therr-ai-automator` accounts with a declared home city are seeded here (`006_local_bot_users.js`) and the distributor will surface their local posts, but as of 2026-08-22 the automator does not yet read those homes or stamp coordinates on what it writes, so no bot content is location-tagged in production yet. Until it ships, `detectLocality` on human posts is the only source of local content
- **Reposts (mobile & web)** — re-share a thought to your own audience, with an optional quote. A repost is an ordinary `main.thoughts` row whose `repostThoughtId` points at the original (`isRepost` is derived server-side from that column, never trusted from the client); an empty message is a plain repost, a non-empty one is a quote repost. Every read path hydrates `repostOf` (the original plus its author) and `repostCount`, re-applying the caller's brand filter to the original — so a deleted, mature-flagged, or cross-brand original degrades to an "unavailable" embed rather than a blank card. Reposting a repost collapses onto the root so embeds never nest and credit never drifts to the intermediate reposter; a non-public thought can only be reposted by its own author; the original's author gets a `THOUGHT_REPOST` in-app and push notification
- **Content categories** — 20+ categories (food, music, nature, art, gaming, etc.)
- **Media uploads** — image upload with CDN (ImageKit), YouTube video embedding

### Engagement & Reactions
- **Reactions** — like, dislike, super-like, super-dislike on all content types
- **Bookmarks** — save content for later; browse saved items by type
- **Ratings** — 1-5 star ratings for spaces and events
- **Check-ins** — check in at spaces (with valuation tiers for rewards)
- **Content reporting** — flag content for moderation
- **Content sharing** — share URLs to external platforms

### Gamification & Rewards
- **Achievements** — 12 classes (explorer, influencer, socialite, communityLeader, eventPlanner, activist, journalist, tourist, tourGuide, thinker, humanitarian, critic) with tiered progression
- **TherrCoin currency** — earned through social actions, check-ins, referrals
- **XP system** — experience points from achievements
- **Points exchange** — redeem accumulated rewards
- **Reward claim celebration (mobile)** — claiming an achievement reward plays a synthesized coin "ka-ching" on grant and a full fanfare synced to the confetti animation on the claim screen, each paired with an escalating haptic ramp. Sounds are generated at runtime via `react-native-audio-api` (no bundled audio files) using an `ambient`/`mixWithOthers` session, so they honor the iOS ringer switch and never interrupt the user's music; haptics honor the Android system haptics setting
- **Leaderboards** — Duolingo-style weekly (Monday UTC reset) + all-time XP rankings with Everyone/Friends scopes, per-brand (works for Therr and Friends with Habits). XP accrues from achievement progress and habit check-ins/streak milestones, plus a **weekly quota bonus** (`min((7 - target) * 10, target * 15)`) so a fully-honoured non-daily commitment can place against a daily one — weekly totals run 30/60/85/90/95/100/105 for targets 1 through 7, monotonic in effort with daily still ahead, and the cap is what stops a declared 1x/week habit out-earning the work. A daily habit's bonus is 0, so existing scores are untouched; separate from the spendable TherrCoin balance. A completed check-in also earns a **proof bonus** — +5 XP for a note (10+ characters), +10 for a photo or video, +15 for both — whether the proof is attached at check-in or added afterwards from the note/photo screen. `habits.habit_checkins.proofXpAwarded` is a high-water mark, so a re-save, or removing and re-adding a photo, pays nothing more; the check-in response reports `proofXpEarned` for the client toast. Opt-out via `settingsIsLeaderboardEnabled`. Climbing into the weekly top 10 / top 3 / #1 triggers a rank-milestone push notification and `weeklyChampion` achievement progress. Reached from the right-hand drawer, a link on Achievements, and (Friends with Habits) a row on the habits dashboard's progress card showing the user's weekly rank. A check-in that improves the weekly rank shows a "You climbed to #N" toast once the check-in toast has closed — dropped rather than shown late if a celebration or the note screen has taken over

### Notifications
- **Push notifications** — Firebase Cloud Messaging; location-triggered. Copy is brand-agnostic; `brandVariation` selects the Firebase app, the APNS topic, the Android accent colour and the intent action, and gates which *types* a brand may receive at all — Therr's map/moment/space retention copy is never sent to a Friends with Habits handset
- **Notification action buttons** — Android notifications can carry actions rendered by Notifee (`data.notificationLinkPressActions`). Habits check-in nudges offer a one-press "Check In" that completes the check-in from the tray without opening the app, and falls back to a "View" action whenever the notification stands in for more than one habit
- **In-app notifications** — real-time via WebSocket; mark read, notification history
- **Notification channels** — default, content discovery, reward updates, reminders (Android)
- **Dwelling-aware notification muting** — nearby-search push notifications are suppressed while the user is at a place they live or are staying (home, apartment, hotel, extended stay). A `main.userLocations` row becomes a "dwelling" once observed across multiple distinct calendar days, or when explicitly declared home; stale dwellings decay after 30 days without a visit. Areas are still discovered, activated, and recorded in the in-app notification list — only the interruptive push is muted

### Campaigns & Business Tools
- **Campaigns** — create/manage marketing campaigns with status tracking and ad goals
- **Geo-fenced promotions** — location-targeted deals for businesses
- **Featured incentives** — promote spaces with special offers
- **Space metrics** — engagement analytics for business owners

### Offline & Resilience
- **Offline content viewing** — cached content (spaces, moments, thoughts, notifications) displayed when offline via redux-persist
- **Network status detection** — real-time connectivity monitoring (NetInfo on mobile, window events on web)
- **Offline banner** — dismissable UI indicator when device is offline
- **Graceful degradation** — GET requests fail silently with cached data; no blank screens during outages

### Settings & Preferences
- **Theme selection** — light, dark, retro
- **Language selection** — en-us, es, fr-ca (mobile & web)
- **Pre-login language switcher** — change locale on the Login/Register screens before authenticating; selection persists to the new account on signup (`settingsLocale`)
- **Notification preferences** — per-channel enable/disable
- **Mature content filter** — toggle visibility of mature content
- **Feed algorithm picker (mobile)** — choose how content is ranked; stored on `main.users.settingsContentAlgorithm` (see § Content Algorithms)

### Content Algorithms
- **Selectable ranking profiles** — one scoring contract in `therr-js-utilities/content-ranking` drives both server-side stream activation (users-service thought distributor) and client-side carousel re-ranking. Each profile is a weight vector over recency/engagement/interest/geo plus policy knobs (candidate pool size, activation batch range, per-author diversity cap, hard interest filter), overridable per-deploy via `ALGO_<KEY>_<FIELD>` env vars
- **Pulse** (default) — "what's happening right now"; recency and engagement dominant. Reproduces the pre-abstraction production hot score exactly, so existing users see no reshuffle
- **Focus** — "only what you chose"; hard-filtered to declared interests, smaller batches, lower volume. Falls back to unfiltered candidates for users with no interests, so SSO/onboarding-skip accounts never get an empty feed
- **Wander** — geo-dominant local discovery; implemented but not yet user-selectable (the API gateway validates against `SELECTABLE_CONTENT_ALGORITHMS`, not the full enum). `main.thoughts` now has coordinates, but only the minority of posts that are about a place carry them, so a geo-dominant profile would rank those few above the whole feed; local content instead reaches every profile through the distributor's local candidate query
- **Switching rebuilds the stream** — changing the setting NULLs previously-activated relevance scores (they're only comparable within the profile that produced it) and releases the distributor throttle so the next poll re-seeds. Activated rows are stamped with the `algorithmKey` that scored them

### Payments
- **Stripe integration** — web/subscription payments
- **In-app purchases** — iOS App Store and Google Play support

---

## TherrMobile-Only Features

- **Interactive map** — real-time location discovery with custom markers, clustering, geo-filtering, and map action buttons
- **GPS location services** — continuous location tracking with permission management
- **Check-in with throttling** — time-gated check-ins at spaces
- **Activity generator** — interest-based activity suggestions
- **Activity scheduler** — plan and schedule activities
- **Phone contacts integration** — sync contacts for friend invitations
- **Camera & image picker** — capture/select photos with crop and compression
- **Get directions** — open native maps for navigation to locations
- **Haptic feedback** — vibration feedback on key interactions, including the achievement reward-claim celebration ramp
- **Secure storage** — encrypted local storage for sensitive data
- **Location disclosure modal** — privacy explanation for location permissions
- **Nearby content carousels** — swipeable tabs for discoveries, events, thoughts, news
- **Draft management** — save and resume content drafts
- **Animated onboarding** — landing page with background carousel
- **Android app shortcuts** — long-press the launcher icon for quick links straight into Create Moment / Create Thought
- **App review prompt** — after several delight moments (a posted moment, a claimed reward) and a few days of use, asks whether the user is enjoying the app; "yes" links to that brand's store listing to write a review, "not really" opens a support email instead. Rate-limited and one-way: opting out or reviewing is permanent per install

---

## therr-client-web-Only Features

- **Server-side rendering (SSR)** — Express-based SSR for SEO and performance
- **Locale-prefixed URL routing** — `/`, `/es/`, `/fr-ca/` with automatic detection
- **SEO optimization** — dynamic meta tags, canonical URLs, hreflang links per locale
- **Leaflet.js map** — interactive map for browsing spaces with lazy loading
- **Email preferences** — unsubscribe page for marketing, activity, likes, invites, mentions, messages, reminders
- **App feedback survey** — feature feedback form (social health, loyalty rewards, missing features)
- **Child safety page** — CSAE prevention policy and reporting information
- **Delete account page** — self-service account and data deletion
- **Invite landing pages** — referral URLs with bonus coin redemption
- **iOS waitlist** — neither app has a published iOS build, so the App Store CTA on the
  therr.com home page and the habits.therr.com landing page opens a dialog explaining that
  rather than linking a listing. Fires `ios_interest_click` (the demand metric) and, for the
  optional email field, `ios_waitlist_submit`; addresses land in
  `main."emailMarketingSubscribers"` flagged `isSubscribedToIosWaitlist`
- **Explore hub** — central discovery page with moments, spaces, thoughts, and people tabs
- **Space management** — list and manage all user-created spaces
- **Discovered feed** — recently shared community content
- **Progressive image loading** — optimized media delivery
- **Accessibility** — ARIA labels, alt text, semantic HTML, color scheme toggle

---

## Feature Flags (Niche App Configuration)

These flags control which features are enabled per brand variant. Set in `TherrMobile/env-config.js` or equivalent web config.

| Flag | Controls |
|------|----------|
| `ENABLE_MAP` | Interactive map tab and location discovery |
| `ENABLE_AREAS` | Content browsing (moments, spaces, events nearby) |
| `ENABLE_GROUPS` | Groups/forums tab |
| `ENABLE_CONNECT` | People discovery and friend requests |
| `ENABLE_MOMENTS` | Moment creation and viewing |
| `ENABLE_SPACES` | Space/location creation and viewing |
| `ENABLE_EVENTS` | Event creation and viewing |
| `ENABLE_THOUGHTS` | Thought creation and viewing |
| `ENABLE_DIRECT_MESSAGING` | 1-on-1 messaging |
| `ENABLE_ACHIEVEMENTS` | Achievement tracking and rewards |
| `ENABLE_ACTIVITIES` | Activity generator |
| `ENABLE_ACTIVITY_SCHEDULER` | Activity scheduling |
| `ENABLE_NOTIFICATIONS` | Notification center |
| `ENABLE_FORUMS` | Forum messaging within groups |

---

## Niche App Extensions

### Habits System (Friends with Habits — `BrandVariations.HABITS`)

- **Habit goals** — create from ~40 system templates (browsable by category: movement, money, mind & mental health, health, focus & screen time, learning & creativity, relationships, home; translated client-side via `templateKey`) or custom; goal-orientation (`goalType`: build_good / break_bad / savings_goal / maintenance)
- **Habit cadence** — not every habit is daily, and treating one that isn't as if it were punished the user for keeping it. A habit declares one of three shapes on `habits.habit_goals`: every day (`frequencyType: 'daily'`), N times a week on any days (`weekly`/`custom` + `frequencyCount`), or fixed weekdays (`targetDaysOfWeek`, Sunday-first, which wins over `frequencyType` in both directions). `utilities/habitCadence.ts` is the **single** definition — streaks, freezes, reminders, achievements, the phase engine and the leaderboard all resolve cadence through it, replacing four implementations that disagreed. The load-bearing rule: under a weekly quota a day is *required* only once skipping it would put the target out of reach, so a "4x per week" user can take their other three days freely — no broken streak, and no spent streak freeze. Editing a cadence applies forward only (`cadenceEffectiveFrom`): the running streak survives and days lived under the previous cadence are never re-judged, which is also what grandfathers habits that were already non-daily when this shipped
- **Pacts** — accountability partnerships; invite partners, set consequences (donation/dare/custom)
- **Habit check-ins** — daily completion tracking with photo/video/note proof. A **habit day is the user's own calendar day**, not UTC: `habits.habit_checkins.scheduledDate` is resolved from `main.users.settingsTimezone`, then the device zone the client sends as `timeZone`, then the service fallback (`resolveCheckinHabitDate`). A date the client asks for is honoured when it is today or earlier — backdating a missed day is supported — and clamped down when it is ahead of the user's today, which is what an older client's UTC stamp is every evening west of UTC. Every per-user read of "today" resolves the same way, so the calendar grid, the dashboard's today list and the pact cards all agree with what was written
- **Savings goals (amount tracking)** — a `savings_goal` habit records *how much*, not just whether. `habits.habit_goals` carries `targetAmount` / `currencyCode` / `savingsTargetScope` and each check-in carries `savedAmount` (both `numeric(12,2)`); the totals are summed from the check-in rows rather than denormalized, so an edit or a delete cannot leave a running total drifted. `savingsTargetScope` resolves the genuine ambiguity in "we're saving $2,000 for the trip": `per_member` (the default — each participant's own goal, reached only when *every* active member is there) or `group` (the combined pot). `GET /habits/pacts/:id` returns `savingsProgress` with the group total, a per-member breakdown including members who have saved nothing, the viewer's own total, what is left, and `isGoalReached`; the habit list returns each savings habit's cumulative `totalSaved`, which spans renewal cycles because money saved does not stop existing when a pact cycle ends. Reaching the target completes the pact and queues `pactCompleted` (no winner is named — a savings goal is finished by everyone who contributed). A target is optional: an open-ended savings habit tracks a total and simply never completes. Amounts are parsed through the isomorphic `parseSavingsAmount`, and all comparison and addition happens in integer cents, so a total that reaches the target to the penny is never reported as short
- **Savings amounts from the notification** — a check-in reminder for a single savings habit carries `isSavingsGoal` + `currencyCode` and offers the `habit-checkin-savings` press action, an amount input on the notification itself, in place of the plain one-press "Check In". This is aimed at the user who checks in from the tray and never opens the app to add the detail. Only on a single-habit nudge — a rolled-up nudge covering three habits has nothing unambiguous to record an amount against — and the typed value is re-parsed server-side, since a system text field applies no validation of its own
- **Streaks & milestones** — streak counting, milestone events, celebration triggers
- **Daily streak (app-level)** — one streak per user across *all* habits, counted in the user's own timezone rather than UTC: every check-in stamps `habits.habit_checkins.localDate` from `main.users.settingsTimezone` (then the device zone, then the service fallback), so a 23:50 check-in counts for the day the user is living in. `scheduledDate` now resolves in the same zone, so the two agree for an ordinary check-in and differ only for a backdated one or a legacy client. A day is *upheld* by any completed check-in. A day on which **no tracked habit was required** by its cadence is *rest*: it neither upholds the streak nor breaks it, and — the point of the mechanism — borrows no freeze. Before that existed, a user doing four workouts a week spent a freeze on each of their three off days, emptied a pool that caps at 3, and lost a streak they had actually earned. A *required* day with no check-in borrows one streak freeze from the habit with the most remaining (tie → longest habit streak → oldest habit) and is recorded *frozen*, and with no freezes left it is *missed* and the streak resets while `longest` is retained. The freeze pool is shared with per-habit streaks — spending one for the daily streak decrements that habit's own count. Backdating is allowed for today and yesterday, and a backdated check-in that fills a frozen day refunds the freeze; deleting the only check-in for such a day re-opens it. Evaluation is lazy (on read) *and* scheduled (inside the daily habits digest, plus the internal `POST /habits/daily-streak/evaluate-all`), and both run the same idempotent walk over `habits.daily_streak_days`, the per-day ledger the week strip and perfect-week logic read. A perfect week is Mon–Sun with every day upheld or rest, at least one upheld, and no freezes — which for a user whose habits are all daily is exactly the old rule (all seven upheld), since they have no rest days
- **Weekly recap** — one Monday–Sunday week of habit activity, read back to the user: the day strip off `habits.daily_streak_days`, per-day and per-habit check-in counts, the streak as it stood when the week closed, and the same totals for the week before. Served read-only by `GET /habits/weekly-recap/me?weekStart&timeZone` (any date inside a week names that week; omitted means the most recently closed one) and rendered by the mobile `WeeklyRecap` screen, which is also reachable from My Habits so it is not push-only. The `weeklyRecap` push is queued by the daily habits digest for every user whose *own* local day is a Monday — there is one scheduler firing and no timezone bucketing, so asking each user "is it your Monday?" is what gets every zone its own — and only when the week held at least one completed check-in; a recap of an empty week is a report card, and `habitComeback` already owns the lapsed user. Dedupe key is stamped with the week (`weekly-recap:<weekStart>`), so re-running the digest inserts nothing. Which story the recap tells (`perfectWeek` / `firstWeek` / `improved` / `steady` / `declined`) is decided once server-side and travels on the payload, so the push body and the screen's header cannot contradict each other. Kill switch: `HABIT_WEEKLY_RECAPS_ENABLED=false`
- **Celebration screens** — full-screen modals for a streak day, a streak milestone (`7, 30, 50, 100, 200, 365, 500, 730, 1000`, then every 500) and an end-of-period leaderboard placement, queued rather than navigated to directly: the check-in toast and the note/photo screen block the queue until both are closed, so a celebration never pre-empts the flow that earned it, and a placement pending from a period that closed overnight is always shown before today's streak. Whether a celebration is owed is decided server-side (`pendingCelebration` is non-null only while the last upheld day is today and today has not been celebrated), so two devices cannot both celebrate the same day. Placements outside the top 3 get a dismissible inline card on the leaderboard instead of a modal
- **End-of-period leaderboard placements** — `main.leaderboardPeriodResults` freezes each participant's placement, score and participant count when a weekly period closes, with standard competition ranking (ties share: 1, 1, 3). The close is idempotent and runs both on a schedule and lazily on the first read after the period ends. `leagueFrom`/`leagueTo` exist and stay NULL — the seam for leagues, which are deliberately not built. A returning user sees at most the 3 most recent unacknowledged placements; older ones are auto-acknowledged rather than queued up as a wall of modals
- **Home-screen widget (Android)** — a 4×2 launcher widget (resizable to 4×3) showing the user's weekly rank, XP and daily streak, today's check-ins, and the top 3 of the leaderboard. A small Friends / Everyone toggle in its header switches boards instantly (the snapshot carries both, so no fetch) and the choice is remembered natively across refreshes and reboots; until the user picks one it shows Friends, or Everyone for a user with no connections, and a user with no connections sees an "Invite friends" row on either board. It renders a snapshot the app writes after each dashboard refresh or check-in (`main/utilities/habitsWidget.ts` → native `HabitsWidget` module → `widget/HabitsWidgetProvider.kt`); the provider itself makes no network calls and holds no token. Between app sessions the widget keeps itself fresh: on its 30-minute tick, on first placement and on a tap of its "↻ updated N ago" label it enqueues a WorkManager job (`widget/HabitsWidgetRefreshWorker.kt`) that runs the `HabitsWidgetRefresh` headless JS task (`main/utilities/habitsWidgetRefresh.ts`), which fetches both boards and today's count with the stored session and republishes — and both push handlers run the same task when a habits push (partner check-in, streak, rank milestone…) lands, so a friend's check-in reaches the widget within seconds. A refresh that cannot publish (offline, signed out, expired token) keeps the last snapshot and the label says how old it is. It also redraws on every tick so the reset countdown and freshness label move, and after the Monday reset it shows "New week started" instead of last week's rank. Taps deep-link to the Leaderboard (on the board shown), the dashboard's habits tab, or Invite. Cleared on logout. iOS and check-in from the widget are not built
- **Real-time pact updates** — WebSocket events for partner check-ins, celebrations, encouragement
- **Pact status management** — pending, active, completed, abandoned, completed lifecycle
- **HABITS achievements** — 8 brand-scoped achievement classes (habitBuilder, cleanBreak, treasureBuilder, consistency, accountability, resilience, socialEnergizer, pactPioneer) plus reused `socialite` for invite virality. Filtered per-brand via `getAchievementsForBrand()`. **Follow-up TODOs** (multi-habit consistency, partner-streak attribution, brand-header audit, lottie cards, etc.) — see `docs/niche-sub-apps/habits/HABITS_STREAKS_DESIGN.md` § "Follow-up TODOs"
- **Tracked habits & solo habits** — `habits.user_habits` is the registry of habits a user is actually tracking, whether or not a pact backs one. "Solo" is derived (no active pact covers the habit), so a habit whose pact ends quietly becomes personal instead of disappearing. Starting a habit alone unlocks once the user has invited `HABITS_SOLO_UNLOCK_INVITE_COUNT` (default 3, env-overridable) **distinct people** to a pact — invites *sent*, so a friend who never accepts cannot strand the inviter. Both `GET /habits/user-habits/eligibility` and the 403 `solo-locked` denial carry `invitedCount`/`requiredCount` so the client renders progress ("2 of 3 friends invited") rather than a bare refusal; the wizard's partner step is skippable only once unlocked. The unlock is checked before the habit cap, so a locked user at the cap gets 403, never a paywall. Archiving is the lossless way to free a slot; check-ins, streaks and journal entries all survive it
- **Journal** — a day-grouped feed merging six sources newest-first: user-authored notes (`habits.journal_entries`, optionally tagged to a habit), check-ins, earned achievements, streak milestones, habit starts, and goals the user posted (`main.thoughts`, which is where a HABITS "goal" lives). Paginated by an exclusive cursor on `(occurredAt, id)` rather than an offset, since an offset cannot stay stable across six interleaved sources. Achievements are read through the brand-scoped `UserAchievementsStore` and goals through the per-brand thoughts allowlist, so neither a user's Therr achievements nor their Therr posts leak into their Habits journal. Tapping a goal opens the thought view; posting one from the journal returns there rather than to the profile
- **Free tier & founder unlock** — free accounts track 3 active habits (`HABITS_FREE_HABIT_LIMIT`, lowered from 5 in 2026-09) and may start at most 5 new habits in any rolling 30 days (`HABITS_FREE_HABIT_STARTS_PER_WINDOW` / `HABITS_FREE_HABIT_START_WINDOW_DAYS`, counted on `habits.user_habits.startedAt` in any status, so archiving frees a slot but cannot be cycled to dodge the cap). Bringing an archived habit back — restore, re-starting it, or continuing it solo — is not a start (`startedAt` is not re-stamped), so it is gated on the active cap alone and never on the window. Exceeding either returns HTTP 402 with paywall metadata (`error` is `habit-limit-reached` or `habit-start-limit-reached`) from `checkHabitCapacity`, the single enforcement point for pact create, pact accept, solo start and restore. `GET /habits/user-habits/eligibility` reports both caps and both counts whenever they apply (`habitLimit`, `habitStartLimit`, `habitStartWindowDays`, `recentHabitStartCount`, `habitLimitReason`), so clients render the numbers from the server rather than a constant. The first 5,000 accounts can buy a one-time $20 "free for life" unlock through Google Play Billing, verified and acknowledged server-side against the Play Developer API and granted as `AccessLevels.HABITS_LIFETIME` — see `docs/niche-sub-apps/habits/HABITS_PAYMENT_WORKFLOW.md`
- **Premium subscription ($6.99/month)** — the recurring path to the same premium entitlement, sold through Google Play Billing (subscription product `habits_premium_monthly`, overridable via `HABITS_PREMIUM_PRODUCT_ID`). `POST /habits/premium/verify` verifies the purchase token against `purchases.subscriptionsv2.get`, grants `AccessLevels.HABITS_PREMIUM` while the subscription is in an entitling state (ACTIVE / IN_GRACE_PERIOD, or CANCELED but paid through the current period), records it in `habits.subscription_purchases` (one active row per account, replay-guarded on the purchase token), and acknowledges server-side so Play does not auto-refund. `GET /habits/premium` reports the product, the account's own subscription, and `isStoreConfigured`. The `UpgradePaywall` screen offers it alongside the founder unlock; either paid path hides both CTAs. Every route to that screen carries a `source` param (`PaywallSource` in `TherrMobile/main/utilities/upgradeNudge.ts`) reported on `habits_paywall_view` and both purchase events, and each non-402 surface logs `habits_upgrade_nudge_view` with the same source, so click-through and conversion read per surface: the drawer, a capacity strip on the dashboard (last free slot and at the cap), a notice on the pact wizard's first step at the cap, a Membership row in Settings, a founder card under the weekly recap, a milestone-celebration button, and the 402s from check-in, pact create/solo start, and pact accept. Every surface fails closed through `shouldShowFounderCta` / `isUpgradePurchasable`, so nothing advertises an offer the paywall cannot honour. Both `HABITS_PREMIUM` and `HABITS_LIFETIME` are read through `hasHabitsPremiumEntitlement`, so lifetime buyers are never caught by a subscription lapse. Lapse/cancellation revocation awaits a Play RTDN consumer (see `docs/WORK_IN_PROGRESS.md`)
- **Daily habit reminders** — the digest's reminder pass walks `habits.user_habits` rather than `habits.pacts`, which is what makes it the only notification path that reaches a solo habit or a user whose streak sits at zero (the pact-driven half warns only about a live streak, so a new user and a user who just broke a streak both received nothing at all). Every check-in nudge a run decides on — pact-backed or solo — is rolled up into **one** notification per user per day (`checkin-nudge:<date>`), so someone tracking four habits is nudged once rather than four times; a live streak on any of them gets the stronger `streakAtRisk` copy, citing the longest streak at stake. A single-habit nudge carries the goal id and so offers the one-press check-in. Cadence-aware: `shouldNudgeToday` asks whether the week's quota is still outstanding and goes silent for the rest of the week once it is met, so a 4x/week habit is nudged at most four times and never after the fourth. It replaced a spacing heuristic (`floor(7 / N)` days since the last check-in) that made 4x, 5x, 6x and 7x per week all due *every* day and kept nudging after the target was reached. Deliberately not gated on "is today required" — under a quota a well-run week has no required days at all, so that would nudge the succeeding user never. The pact loop's `partnerMissedDay` and `streakAtRisk` are gated too; both previously fired on every off day, the first of them accusing a partner of missing a day the habit never asked for, taper-aware (an established habit's reminders thin out and then stop, per the lifecycle engine), and deduped per user per day through `main.notificationQueue`. Kill switch `HABIT_DAILY_REMINDERS_ENABLED=false`; the worker's 5/user/day cap still applies on top
- **Local-time reminders & the evening "last chance" nudge** — one Cloud Scheduler firing produces two per-user delivery slots instead of one global one. The digest reads `main.users.settingsTimezone` (reported by the mobile client on every push registration) plus the long-dormant `settingsPreferredReminderTime` / `settingsQuietHoursStart` / `settingsQuietHoursEnd` columns, and stamps each queue row with an explicit `scheduledFor`: the streak-status nudge lands in the user's local morning, and a `eveningCheckIn` "last chance" reminder mid-to-late in their own evening. Before this, "run it in the evening" meant evening in `America/Chicago` — Berlin got its morning nudge at 16:00 and Auckland got "check in before midnight" at 02:00. Four rules bound the second push so it is an escalation rather than volume: only a **live streak** qualifies (nothing to lose, no second push), it must fit inside the user's own evening at least four hours after the morning slot or it is dropped, `settingsPushHabitReminders` / `settingsPushStreakAlerts` are honoured (the first server-side reading of *any* push preference column), and the queue worker re-reads `habits.habit_checkins` at send time and skips the row entirely if the user has checked in since — which on a working day is most of them. Kill switch `HABIT_LAST_CHANCE_REMINDERS_ENABLED=false` stops the evening slot and leaves local scheduling intact
- **Habit lifecycle messaging** — per-habit phases (`forming` → `established` → `maintaining`, plus `lapsed`) that decide how often the app may nudge about a habit. Adaptive gates pair a day floor with the user's own trailing consistency (21 days + 90%/14d to taper nudging to every third day; 66 days + 85%/28d to stop it), then 30/60/90-day maintenance check-ins verify the habit held after support was withdrawn, and a self-compassion-framed comeback offer proposes a fresh streak when it didn't. Push side in the users-service digest, long-form email side in `therr-messaging-automator`. Off by default behind `HABIT_PHASE_ENGINE_ENABLED` — see `docs/HABIT_LIFECYCLE_MESSAGING.md`

---

## Brand Variations

All variants share the same backend and auth system. Current variants defined in `BrandVariations` enum:

| Variant | Key | Description |
|---------|-----|-------------|
| Therr | `therr` | Core location-based social network |
| Friends with Habits | `habits` | Accountability and habit tracking |
| Teem | `teem` | Community/team features |
| Otaku | `otaku` | Niche interest communities |
| Appy Social | `appy_social` | General social variant |
| Parallels | `parallels` | Alternative social experience |
