# Prioritized — PROJECT BRIEF & DEVELOPMENT CONTEXT

**Last Updated:** 2026-09-01
**Project Status:** Proposed — no code written, no brand variation registered
**Domain:** `prioritized.ai` (owned)
**Proposed brand key:** `prioritized` (`BrandVariations.PRIORITIZED`)
**Proposed niche schema:** `prioritized.*`
**Proposed branch:** `niche/PRIORITIZED-general`

> This is a **starter document**, not a plan of record. It captures the product
> thesis, the research behind it, and the design decisions that are already
> settled, so a future developer (human or agent) does not have to re-derive
> them. Section § Open Questions lists what is deliberately undecided.

---

## EXECUTIVE SUMMARY

**What we'd be building:**
A family chore and allowance app whose defining mechanic is inverted from every
competitor. A child's allowance for the period is **granted up front** and is
visibly theirs from day one. Unmet commitments deduct from it. The child's job
is to look at everything they owe this week and this month and decide, on their
own, what order to do it in.

**Why it's called Prioritized:**
The name is load-bearing, not decoration. The product is not "an app that takes
money from your kid" — that framing is a commercial dead end (see § Research →
The Backlash Risk). It is a **prioritization tool with real stakes**. The
child's skill being trained is triage: given a finite week and a list with
different deadlines and different values, what do you do first? The money is the
feedback signal that makes the triage matter. Every piece of copy in the app
should be written from that stance.

**Why it might work:**
Loss-framed incentives measurably outperform identical gain-framed incentives in
field experiments (§ Research). No competitor uses the endowment as the default,
and the largest competitors are structurally unable to copy it quickly because
they are card issuers moving real money. It also reuses ~90% of the Friends with
Habits engine.

**Status of the bet:** Ranked first of three candidate third apps as of
2026-09-01, ahead of a faith small-group app and a run-club app. The full
comparison lives in the research artifact referenced in § Research → Provenance.

---

## THE CORE MECHANIC

### The period ledger

1. A period opens (calendar month by default; weekly supported).
2. The full allowance is **granted immediately** as a ledger entry. The child
   sees their balance at its maximum on day one.
3. Chore occurrences come due through the period.
4. A missed occurrence posts a **deduction** entry.
5. A missed occurrence that is later completed **before the period closes**
   posts a **restoration** entry that reverses the deduction.
6. The period closes. The balance is final and pays out.

The ledger is **append-only**. Deductions are never edits to a balance; they are
rows. Restoration is a reversing row, not a mutation. This gives parents an
auditable history for free, makes "undo" trivial, and means a disputed deduction
can be explained rather than argued about.

### Two rules that are not negotiable

**Recovery must stay open until the period closes.** A loss that is already
locked in generates resentment, not effort — the motivational force of loss
aversion comes entirely from the loss being *avoidable*. If a child cannot earn
the money back, the mechanic stops being an incentive and becomes a punishment,
which is both less effective and the thing that will get the app one-starred.

**Deductions need a floor.** Cap total deduction per period (start at 50% of the
grant, make it configurable). Without a cap, one bad week zeroes the balance and
the child correctly concludes there is nothing left to protect for the rest of
the month — the same failure mode as a broken streak in a habit tracker. The cap
preserves something worth defending at all times.

---

## THE CHILD'S EXPERIENCE: PRIORITIZATION

This is the half that differentiates the product, and the half no competitor
does well. Existing chore apps hand a child a flat checklist. Prioritized hands
them a **planning problem**.

### The list

The child's home screen is a single ordered to-do list spanning both cadences:

- **Weekly chores** — recur every week, several due per week, short horizon.
- **Monthly chores** — recur once a month, long horizon, no felt urgency until
  suddenly there is. Clean the garage. Wash the car.

Mixing the two on purpose is the pedagogy. The classic failure a child makes is
leaving the monthly item until the 30th; the app should let that mistake become
visible before it becomes expensive.

### The child controls the order

The child can reorder their own list and pin what they intend to do next. The
app suggests an order but never silently enforces one. Two reasons:

1. Agency is the mitigation for the autonomy critique of controlling family apps
   (§ Research → The Backlash Risk). A child who arranges their own week is
   managing a budget; a child handed a fixed queue is being surveilled.
