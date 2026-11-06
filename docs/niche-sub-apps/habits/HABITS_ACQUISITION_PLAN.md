# Friends with Habits — Acquisition Plan (near-zero budget)

**Last Updated:** 2026-10-29
**Status:** Active. The four-week test runs 2026-11-02 → 2026-11-29; the read is on 2026-11-30.
**Audience:** The founder, and agents planning growth work for the habits app
**Related:** [`PAID_ACQUISITION_PLAYBOOK.md`](../../PAID_ACQUISITION_PLAYBOOK.md) (why paid is off) ·
[`ADJACENCY_MARKETING.md`](../../ADJACENCY_MARKETING.md) (positioning, the challenge guides) ·
[`HABITS_PROJECT_BRIEF.md`](../HABITS_PROJECT_BRIEF.md)

> A business direction document, not a backlog. The founder's recurring steps are in
> § The weekly routine below and in `docs/WORK_IN_PROGRESS.md` § Acquisition plan.

---

## The goal, and why

The retention work (push delivery, lifecycle messages, pact chat) can only be read on a steady
flow of new users. At ~16 real installs a week, a change that moves day-1 retention by 10 points
shows up as one or two people. **The target is 40+ real installs a week**, with each install's
source readable, using 10–15 founder-hours a week and no ad spend.

Paid search and App campaigns are ruled out for now: the October test cost **$7.70–$11.67 per
install** against a $5.00 red line, and the installs may not have been incremental
(`PAID_ACQUISITION_PLAYBOOK.md`, decision log, 2026-10-19).

## What the data says (GA4 + prod DB, 2026-08-01 → 2026-10-27)

**Installs.** 233 real first opens (Play pre-launch devices excluded). By first-touch source:
`(direct)` 104, `google-play / organic` 91, `google / cpc` 30, `google / organic` 4,
`habits.therr.com / referral` 4. Unpaid installs per ISO week: 13, 21 (BetaList launch), 17, 25,
17, 12, 25 (Instagram + Reddit), 16, 17, 12.

**Web (habits.therr.com) sessions, by source, and what they did:**

| Source | Sessions | Engaged | Store clicks | Read |
|---|---|---|---|---|
| (direct) | 188 | 27% | 12 | Mostly invite links opened from messaging apps |
| Instagram | 112 | **12%** | 2 | One spike, Oct 4–8. Low intent |
| betalist.com | 90 | **66%** | n/a¹ | One launch on Aug 25, then a trickle every week since |
| chatgpt.com | 32 | 53% | **9** | 28% of sessions clicked through to Play, the best of any source, with no effort spent |
| google / organic | 27 | 37% | 4 | |
| reddit.com | 20 | 55% | 2 | A few posts, late Sep |
| blog | 15 | 13% | 0 | |

¹ `store_click` shipped after most BetaList traffic arrived. The install bump in its launch week
(13 → 21) is the better read.

**Friends bring the users who stay.** Of 164 habits signups since Aug 1, **43 (26%)** joined as
someone's pact partner or challenge member. 14% of those reached 3 check-in days, against **2.5%**
of everyone else. No other source comes close on quality.

**The referral reward has never been granted. There are three reasons:**
1. It shipped on 2026-10-23 (server) and in 1.25.0 (app, 2026-10-27), so it's days old.
2. It was evaluated only when a referred friend checked in. Two real users already had three
   verified friends with 3+ check-in days each, but those friends had gone quiet. Nothing ever
   evaluated them. Fixed: the progress read now grants an earned reward.
3. People didn't see it when it mattered. It showed on My Habits and the paywall, not on the
   screen where you pick a partner. Fixed: an inline version now sits on the pact wizard's
   partner step.
   The bar is also high for this audience. Of 34 users who ever brought a friend in, 22 brought
   exactly one. Only 2 meet "3 friends × 3 days", and 3 more are one friend short.

**Coaches: no signal.** `/coaches` had 4 sessions in three months and the waitlist has had no
signups from it.

## The channels, ranked by expected installs per founder-hour

The estimates are deliberately rough: they come from one launch, one spike and a few posts. The
point of the four weeks is to replace them with measured numbers. "Attributed" means readable in
GA4 (`firstUserSource` / `firstUserCampaignName` on the app stream, `sessionSource` on the web
stream) or in `main."userAcquisition"`.

