# Paid Acquisition Playbook — Friends with Habits

**Last Updated:** August 2026
**Status:** Active — tooling built, no campaign has run yet
**Audience:** The founder, and coding agents generating next-step work items
**Tooling:** [`scripts/google-ads/`](../scripts/google-ads/README.md)

> This is a **business direction document**, not a backlog. Code TODOs and manual
> ops steps belong in [`docs/WORK_IN_PROGRESS.md`](WORK_IN_PROGRESS.md); this
> file holds the strategy, the thresholds decisions are judged against, and the
> log of what was decided and why.
>
> `./therrads analyze --write-work-items` writes campaign and business decisions
> into the marker block near the bottom of this file, and code work into
> WORK_IN_PROGRESS.md. Both blocks are replaced on each run.

---

## Why run paid acquisition at all

`docs/GROWTH_STRATEGY.md` says, correctly, not to spend time on consumer
marketing for core Therr until B2B has validated revenue. Friends with Habits is
the exception it names: its viral loop works with two users rather than requiring
geographic density, and it is the primary consumer bet.

But that loop has never been observed with strangers. Every user to date arrived
through a channel where someone already vouched for the app. **The first campaign
is an instrument, not a growth lever.** Its output is not users, it is the answer
to three questions that are currently unanswerable:

1. **CHANNEL** — can Friends with Habits acquire an Android install at a price
   this business can pay?
2. **PRODUCT** — does a *cold* user, with no friend already inside, get through
   an onboarding built around inviting a friend?
3. **MODEL** — with a one-time $20 unlock and no recurring tier shipped, can a
   paying customer ever cost less than they are worth?

Question 2 is the one that matters most and the one nobody has data on. The
mandatory-partner mechanic is simultaneously the reason organic growth is
possible *and* the reason paid acquisition is expensive — you are buying one
half of a two-person unit. If cold users stall at the partner wall, that is a
product finding worth far more than the ad spend that produced it.

Budget accordingly: **$30/day across both arms, capped, for one month** is
roughly $900 to answer three questions. Treat it as research spend. If it turns
out to also be growth, that is upside.

---

## The two arms

| | App install | Web landing |
|---|---|---|
| Spec | `campaigns/habits-app-install.yaml` | `campaigns/habits-web-landing.yaml` |
| Type | Google App campaign → Play Store | Search → habits.therr.com |
| Budget | $20/day | $10/day |
| Buys | Volume | Knowledge |
| Attribution | **Blind past the install** | Full funnel to payer |

### Why pay more for the web arm

A Play Store install never loads a page we control. No UTM is set, nothing is
written to `main."userAcquisition"`, and the resulting account is
indistinguishable from an organic one. Google Ads will report the install; it
cannot report what the person did next.

The web arm closes that loop because `therr-react`'s attribution utility
captures UTMs at registration:

```
click (utm_campaign)
  → habits.therr.com
    → registration → main."userAcquisition"."utmCampaign"
      → habits.pacts                (did they activate?)
      → main.invites                (did they spread it?)
      → habits.habit_checkins       (did they come back?)
      → habits.lifetime_purchases   (did they pay the $20?)
```

That chain is what `./therrads report product` walks. It is the only place the
PRODUCT and MODEL questions can be answered.

**Closing the gap on the app arm** requires the Play Install Referrer API in
`TherrMobile` — read the referrer on first launch, parse the UTMs, include them
in the registration payload's `userAcquisition` object. The server side already
exists and needs no change. This is the highest-value measurement work
outstanding; it is tracked in WORK_IN_PROGRESS.md and belongs on
`niche/HABITS-general`.

### The market-targeting experiment

The web arm's three ad groups are a hypothesis in testable form:

| Ad group | Bet | What a win means |
|---|---|---|
| `accountability-partner` | The buyer already wants a partner | Lead with accountability everywhere — Play listing, landing page, ad copy |
| `habit-tracker-generic` | We compete on tracker features | We are in a crowded category against Streaks/Habitify with no moat |
| `cant-stick-to-habits` | The buyer is mid-failure | Highest intent; rewrite all copy in the language of the failure state |

Whichever produces payers *is* the market. The others are pivot evidence. The
search-terms report is where the unanticipated third answer shows up.

---

## Thresholds

These live in `scripts/google-ads/settings.yaml` → `targets` and are what
`./therrads analyze` judges against. Changing a number here changes the verdicts
and the generated action items — that is the intended way to steer the tool.

