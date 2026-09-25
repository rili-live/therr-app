---
name: ad-creative
description: Write, audit or refresh the text and image creative for the Friends with Habits Google Ads campaigns in scripts/google-ads/campaigns/*.yaml — responsive search ad and App campaign headlines and descriptions, and the image frame concepts in scripts/google-ads/assets/build_frames.py. Checks every claim against what the product does today, checks that each headline and description stands alone in any combination, checks the ad-to-landing-page-to-Play-listing message match and Google Ads editorial policy, and validates offline with therrads. Never spends money, which means no campaign apply or resume without an explicit go-ahead. Use before a campaign's first run, when a read-out shows weak assets, or when product copy, pricing or the free tier changes.
user-invocable: true
argument-hint: "[audit|write|concepts] [campaigns/<spec>.yaml]"
---

# Ad Creative

Text and image creative for the paid-acquisition experiment in
`docs/PAID_ACQUISITION_PLAYBOOK.md`. The copy has two jobs: be cheap to serve, and **not
distort the experiment**. An ad that over-promises buys installs that churn at the partner
wall, which reads as a product failure when it was a copy failure. Methodology adapted
from `paid-media/paid-media-creative-strategist.md` in
[msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents) (MIT).

Read `scripts/google-ads/CLAUDE.md` first. It loads automatically in that directory and
holds the parts of the tooling that are not inferable from the code.

## Modes

| Argument | Does |
|---|---|
| `audit` _(default)_ | Check every spec's text assets and the image concepts; no edits |
| `write <spec>` | Audit, then propose and write new headlines / descriptions into that spec |
| `concepts` | Review or add image concepts in `build_frames.py`, regenerate, and look at the output |

## What the tooling does and does not do

- Text assets live in the spec at **campaign level** (`assets.headlines`,
  `assets.descriptions`). Ad groups carry keywords, not copy. So in
  `habits-web-landing.yaml` one headline set has to serve all three ad-group themes
  (accountability, generic tracker, can't-stick). If a theme needs its own copy, that's a
  change to `therr_ads/spec.py`. File it with `/github-issues defer` rather than working
  around it.
- `./therrads campaign apply` **creates** a campaign. Changes to an existing campaign
  support budget and status only. Changing the copy of a campaign that has already served
  means an Ads UI edit, or a new campaign with a new `utm_campaign`. **Never rename
  `utm_campaign` on a campaign that has served**: it orphans every attributed signup from
  its spend.
- Images and videos are **never uploaded** by the tool. They are attached by hand in the
  Ads UI (`scripts/google-ads/assets/README.md`).

## Step 1 — Ground truth for claims

Before writing or scoring a line, list what the product does and costs **today**, from code
and the live landing copy, not from older docs:

- free tier limits and the Founder Unlock price: users-service habits handlers,
  `therr-client-web/src/views/habits/landing.hbs`, `register.hbs`
- what a check-in can carry (photo, note), how streaks work
  (`docs/niche-sub-apps/habits/HABITS_CHECKINS_DESIGN.md`, `HABITS_STREAKS_DESIGN.md`)
- whether a card is required, whether a partner is required to start

Every ad claim must map to one of these. The free-tier copy on the web went stale once
already. Flag any existing asset that no longer matches.

## Step 2 — Check the text assets

For each headline and description in the spec:

1. **True.** It maps to a Step 1 fact.
2. **Stands alone.** Google assembles any headline with any other, and any description
   with any headline. No line may depend on another to make sense ("It's that simple.").
   Read every headline aloud next to every description once.
3. **Not redundant.** Two headlines saying the same thing waste a slot and lower Ad
   Strength. Group them by angle and make sure the angles differ:
   - *mechanic*: "Every Habit Is a Pact"
   - *partner/accountability*: "Your Accountability Partner"
   - *outcome*: "Habits That Actually Stick"
   - *loss aversion*: "Don't Break the Streak"
   - *keyword*: literally contains a theme's top keyword
   - *offer/CTA*: "Start Free, No Card Needed"
   The web arm (up to 15 headlines) should carry at least one keyword-bearing headline per
   ad-group theme, because assets are shared across groups. The App arm (≤ 5) should carry
   one headline per angle.
4. **Honest about the partner.** At least one asset should say a partner is part of the
   deal. Cold installers who find out after install are the organic baseline's 26% uninstall
   rate. Fewer, better-informed installs are the right trade for an experiment.
5. **Policy.** Google Ads editorial rules: no exclamation mark in headlines, at most one
   per description; no ALL-CAPS words (Title Case is fine); no repeated punctuation or
   symbols, no emoji; no phone numbers in text; no "click here"; superlatives ("best",
   "#1") need third-party support on the landing page, so drop them.
6. **Consistent with targeting.** Surface any tension between copy and negatives or
   hypothesis as a question, not an error — some are deliberate. Example: `free` is a
   negative keyword in the web spec, while one of its headlines and two of its descriptions
   say "free".

Limits are enforced by the validator. Run it rather than counting by hand:

```bash
cd scripts/google-ads
./therrads campaign validate campaigns/<spec>.yaml
./therrads campaign plan campaigns/<spec>.yaml      # renders what would be sent, offline
```

## Step 3 — Message match

The same promise should carry from ad → landing → store:

| Arm | Click lands on | Check against |
|---|---|---|
| Web (`habits-web-landing.yaml`) | `https://habits.therr.com` | the hero and first fold of `landing.hbs`; capture it with the `persona-walkthrough` agent's Playwright recipe if a visual check is needed |
| App (`habits-app-install.yaml`) | Play listing for `com.therr.habits` | title, short description, first three screenshots (`aso-listing` skill) |

If the landing page or listing makes a different primary promise than the strongest
headline, report the mismatch and which side should move. The landing page and listing are
often the side that should move, and that change belongs on a different branch
(`landing.hbs` is web code on `general`; listing copy is on `niche/HABITS-general`).

## Step 4 — Image concepts (`concepts`)

`scripts/google-ads/assets/build_frames.py` `CONCEPTS` pairs a product screenshot with one
short line and a kicker, rendered at three ratios (1200×628, 1200×1200, 1200×1500). The
file's own rules hold:

- The image complements the headline beside it; it does not argue its own case. One line, ≤ ~6 words.
- Product screens only. The onboarding slides with burned-in headlines and stock photography
  are excluded for a reason, so don't bring them back.
- Each concept should match one headline angle from Step 2, so a test of angles can be read
  across text and image together.

After adding or changing a concept, regenerate and **look at every output** before calling
it done. Text that overflows or crowds a frame at 4:5 is the usual failure:

```bash
python3 scripts/google-ads/assets/build_frames.py   # needs rsvg-convert; reads the logo from `general`
```

Then `Read` each PNG in `scripts/google-ads/assets/habits/`. Update the `images:` list in the
App spec if filenames changed, and add a manual follow-up to upload them in the Ads UI.

## Step 5 — Cadence and read-out

At $10–$20/day, creative changes reset learning and cost more than they teach:

- Change creative no more than about every two weeks, and change one angle at a time. Write
  the hypothesis for the change as a comment beside the asset in the spec. That is where the
  repo records hypotheses.
- Judge assets on Google's per-asset performance labels only once they have meaningful
  impressions, and on downstream activation from `./therrads analyze`, not CTR alone. A
  high-CTR line that attracts people who stall at the partner wall is a loss.

## Hand-off

- Spec and `build_frames.py` edits are shared tooling and go on `general`, in their own
  commit, never mixed with app code.
- End with: assets changed (old → new), the Step 1 fact behind each claim, validator output,
  and any message-match changes needed elsewhere with their branch.
- Add a `- [ ]` under **§ Manual Operational Follow-ups** in `docs/WORK_IN_PROGRESS.md` for
  any Ads UI step (asset edits on a live campaign, image uploads).
- **Never** run `campaign apply --confirm`, `resume`, or `budget` without the user saying so
  in this session. Those spend money.