| # | Channel | Founder h/week | Expected installs/week | Installs per founder-hour |
|---|---|---|---|---|
| 1 | The friend loop (invites, challenges, referral reward) | 0.5 | +3–5 on top of today's ~4, growing with every other channel | n/a: it runs on product work, not founder time |
| 2 | Launch directories and "alternatives" listings (and through them, AI assistants) | 2 | 4–8, front-loaded | **2–4** |
| 3 | Play listing (ASO) and review replies | 0.5 (+3 once) | 1–2, compounding | **~1.5–2** amortised over 8 weeks |
| 4 | A public monthly challenge, posted in communities that allow it | 3 | 3–6 | **1–2** (least certain) |
| 5 | Short-form video from real check-ins | 2 | 1–2 | **0.5–1** |

On top of today's ~16 a week, that adds up to roughly **28–39 a week**. 40 is the top of the
range, not the middle. It gets there only if channel 1 works: each new user arriving through
channels 2–5 brings, on today's 26%, another quarter of a user. Total founder time is
**~8 h/week plus 1 h of measurement**, which leaves room inside 15 h for one-off launches.

### 1. The friend loop

The cheapest installs, and the best users. The founder can't post their way to more of them;
they come from making each invite land.

- **Shipped with this plan:** the referral-reward catch-up grant (users-service), the offer on
  the partner-pick step (mobile), and store links that name their page type
  (`utm_campaign=web-invite`, `web-challenge`, `web-guide`, …). That last one makes invite-driven
  installs readable for the first time; until now they all looked like `(direct)` or one shared
  `habits.therr.com / referral`.
- **Measure:** weekly, the share of new signups brought by a friend (scorecard query below), app
  installs with `firstUserCampaignName = web-invite` / `web-pact-invite` / `web-challenge`, and
  `SELECT COUNT(*) FROM habits.referral_rewards`.
- **Decision at week 4, not a kill:** if there are ≤ 2 referral grants (the two already-qualified
  users), set `HABITS_REFERRAL_REWARD_FRIEND_COUNT=2` on users-service and read it again 4 weeks
  later. 22 of 34 referrers stop at one friend, so three may simply be the wrong number.
  Lowering it is an env change, so it needs no release.

### 2. Launch directories and "alternatives" listings

The two best-quality sources so far are both listings. BetaList's visitors engaged at 66%, and it
still sends a few every week, two months after the launch. ChatGPT's visitors click through to
Play at 28%. AI assistants answer "habit tracker with friends" from pages like these, so each
listing works twice: once directly, and again when an assistant recommends the app.

- **Weekly (2 h):** submit to 2–3 free directories or "alternative to" pages, one listing at a
  time, each with its own UTM. Candidates, in rough order (check each is still free, and don't
  pay for "featured" slots): AlternativeTo (as an alternative to Habitify, Streaks and Habitica),
  Product Hunt (plan this one as a dated launch day; it is the one big one-off), SaaSHub, Uneed,
  Fazier, Microlaunch, Peerlist Launchpad, Indie Hackers products, Launching Next, and the
  "habit tracker" lists on the app-review sites that accept submissions.
- **Copy:** lead with the one thing no listed competitor does: *a pact needs two people, and the
  streak is shared*. Reuse the wording in `therr-client-web/src/_static/habits-llms.txt`, and keep
  that file current, since assistants read it.
- **Link:** `https://habits.therr.com/?utm_source=<site>&utm_medium=directory&utm_campaign=fwh-directories-2026q4`
  (the web page captures the visit and carries it through the store hop). For a listing that only
  accepts a Play URL: `https://play.google.com/store/apps/details?id=com.therr.habits&referrer=utm_source%3D<site>%26utm_medium%3Ddirectory%26utm_campaign%3Dfwh-directories-2026q4`.
- **Measure:** GA4 web, sessions and `store_click` by `sessionSource`. App stream,
  `firstUserSource` for the Play-only links. AI referrals show as `sessionMedium = ai-assistant`.
- **Kill (2026-11-30):** stop if, after 8+ listings, the median listing sent under 10 sessions and
  all of them together produced under 5 store clicks. Keep listings that worked; just stop adding.

### 3. Play listing (ASO) and review replies

`google-play / organic` is 39% of installs, the largest attributed source. Every other channel
also lands people on this page, so a better listing raises all of them.