2. Ordering is the actual skill. If the app does the triage, the product teaches
   nothing and is just a chore chart with penalties.

### Each item shows its stakes

Every row carries what it is worth and when it is due. A child should be able to
answer "what does it cost me if I skip this?" without tapping in. Value is set
by the parent per chore, and chores are allowed to be worth different amounts —
that is what makes the ordering decision non-trivial and therefore worth making.

---

## AT-RISK: THE WARNING SYSTEM

The single most important feature for making this humane and defensible.

A chore occurrence can enter an **at-risk** state before its deduction posts.
At-risk items jump to the top of the child's list with a visible countdown to
when the money goes.

### How an item becomes at-risk

**Automatically, by default.** Derived from due date and remaining time — an
occurrence still incomplete inside its at-risk window flags itself. Automatic
derivation is what teaches time management; the child learns to read the clock
rather than to wait for a parent.

**By parent override.** A parent can flag any occurrence at-risk early ("the
guests come Saturday, the bathroom matters this week") or clear a flag
(forgiveness, illness, a week that got away from everyone). Both directions must
exist. Escalation-only turns the feature into nagging-by-proxy.

### Why this is the answer to the backlash risk

The app's job is to **warn, not to punish**. A deduction that arrives with no
warning is a penalty. A deduction that arrives after a countdown the child
watched and chose to ignore is a consequence they had every chance to avoid —
and the app was on their side the whole time. Product copy should reinforce this
relentlessly: the at-risk notification is help, not a threat.

Ship no deduction that was not preceded by an at-risk state. That is a product
invariant, not a nicety.

### Notification shape

At-risk transitions are the primary push. Reuse the habits digest worker and its
rules exactly:

- **One rollup per child per day**, never one push per chore. The habits digest
  already learned this — a child with four at-risk chores gets one notification
  naming the most valuable one.
- **Dedupe through `main.notificationQueue`** with a period-stamped
  `dedupeKey`. Read the warning in root `CLAUDE.md` § Sibling Repos: a
  `dedupeKey` containing `Date.now()` or a random value silently disables
  dedup entirely. Stamp it with the occurrence id and the date.
- **Notification action buttons** — the habits check-in nudge already supports a
  one-press "Check In" from the Android tray via
  `data.notificationLinkPressActions`. A one-press "Mark done" on an at-risk
  warning is the same code path and is the highest-value interaction in the
  product.

---

## WHAT THE PARENT DOES

- Creates chores with a **cadence** (weekly / monthly / specific days), a value,
  and an assignee.
- Sets the period grant per child.
- Approves completion. A chore may require photo proof; the media pipeline
  already exists.
- Overrides at-risk in either direction.
- Reads the ledger.

Parents should be able to set up a household in one sitting and then mostly stop
touching the app. A family app that requires daily parent administration dies in
week three. The digest worker does the follow-up, not the parent.

---

## TECHNICAL FOUNDATION

### What already exists and should be reused

| Need | Existing asset |
|---|---|
| Recurring cadence logic | `isHabitDueToday` — honours `targetDaysOfWeek`, then `frequencyType`/`frequencyCount`. Unit tested in `users-service/tests/unit/habitDueToday.test.ts`. **Needs extending for monthly cadence.** |
| Completion + photo proof | `habits.habit_checkins`, `habits.proofs`, `HabitCheckinsStore` |
| Recurring definition shape | `habits.user_habits` / `UserHabitsStore` — the closest existing analogue to a chore |
| Reminder / at-risk worker | `handlers/habitsDigest.ts` and the `main.notificationQueue` worker |
| Brand-scoped data access | `store/BrandScopedStore.ts` |
| Free-tier enforcement pattern | `assertHabitCapacity` — single enforcement point returning 402 with paywall metadata |
| One-time purchase, server-verified | `habits.lifetime_purchases` + Google Play Billing flow, `docs/niche-sub-apps/habits/HABITS_PAYMENT_WORKFLOW.md` |
| Non-monetary progress | Achievements, XP, leaderboards (scope leaderboards to the household, never global) |
| Groups / membership / roles | `main.userGroups`, `UserGroupsStore` |

### What must NOT be inherited

**The Friends with Habits invite gate.** `PactOnboardingGuard`,
`HABITS_SOLO_UNLOCK_INVITE_COUNT`, and the mandatory-partner flow are correct
for FwH and actively wrong here. A parent must be able to set up a household and
start immediately. The household *is* the social graph; there is nothing to
unlock. Expect this to be inherited by default through shared components and
plan to gate it on a feature flag from the first commit.

**Global leaderboards.** Children ranked against strangers is a policy and
safety problem, not just a design one. Household scope only.

### Proposed schema (`prioritized.*`)

Per `docs/NICHE_APP_DATABASE_GUIDELINES.md`, niche features get their own
schema. Use `/db-migration-scaffold`.

| Table | Purpose |
|---|---|
| `prioritized.households` | Owner (the parent account) + settings: period type, deduction cap, framing mode |
| `prioritized.household_members` | Child **profiles**, not accounts. See § Compliance |
| `prioritized.chores` | Recurring definition: cadence, value, assignee, proof requirement |
| `prioritized.chore_occurrences` | Materialized instances: `dueAt`, `status`, `atRiskAt`, `completedAt`, `sortOrder` |
| `prioritized.periods` | Grant amount, open/closed state, close timestamp |
| `prioritized.ledger_entries` | Append-only: `grant` / `deduction` / `restoration` / `adjustment` |

Notes for whoever writes these:

- `sortOrder` on the occurrence is what makes the child's list reorderable. Put
  it on the occurrence, not the chore definition — priority is a decision about
  *this week*, not a permanent property of taking the bins out.
- Materialize occurrences rather than computing them on read. At-risk state,
  completion, and deductions all need somewhere to live, and a computed
  occurrence has no identity to attach a ledger entry to.
- Everything brand-scoped needs the three-part landing described in root
  `CLAUDE.md` § Brand-scoped database tables: the entry in
  `eslint-config/brand-scoped-tables.js`, a `*Store.ts` extending
  `BrandScopedStore`, and the narrow eslint-disable inside that store.
  `npm run test:lint-rules` fails if the first two drift apart.
- Migrations must be idempotent and must not use `async` table-builder
  callbacks — both are lint-enforced. See `CLAUDE.md` § Migrations.

### Config touchpoints for a new brand

Per `docs/NICHE_APP_SETUP_STEPS.md`, on `general`:

- `therr-js-utilities/src/constants/enums/Branding.ts` — add `PRIORITIZED`
- `therr-js-utilities/src/constants/enums/FeatureFlags.ts` — the flag set
- `therr-js-utilities/src/constants/enums/PushNotifications.ts`
- `push-notifications-service/src/api/firebaseAdmin.ts`
- `users-service/src/constants/hostContext.ts` — register `prioritized.ai`
- `therr-client-web-dashboard/src/utilities/getHostContext.ts`

Brand assets, `brandConfig.ts`, app id and icons go on
`niche/PRIORITIZED-general`. Never mixed — see § Branch Discipline.

### Feature flags

Off: `ENABLE_MAP`, `ENABLE_SPACES`, `ENABLE_EVENTS`, `ENABLE_MOMENTS`,
`ENABLE_LOCATION_SERVICES`, `ENABLE_CONNECT`, `REQUIRE_PACT_ONBOARDING`.
On: a new `ENABLE_HOUSEHOLD` / `ENABLE_CHORE_LEDGER` pair, plus
`ENABLE_NOTIFICATIONS` and `ENABLE_ACHIEVEMENTS`.

---

## COMPLIANCE (READ BEFORE WRITING CODE)

This is the cost that makes the idea a three-to-four week build plus a real
compliance pass rather than a three-week build.

**Design constraint, accepted up front: children get profiles, not accounts.**
The parent owns the account. Child profiles hold a display name and an avatar
choice and nothing else — no email, no phone, no birthdate, no free-text that
could carry PII, no messaging with anyone outside the household, no advertising
of any kind.

This is what keeps the app out of Google Play's Families program and outside the
sharpest edges of COPPA, because the app collects no personal information *from*
a child. It costs you the kid-facing social features, and that trade is
deliberate — those features were never the product.

Before submission: complete the Play Data safety declaration honestly, and treat
"is this directed to children?" as a question to answer with a lawyer rather
than with a guess. Nothing in this document is legal advice.

---

## RESEARCH

Everything in this section was gathered on 2026-09-01 to decide whether to build
this. It is recorded here so it does not have to be re-gathered.

### The mechanic has real evidence behind it

Fryer, Levitt, List and Sadoff ran a field experiment paying teachers their
performance bonus **upfront**, to be returned if students underperformed, versus
the identical money offered as a conventional year-end bonus.

- Loss-framed: **+0.124σ** in math achievement.
- Gain-framed: **+0.051σ**, and **not statistically significant**.
- Earlier estimates from the same program ran **0.201σ–0.398σ**.

Same money. Same amount. Different default. That gap is the entire product
thesis.

- *Enhancing the Efficacy of Teacher Incentives through Framing: A Field Experiment* — AEJ: Policy, <https://www.aeaweb.org/articles?id=10.1257%2Fpol.20190287>
- NBER working paper 18237 — <https://www.nber.org/papers/w18237>
- Plain-language summary — <https://news.uchicago.edu/story/student-performance-improves-when-teachers-given-incentives-upfront>

Loss framing has also been applied successfully to adolescents specifically,
including a randomized trial on daily glucose self-monitoring in 14–20 year olds
— <https://pmc.ncbi.nlm.nih.gov/articles/PMC8175460/>

### "Deduction already exists" is true and is not the same thing

Homey, Bankaroo, Chores & Allowance Bot and Chores/Rewards/Allowance all support
deducting money. **They implement it as a fine levied after the fact against
money the child earned.** None of them grants the period balance up front as the
default state.

In loss-aversion research the framing *is* the intervention — the endowment is
what creates the sense of ownership that makes the loss aversive. So a
competitor having a "deduct" button is not prior art for this product. Do not
let a reviewer or a future strategy doc conflate the two.

- <https://apps.apple.com/us/app/chores-allowance-bot/id629797415>
- <https://www.finder.com/kids-banking/chores-and-allowance-apps>

### The structural moat

The largest competitors — Greenlight ($5.99+/mo), FamZoo ($5.99), GoHenry
($4.99+), BusyKid ($4) — are **card issuers**. Chores are bolted onto a
fintech product. Pre-loading a balance that may later be clawed back is
genuinely messy when the money is real, spendable, and already sitting on a
child's debit card.

A tracking-only app that never moves money does it trivially. **Never moving
money is a feature, not a limitation**, and any future push toward "let's add
real payments" should be weighed against the fact that it would forfeit the one
thing incumbents cannot easily copy — as well as re-opening a large regulatory
surface.

Price point is validated: four competitors sustain $4–6/mo.

- <https://www.modakmakers.com/learning/chores/best-allowance-apps-for-kids>

### The backlash risk — the real commercial threat

The threat to this product is not competition. It is the parenting market's
prevailing stance against punishment-based tools.

- UCL research indicating young people respond more to reward than punishment
- Research finding that control- and surveillance-heavy parental apps undermine
  child autonomy and the parent–child relationship —
  <https://dl.acm.org/doi/10.1145/3476084>
- The category's own content marketing is explicitly anti-punishment —
  <https://www.gohenry.com/uk/blog/chores/how-to-motivate-your-kids-to-do-chores>

For a product with **no marketing budget**, one-star reviews and parenting
influencer pushback are not a PR problem, they are the entire acquisition
channel failing. Treat this as a first-class design constraint.

Everything in this brief that looks like a soft touch is a mitigation for it:
the name, child-controlled ordering, at-risk warnings before every deduction,
recovery open until period close, and the deduction floor. Do not quietly
optimize any of them away.

### Overjustification — the honest counter-argument

Paying children for chores can erode the intrinsic motivation to do them. The
classic result: preschoolers who already enjoyed drawing and were promised a
reward drew less voluntarily afterward than children who were rewarded
unexpectedly or not at all.

- <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3906839/>

There is a plausible argument that loss framing makes this *worse*, by making a
child's sense of ownership contingent on compliance. We do not know. **This is
the most important unresolved question about the product.**

Mitigation with a side benefit: make framing a per-household setting —
gain-framed (earn up to the amount) or loss-framed (start at the amount) — with
loss-framed as the default. Beyond being the humane option for families who want
it, it hands you a natural experiment on retention and completion between the
two modes, on real users, for free. Instrument it from day one; the data is the
most valuable thing this app could produce.

### Provenance

Ranked first of three third-app candidates on 2026-09-01. The two runners-up
were a faith small-group reading app (best distribution, weakest
differentiation) and a run-club app (rejected on the finding that run clubs
organize in free WhatsApp groups, not Meetup, making the incumbent free and
pre-installed). Full comparison:
<https://claude.ai/code/artifact/0a63c725-51cb-4c13-a0ea-4aba37d6dc34>

---

## MONETIZATION

Follow the Friends with Habits pattern; the infrastructure is built.

- **Free tier** — one household, a small number of active chores. Enforce at a
  single point, the way `assertHabitCapacity` does, returning 402 with paywall
  metadata rather than scattering checks.
- **Paid** — $4.99/mo, at the low end of a validated band, or a one-time
  lifetime unlock. The lifetime purchase flow already exists, is server-verified
  against the Play Developer API, and is the lower-friction option for a
  household that will not accept another subscription.
- **Never** — advertising, in-app purchases aimed at the child, or anything that
  monetizes a child profile. Non-negotiable, both on policy grounds and because
  it would destroy the trust the product depends on.

---

## THE CHEAPEST NEXT STEP

Do not register the brand, buy assets, or create the niche branch yet.

The household model is a group, an assignable recurring chore, and a period
ledger. Build those three on `general` behind a feature flag, run it in one real
household for a month with the balance granted up front, and observe whether a
child behaves differently when the money is already theirs.

Every part of that is reusable regardless of the answer, and it tests the only
assumption that actually matters. Branding is cheap and comes after.

Things worth watching during that month:

- Does the child ever reorder the list, or is prioritization a feature nobody
  wanted?
- Do at-risk warnings produce completions, or resentment?
- How often does recovery-before-close actually get used? If never, the rule
  is not doing its job and needs a longer window or louder surfacing.
- Does the monthly chore still get left to the last day?

---

## BRANCH DISCIPLINE

Standard rules from root `CLAUDE.md`, restated because this project will span
both sides from its first week.

**Must land on `general`:** schema and migrations, `therr-services/**`,
`therr-api-gateway/**`, `therr-public-library/**`, the `BrandVariations` entry,
feature flag definitions, `hostContext`, and this document.

**May stay on `niche/PRIORITIZED-general`:** `TherrMobile/**` UI, brand assets,
`brandConfig.ts`, app id and icons, Firebase/Google Services files, and locale
strings only this variant renders.

Never mix them in one commit. A niche branch has no CI path to `main`, so shared
code committed there is dead code that runs locally and never in production. Use
`/split-branch-prs` when raising PRs and `/branch-guard` before staging.

All user-facing strings must exist in `en-us`, `es`, and `fr-ca` —
`npm run locales:check` enforces it, and `/i18n-sync` scaffolds the gaps.

---

## OPEN QUESTIONS

Deliberately unresolved. Do not treat any of these as settled by omission.

1. **Does loss framing help or hurt with children specifically?** The evidence
   is from adults and older adolescents. This is the product's central bet and
   it is genuinely untested in this population.
2. **What is the right at-risk window?** 24 hours before the deduction? 48? Does
   it scale with the chore's value or its cadence? A monthly chore probably
   needs a much longer runway than a weekly one.
3. **Does the deduction cap belong at 50%?** Picked as a starting point, not
   derived from anything.
4. **Should unspent balance roll over, or reset each period?** Rollover rewards
   saving; reset keeps each period's stakes clean. These pull against each other.
5. **Weekly or monthly as the default period?** Monthly makes the endowment feel
   larger and the prioritization problem richer. Weekly gives faster feedback,
   which matters more for younger children. Possibly an age-dependent default.
6. **Do siblings see each other's lists?** Comparison could motivate or could
   poison a household. Default to private; make it a setting only if asked for.
7. **Should the app ever suggest an order, or only let the child set one?** A
   suggestion is a teaching aid; it is also the app doing the thinking.
8. **Does `prioritized.ai` fit a family product?** The domain is owned and the
   name is right, but a `.ai` TLD reads as developer-tooling to a parent
   audience. Worth a second look before it goes on a Play listing.
