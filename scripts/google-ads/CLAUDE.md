# Google Ads tooling — agent notes

Loaded automatically when working in `scripts/google-ads/`. Read this before
changing anything here. The user-facing walkthrough is `README.md`; this file is
the parts that are **not** inferable from the code.

## What this tool is for

Friends with Habits has no paid-acquisition history. The point of the first
campaigns is **not growth** — it is to buy enough usage data to answer three
questions that cannot currently be answered at all:

| Question | Data source | Where it is decided |
|---|---|---|
| CHANNEL — can we buy users at a price we can pay? | Google Ads metrics | `analysis._rule_channel_cost` |
| PRODUCT — do bought users do the thing the app is for? | product DB funnel | `analysis._rule_product_funnel` |
| MODEL — does the money work at this price and LTV? | funnel + spend | `analysis._rule_unit_economics` |

Every rule in `analysis.py` must state a fact, name which question it bears on,
and propose a specific next action. A rule that only reports a number is a
dashboard, not a rule, and does not belong here.

## The three hard truths this codebase is built around

### 1. The app arm is blind past the install

A Google App campaign sends the user to the Play Store. They never load a page
we control, so `main."userAcquisition"` gets no `utmCampaign`, and the account
they create is indistinguishable from an organic one. **Everything downstream of
a paid install is inference, not measurement.**

The fix is the Play Install Referrer API in `TherrMobile`: read the referrer
string on first launch, parse the UTM parameters out, and include them in the
registration payload's `userAcquisition` object. The server side already exists
(`UserAcquisitionStore.sanitizeUserAcquisition` drops unknown keys and truncates
to column width), so this is a mobile-only change — it belongs on
`niche/HABITS-general`, **not** `general`.

Until then, `habits-web-landing.yaml` is the only measured arm. That is why it
exists despite costing more per signup.

### 2. GA4 cannot see inside the app, and its web numbers are inflated

- Friends with Habits ships Firebase for **messaging**, not a GA4 app data
  stream. Installs, first opens, pact creation and the $20 Founder Unlock are
  invisible to GA4. Never read a GA4 conversion count as an app conversion.
- The consolidated property (`549794383`, measurement id `G-R7CY0Z1ZRM`) is
  polluted by a headless-Chrome crawler that produced ~87% of sessions over the
  60 days to 23 Aug 2026. A GA4 **data filter cannot exclude it** — data filters
  only support Developer and Internal traffic. `ga4.detect_crawler_contamination`
  flags it rather than filtering it, because silently dropping rows would make
  this tool disagree with the GA4 UI for no visible reason.
- The `surface` custom dimension is **not registered**. Querying
  `customEvent:surface` returns HTTP 400 for the *whole report*, not an empty
  column, which is why it sits behind `ga4.surface_dimension_registered`.

Both GA4 items are tracked in `docs/WORK_IN_PROGRESS.md § Analytics & traffic`.

### 3. A one-time $20 unlock is a hard ceiling on CAC

The Founder Unlock nets **$17.00** after Google Play's 15% fee, and it is a
single transaction — there is no second payment to amortise acquisition
against. The $6.99/mo premium tier in `HABITS_PROJECT_BRIEF.md` is **not built**.

So `cost per payer > $17` is not a campaign-tuning problem, it is a business-model
finding, and `_rule_unit_economics` says so in those terms. Do not soften that
verdict into "optimize the ads" — the arithmetic does not care how good the ads are.

## Invariants — do not break these

1. **Nothing mutates without `--confirm`.** Every mutating CLI command prints a
   plan and exits 0 having done nothing when the flag is absent. Adding a
   command that spends money without it is the one unacceptable regression.
2. **Specs ship `status: PAUSED`.** `tests/test_spec.py` enforces it for every
   file in `campaigns/`. A spec that creates a live campaign turns a review step
   into a billing event.
3. **Dollars never cross into the API layer as a bare number.** `money.to_micros`
   is the only conversion, and it uses `Decimal` — `int(20.10 * 1e6)` is
   `20_099_999`. A micros/dollars mix-up in the wrong direction is a 1,000,000x
   overspend.
4. **`analysis.py` stays pure.** No network, no credentials, no file I/O. It is
   the only module whose output a human acts on, and it is the only one with
   real test coverage. Keep those two facts connected.
5. **The product DB is read-only.** `product.py` uses the `DB_*_MAIN_READ` env
   vars and opens a `SET TRANSACTION READ ONLY` cursor. Do not add a write path.
6. **`tracking.utm_campaign` is immutable once a campaign has served.** It is the
   join key into `main."userAcquisition"."utmCampaign"`. Renaming it orphans
   every historical signup from the spend that produced it. Create a new
   campaign instead.
7. **Generated doc blocks are marker-delimited and replaced, never appended.**
   See `workitems.BEGIN_MARKER`. A weekly run that appends turns the backlog
   into a changelog.

## Where things live

```
therr_ads/
  money.py       micros conversion + budget guard rails   (pure, tested)
  spec.py        campaign YAML -> validated dataclasses   (pure, tested)
  settings.py    settings.yaml loader
  auth.py        OAuth refresh-token flow
  client.py      GoogleAdsClient factory + error hints
  campaigns.py   plan/apply, budget and status mutations       (plan is tested)
  reporting.py   GAQL -> normalized rows
  ga4.py         GA4 Data API + crawler guard             (guard is tested)
  product.py     the users-service funnel SQL
  analysis.py    rules -> signals, verdicts, actions      (pure, tested)
  workitems.py   writes into WORK_IN_PROGRESS.md          (pure, tested)
  cli.py         argparse surface
```

Run the tests with `python3 -m unittest discover -s tests -t .` from this
directory, or `npm run test:google-ads` from the repo root. They need no
credentials and no `google-ads` install — that is deliberate, and worth
preserving: CI runs them in the `google_ads_tooling_tests` job on every branch
with nothing installed but PyYAML, so a test that reaches for a live account is
a test that stops running.

## Branch placement

This directory is **shared operator tooling**: `scripts/**` and `docs/**`, no
`therr-services/`, no `TherrMobile/`, no root `package.json`. It is not deployed
code, but it should live on `general` so every branch has it and the two copies
cannot diverge. The one piece of work this tool will generate that does *not*
belong on `general` is the Play Install Referrer change — that is
`TherrMobile/**` and goes on `niche/HABITS-general`. See root `CLAUDE.md`
§ Branch Awareness.

## Adding a rule to the analyzer

1. Write the fixture in `tests/fixtures.py` that produces the situation.
2. Write the failing test in `tests/test_analysis.py` asserting on the verdict
   *and* the action item — a rule with no action is not finished.
3. Add the `_rule_*` function and call it from `analyze()`.
4. Respect `targets.min_conversions_for_verdict`. Below it, emit an `info`
   signal and `INSUFFICIENT_DATA`, never a recommendation. A decision made on a
   3-conversion sample is worse than no decision, because it feels informed.
