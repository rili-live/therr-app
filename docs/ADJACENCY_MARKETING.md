# Adjacency Marketing — Friends with Habits

**Last Updated:** 2026-10-19
**Status:** Shipped on `general`, campaign PAUSED. Nothing is spending money yet.
**Audience:** The founder, and agents writing copy, campaigns or onboarding for the habits app
**Related:** [`PAID_ACQUISITION_PLAYBOOK.md`](PAID_ACQUISITION_PLAYBOOK.md) · [`GROWTH_STRATEGY.md`](GROWTH_STRATEGY.md) · `.claude/skills/ad-creative/`

> A business direction document, not a backlog. Ops steps live in
> `docs/WORK_IN_PROGRESS.md` § Adjacency marketing.

---

## The idea

Alex Hormozi's version: put your product next to something people already think is cool.
That attention is already paid for. When your ad or page shows up beside it, the reader
brings the interest and you only supply the reason to act. The ads cost less because you
are not buying a cold audience's first impression, and revenue grows faster than spend
because the borrowed status keeps working after the click.

For Friends with Habits this fits unusually well, because the product is a **social layer
on top of habits people already want**. Nobody needs convincing that step challenges,
streaks, cold showers or the two-minute rule are worth doing. Millions already try them,
alone, and quit. The one thing those trends lack is the thing this app is: a friend on the
other end who notices when you skip.

So the positioning is not "a better habit tracker." Streaks, Habitify and every other
tracker bid on that phrase. It is:

> **Bring the challenge you're already doing. Bring a friend.**

## What counts as "already cool"

The trend has to be (1) popular with the US 20–40 audience the Play listing targets,
(2) a repeatable daily or weekly behaviour a pact can hold, and (3) honest to support with
what the app does today. Current list, each backed by a real template:

| Trend | Template key | Why it is adjacent |
|---|---|---|
| Fixed-length challenges (30/60/90 days) | any; pacts run 7/14/30/60/90 days | The most viral habit format there is, and a pact already is one |
| Streak culture | the shared streak itself | Language and photo apps taught people to protect a daily number |
| The habits-book audience (two-minute rule, habit stacking) | `twoMinuteStart` | Tens of millions of readers who learned the method and never applied it |
| 10,000 steps / step challenges | `steps10k` | Already social at work and between friends |
| Zone 2 cardio | `zone2Cardio` | Podcast-driven fitness trend |
| Cold showers | `coldShower` | Same audience, and a dare that works between friends |
| Morning sunlight | `morningSunlight` | Same audience |
| Protein goal | `proteinGoal` | Lifting and fitness culture |
| No added sugar | `noAddedSugar` | Recurring January / spring challenge |
| Sober-curious month | `soberCurious` | Seasonal (October, January). Organic only; see § Rules |

## The three plays

### 1. Branding: borrow the trend's language, never its name

Every owned surface leads with the behaviour people already like, then adds the partner.

- **Shipped:** a "Popular pacts" section on `habits.therr.com`, right after the hero and the
  one-paragraph definition, in all three locales (`landing.hbs`, `habitsLocales/*/dictionary.json`
  → `popular`). Each chip's key is the `templateKey` of the template it advertises.
- **Next, on `niche/HABITS-general`:** the Play listing's short description and first
  screenshot (`/aso-listing`). The App campaign sends every click there, so the listing is
  where this positioning moves installs.
- **Content:** the habits blog (exported from `therr-landing`) is where brand names *can*
  appear editorially ("Doing a habits-book challenge? Here's how to do it with a friend").
  Search interest in the book and challenge names is large and already there.

### 2. Advertising: bid next to the trend, not on the category

- **Shipped:** `scripts/google-ads/campaigns/habits-web-adjacent.yaml`, a PAUSED Search
  campaign at $5/day with four ad groups: `challenge-culture`, `streak-culture`,
  `habits-book-readers`, `fitness-trends`. It has its own copy and its own `utm_campaign`
  (`fwh-web-us-adjacent-2026q4`), so adjacency signups can be told apart in
  `main."userAcquisition"` and compared against the category campaign on cost per *activated*
  user.
- Its hypothesis, in the spec, is the falsifiable form of this whole document: adjacent
  intents cost less per click than category terms and activate at least as well.
- **Later, not in the tooling yet:** Demand Gen or YouTube placements on fitness and
  self-improvement channels, plus custom segments built from people who use adjacent apps.
  `therr_ads` only builds App and Search campaigns. Add a kind when Search has proven the
  angle, not before.

### 3. Product and onboarding: the ad's promise must exist on first open

Someone who clicked "step challenge with friends" and finds no step pact in the picker
bounces. That shows up as a partner-wall failure when it was really a copy failure.

- **Shipped:** migration `20261019000001_habits.habit_goals.seedTrendTemplates` adds the
  eight templates above to existing picker categories (fitness, health, mindfulness,
  productivity), so the picker itself needs no change.
- **Next, on `niche/HABITS-general`:** `pages.pacts.templates.<templateKey>` translations in
  the mobile `es` / `fr-ca` dictionaries (they fall back to the stored English until then), and
  possibly a "Popular" row at the top of the picker so these templates are the first thing a
  cold user sees.

## Rules

1. **Trademarks can be keywords, never ad text.** Google allows bidding on a brand name
   as a keyword in the US. Ad headlines and descriptions name behaviours only. The landing
   page compare section already names competitor apps editorially; that is a different,
   accepted use.
2. **No branded programs as templates or promises.** A template named after a branded
   challenge promises that challenge's rules, which a pact does not enforce. Use the
   generic words ("30-day challenge", "step challenge").
3. **Every adjacency must map to something the app does today.** If the ad says it, the
   picker has it. `/ad-creative` checks claims against the code.
4. **Stay out of health-claim and addiction territory in ads.** No outcome claims for
   cold exposure, zone 2 or sunlight, and no paid bidding on sobriety or recovery terms.
   Google treats those as close to its restricted addiction-services category, and
   `habits-web-landing.yaml` excludes recovery terms on purpose. Sober-curious is organic and
   landing-page only.
5. **Judge on activation, not CPC.** A cheap click that stalls at the partner wall is the
   expensive kind. Read `./therrads analyze` per ad group against the category campaign.

## Not yet

- **The branded 75-day challenge.** It is the coolest adjacency of all and it is excluded
  on purpose: there is no 75-day pact (`pactHelpers.validatePactParams` allows
  7/14/30/60/90), and its searchers want its specific rules. Revisit only if a 75-day
  duration ships in both the server and the mobile duration picker. Even then, the name
  stays out of ad text.
- **Seasonal swaps.** No-spend November, January resets, spring step challenges. The
  `noSpendDay` and `noAddedSugar` templates already exist. A seasonal campaign is a copy
  of the adjacent spec with a new `utm_campaign`, never a rename.

## How we will know

| Signal | Source | Good | Bad |
|---|---|---|---|
| CPC vs category campaign | `./therrads analyze` | Lower | Equal or higher: the adjacency is not cheaper |
| Signup → pact rate | `report product`, by `utmCampaign` | ≥ category campaign | Lower: these searchers wanted a solo tracker |
| Template pick share | `habits.habit_goals."sourceTemplateKey"` on new goals | Trend templates over-indexed among adjacency signups | Picked at the same rate as any other template |
| Ad group winner | per-ad-group cost per activated user | One theme clearly wins → lead the Play listing with it | All tie → keep the category positioning |

Record the outcome in the `PAID_ACQUISITION_PLAYBOOK.md` decision log.