- **Once (3 h, `niche/HABITS-general`):** run `/aso-listing`. Test the adjacency angle from
  `ADJACENCY_MARKETING.md` ("bring the challenge you're already doing, bring a friend") in the
  short description and first screenshot, as a **Play Console store listing experiment**, not a
  straight swap. The current listing is the control.
- **Weekly (30 min):** reply to every new review, and read the experiment and Play Console →
  Statistics → Store listing acquisition (visitors → installers).
- **Measure:** the experiment's installer conversion, and weekly `google-play / organic` first opens.
- **Kill (2026-11-30):** if the experiment has no winner at Play's 90% confidence, keep the control
  and stop editing copy. Test at most one listing change a month after that.

### 4. A public monthly challenge, posted where it is welcome

"Try my app" gets removed from most communities. "Join this month's no-spend challenge, it's
free, and you can bring a friend" is a different kind of post: the founder hosts one public,
join-by-link challenge a month on a seasonal theme, and posts the link plus the matching guide.

- **Calendar:** November: no-spend (`/challenges/30-day-no-spend`, template `noSpendDay`, starts
  Nov 2). December: a daily-walk or 10,000-steps challenge. January: no added sugar / dry month
  (`/challenges/30-day-no-sugar`, `/challenges/30-day-alcohol-free`). Pick from templates that
  exist; see `ADJACENCY_MARKETING.md` § Rules on health and sobriety terms.
- **Weekly (3 h):** post in 3–5 communities whose rules allow it (read the rules first, say you
  made the app, and answer every reply). Spend the rest of the time answering threads, not posting
  more.
- **Link:** `https://habits.therr.com/c/<token>?utm_source=<reddit|discord|facebook>&utm_medium=community&utm_campaign=challenge-2026-11-no-spend&utm_content=<community-name>`.
  Without UTMs, the visit still arrives as `web-challenge`.
- **Measure:** challenge members (`habits.challenge_members` for that challenge), GA4 web sessions
  by `sessionCampaignName`, and app installs by `firstUserCampaignName`.
- **Prerequisite:** the challenge screens are in 1.25.0 (66). Confirm that build is on the Play
  **production** track before the first post, or the link opens an app that can't show it.
- **Kill (2026-11-30):** stop posting if the month's posts produced under 10 challenge joins, or
  under 1 attributed install per 2 hours spent. Keep the feature either way.

### 5. Short-form video from real check-ins

The one social data point is weak: Instagram sent 112 sessions in five days and only 12% engaged,
the worst of any source. It's ranked last, and it runs only if channels 2–4 leave hours over.

- **Weekly (2 h):** two vertical videos, 15–30 s, from the founder's own pact (or from a user who
  explicitly agreed, in writing). Show a real streak and a real partner nudge, not a feature tour.
  Post the same cut to Instagram Reels, TikTok and YouTube Shorts.
- **Link in bio:** `https://habits.therr.com/?utm_source=<instagram|tiktok|youtube>&utm_medium=social&utm_campaign=fwh-video-2026q4`.
- **Kill (2026-11-30):** stop after 8 videos if they produced under 3 attributed store clicks in total.

## Evaluated and not chosen (for now)