| Target | Default | Why this number |
|---|---|---|
| `max_cpi` | $3.00 | Above this, 1,000 installs costs $3k+, out of reach for a bootstrapped side project |
| `max_cost_per_signup` | $12.00 | Web signups cost more and are worth more (fully attributed) |
| `min_signup_to_pact_rate` | 30% | Below this the partner wall is stopping cold users |
| `min_signup_to_unlock_rate` | 10% | 3 distinct invites = solo-tracking unlock; the closest proxy for the viral loop |
| `min_activation_to_payer_rate` | 2% | Typical freemium floor |
| `min_conversions_for_verdict` | 30 | Below this, no verdict is issued at all |

### The ceiling that is not a preference

Google Play takes 15% on the first $1M of annual revenue, so the **$20 Founder
Unlock nets $17.00**, once. There is no second transaction.

> **If cost per payer exceeds $17, paid acquisition cannot fund itself — and no
> amount of ad optimisation changes that.** It is a pricing and packaging
> finding, not a marketing one.

The structural response is the **$6.99/mo premium tier**, specified in
`docs/niche-sub-apps/HABITS_PROJECT_BRIEF.md` and not yet built. A recurring
tier is what makes CAC amortisable and paid acquisition mathematically possible.
`analyze` will say this in plain terms when the data supports it; the decision
of whether to build it is recorded in the log below.

---

## Go / no-go, after the first month

Mirrors the structure of `docs/GROWTH_STRATEGY.md` § Go / No-Go.

### Green — keep investing
- CPI at or under $3.00 on the app arm
- 30%+ of attributed web signups reach a pact
- At least one Founder Unlock traceable to a campaign
- One ad group clearly beating the others on cost per activated user

### Yellow — investigate before spending more
- CPI fine, activation poor → **product problem**, not a channel problem. Fix
  the cold-start path before buying more of the same.
- Activation fine, zero payers → **monetization problem**. The $20 ask may be
  mispriced, or premature for a user who has had the app for a week.
- All ad groups failing identically → **landing page**, not keywords.

### Red — stop and pivot
- CPI above $5.00 with healthy activation: the product works, the channel does
  not. Next experiment is organic/referral, not more budget.
- Cost per payer above $17 with no path to a recurring tier: the model does not
  support paid acquisition at all. Cap spend at the value of the learning.
- Under 10% of attributed signups reaching a pact: the mandatory-partner
  onboarding does not survive contact with a cold audience. That is the most
  important thing this exercise could discover, and it is a product roadmap
  input, not a campaign setting.

---

## Operating cadence

| When | Do |
|---|---|
| Day 0 | `campaign apply` both specs; `campaign resume` the app arm only |
| Days 1–7 | **Nothing.** Learning period. Edits reset it. |
| Day 8 | `analyze --days 7`; resume the web arm |
| Weekly | `analyze --days 14 --write-work-items`; action the P1 items |
| Monthly | Re-read this document's go/no-go section against the data; append to the decision log |

Budget moves in steps of 20% or less, then wait a full learning period before
re-reading. A larger jump resets learning and makes the next number
incomparable to the last one.

---

## Decision log

Append a dated entry whenever a campaign is started, stopped, re-budgeted, or a
verdict changes what gets built. This is the part that makes the next session —
human or agent — able to pick up without re-deriving the reasoning.

| Date | Decision | Evidence | Consequence |
|---|---|---|---|
| 2026-08-28 | Built the tooling; both specs created but not applied. Chose a two-arm structure (cheap-but-blind + expensive-but-measured) rather than a single App campaign. | No paid history exists. An App campaign alone cannot answer the PRODUCT or MODEL questions, because a Play install sets no UTM. | Web arm's higher cost per signup is accepted as the price of attribution. Revisit once the Play Install Referrer lands. |

---

## Open questions this playbook cannot yet answer

- **What is the real viral coefficient?** `min_signup_to_unlock_rate` measures
  invites *sent*, not accepted. Until accepted invites are joined to the cohort,
  every claim about the loop paying for acquisition is an assumption.
- **Does retention differ between paid and invited users?** The current
  retention proxy is "at least one completed check-in", which measures a first
  use, not a return. A day-N cohort query is the obvious next iteration.
- **Is $20 once the right price, or is it the reason nobody converts?** A single
  price point cannot answer this. Running a second price is a bigger commitment
  than any campaign change here.

---

<!-- BEGIN therrads:generated -->

_No analysis has been run yet. `cd scripts/google-ads && ./therrads analyze --days 14 --write-work-items` replaces this block with the current campaign and business decisions._

<!-- END therrads:generated -->