| Option | Why not now | Revisit when |
|---|---|---|
| Paid search / App campaigns | $7.70–$11.67 CPI against a $5.00 red line, and possibly not incremental | A recurring tier exists, or a channel above shows the message that converts |
| Creator / coach partnerships | No demand signal (`/coaches` had 4 sessions in three months, no waitlist signups). It needs cold outreach, which is sales work the founder hasn't done yet | A coach signs up unprompted, or the premium tier ships |
| Programmatic SEO (challenge guides) | Already built (#3140). It costs no weekly hours beyond 15 minutes in Search Console, and returns arrive 4–8 weeks after indexing | Kept, passively. Read the queries listed in `ADJACENCY_MARKETING.md` § "The guides" in late November |
| More Instagram posting without video | The one spike engaged at 12% | Never on its own |

## Measurement

### UTM conventions

| Channel | `utm_source` | `utm_medium` | `utm_campaign` |
|---|---|---|---|
| Directories | the site (`betalist`, `alternativeto`, `producthunt`) | `directory` | `fwh-directories-2026q4` |
| Monthly challenge | `reddit` / `discord` / `facebook` | `community` | `challenge-<yyyy-mm>-<theme>` |
| Video | `instagram` / `tiktok` / `youtube` | `social` | `fwh-video-2026q4` |
| Untagged web visits (automatic) | `habits.therr.com` | `referral` | `web-invite`, `web-pact-invite`, `web-challenge`, `web-guide`, `web-landing`, `web-coaches`, `web-blog`, `web-profile`, `web-other` |

Use lowercase everywhere, and never reuse a campaign name for a different month or channel.
Write each link once, in a note, and paste it from there.

### The Monday scorecard (30 min)

1. **GA4 app stream** (property `267810693`, stream "Friends with Habits"): new users last week by
   `firstUserSource` / `firstUserCampaignName`. Exclude device models `OnePlus8Pro` and anything
   containing `sdk_gphone`.
2. **GA4 web** (property `549794383`, host `habits.therr.com`): sessions, engaged sessions and
   `store_click` by `sessionSource`.
3. **Prod DB, read-only:** signups last week, how many a friend brought in, and their sources:

```sql
-- Read-only: open the session with default_transaction_read_only=on.
WITH hu AS (
    SELECT u.id FROM main.users u
    WHERE u."brandVariations" @> '[{"brand":"habits"}]'
      AND NOT COALESCE(u."isBot", false) AND NOT COALESCE(u."isSuperUser", false)
      AND u.email NOT ILIKE '%test.local'
      AND u."createdAt" >= date_trunc('week', NOW()) - interval '7 days'
      AND u."createdAt" <  date_trunc('week', NOW())
),
brought AS (
    SELECT pm."userId" FROM habits.pact_members pm JOIN habits.pacts p ON p.id = pm."pactId"
    WHERE pm.role = 'partner' AND pm."userId" <> p."creatorUserId"
    UNION
    SELECT cm."userId" FROM habits.challenge_members cm JOIN habits.challenges c ON c.id = cm."challengeId"
    WHERE cm."userId" <> c."creatorUserId"
),
acq AS (SELECT DISTINCT ON ("userId") * FROM main."userAcquisition" ORDER BY "userId", "createdAt")
SELECT COALESCE(a."utmSource", '(none)') AS source, COALESCE(a."utmCampaign", '(none)') AS campaign,
       COUNT(*) AS signups, COUNT(b."userId") AS brought_by_friend
FROM hu LEFT JOIN acq a ON a."userId" = hu.id LEFT JOIN brought b ON b."userId" = hu.id
GROUP BY 1, 2 ORDER BY signups DESC;
```

Write the week's three numbers (installs, friend-brought share, top source) as one line in the
decision log below. Session 2's retention report (`scripts/`) reads the same cohorts for day-1
and week-1 retention, so read retention by source there rather than here.

## The weekly routine (≈ 9 h)

| When | What | Time |
|---|---|---|
| Monday | The scorecard above; one line in the decision log | 30 min |
| Monday | Reply to new Play reviews; check the listing experiment | 30 min |
| Tuesday | 2–3 directory / alternatives submissions, each with its own UTM | 2 h |
| Wed–Thu | This month's challenge: post in 1–2 communities each day and answer every reply | 3 h |
| Friday or weekend | Two short videos from a real pact (only while channels 2–4 leave time) | 2 h |
| Last Monday of the month | Create next month's challenge in the app; pick its guide and communities | 30 min |
| Every week | Nothing on paid. Don't change more than one listing element at a time | — |

## Rules

1. **Never buy votes, reviews or installs**, never post a review of our own app, and never ask
   anyone for a 5-star rating in exchange for anything. Play removes apps for it.
2. **Say you made it**, every time, in every community. Follow each community's self-promotion
   rule even when it costs a post.
3. **Nobody's check-in, name or photo goes in a video or post without their written consent.**
4. **Claims follow `ADJACENCY_MARKETING.md` § Rules:** behaviours only, no health outcomes, no
   trademarked challenge names, no sobriety or recovery claims.
5. **One change at a time per channel**, so four weeks of ~25 installs can tell you which change
   did it.

## Decision log

| Date | Decision | Evidence | Consequence |
|---|---|---|---|
| 2026-10-29 | **Adopt this plan; paid stays off.** Run channels 1–5 for four weeks from 2026-11-02 and read them on 2026-11-30. | The numbers in § What the data says. | Shipped with it: the referral-reward catch-up grant (`general`), the referral offer on the partner-pick step (`niche/HABITS-general`), and page-type campaigns on store links (`general`). |
