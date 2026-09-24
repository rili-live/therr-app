---
name: aso-listing
description: Audit and rewrite a Google Play store listing (title, short and full description, screenshots, feature graphic) for Friends with Habits or Therr, grounded in the app's real Play acquisition data, user review vocabulary and the positioning hypotheses the Google Ads campaigns are testing. Keeps the listing copy version-controlled in Fastlane supply files, checks Play's character limits and metadata policy, keeps the three locales in step, and records the Play Console paste as a manual follow-up. Use when changing store positioning, before or after a paid campaign (the App campaign sends every click to this listing), or when store-listing conversion looks weak.
user-invocable: true
argument-hint: "[audit|rewrite|localize] [habits|therr]"
---

# ASO Listing

The Play listing is the landing page for the Friends with Habits App campaign: every paid
click in `scripts/google-ads/campaigns/habits-app-install.yaml` lands there, and its
conversion rate is part of the CPI that campaign is measuring. It is also the only page an
organic Play search visitor ever sees. This skill treats it like code — versioned, checked,
measured. Methodology adapted from `marketing/marketing-app-store-optimizer.md` in
[msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents) (MIT).

## Modes

| Argument | Does |
|---|---|
| `audit` _(default)_ | Score the current listing against data and policy; no edits |
| `rewrite` | Audit, then write proposed copy into the Fastlane files |
| `localize` | Produce `es-419` and `fr-CA` versions of the current `en-US` listing |

Second argument picks the app: `habits` → `com.therr.habits`, `therr` → `app.therrmobile`
(**not** `com.therr.mobile` — that returns zero rows, not an error). Default `habits`.

## Step 0 — Branch

Listing copy is brand identity. It lives with the app it describes:

| App | Branch | Files |
|---|---|---|
| Friends with Habits | `niche/HABITS-general` | `TherrMobile/fastlane/metadata/android/<locale>/` |
| Therr | `general` | same path |

Check `git branch --show-current`. If it does not match the app, stop and say which branch
to switch to — Friends with Habits copy committed on `general` would ride into the Therr
build (see "Step 2 is silent in both directions" in the root `CLAUDE.md`). An `audit` needs
no branch; `rewrite` and `localize` do.

## Step 1 — Current listing

Fastlane `supply` layout, alongside the existing release notes:

```
TherrMobile/fastlane/metadata/android/<locale>/title.txt              # ≤ 30 chars
TherrMobile/fastlane/metadata/android/<locale>/short_description.txt  # ≤ 80 chars
TherrMobile/fastlane/metadata/android/<locale>/full_description.txt   # ≤ 4000 chars
TherrMobile/fastlane/metadata/android/<locale>/images/phoneScreenshots/
TherrMobile/fastlane/metadata/android/<locale>/images/featureGraphic.png
```

Locales are `en-US`, `es-419`, `fr-CA` (see that directory's `README.md`).

If the text files do not exist yet, bootstrap `en-US` from the live listing — fetch
`https://play.google.com/store/apps/details?id=<package>&hl=en_US` and extract the title,
short description and full description — or ask the user to paste them from Play Console
(Grow users → Store presence → Main store listing). Commit the bootstrap on its own before
any rewrite, so the diff of the rewrite is reviewable.

Note what exists for `es-419` / `fr-CA`. As of the first campaign the Play listing was
en-US only, which is why the campaigns target English only.

## Step 2 — Evidence

Pull these before judging a word of copy. Say which ones were unavailable.

| Evidence | Source |
|---|---|
| Store visitors → installs (listing conversion) | `play_acquisition` (therrplay MCP), last 28 days and the 28 before |
| Traffic source split | `play_acquisition` with `dimension="traffic_source"` — collapses to `"Other"` below Google's privacy threshold; that is expected at current scale, not a bug |
| Installs trend | `play_installs` |
| The words users use | `play_reviews` — collect the phrases people use for what the app does for them; those are keyword candidates and trust signals |
| Rating | `play_ratings` |
| What happens after install | GA4 property `267810693`, stream "Friends with Habits": `first_open` → `profile_create_start` → `phone_verify_success` → `connection_invites_sent` (analytics-mcp `run_report`) |
| Which positioning is winning | `./therrads report ads --days 28` and `./therrads analyze --days 28` in `scripts/google-ads/`, once the web arm has run — per-ad-group cost and search terms |

The therrplay setup and its failure modes are in `scripts/google-play/CLAUDE.md`; read it if
a report comes back empty.

## Step 3 — Positioning

`scripts/google-ads/campaigns/habits-web-landing.yaml` states the live hypothesis: people who
convert are looking for **accountability** (partner, buddy), not a generic **habit tracker**,
with a third theme for the **can't-stick-to-habits** failure state. It says outright that if
the accountability group wins, "the positioning and the Play listing should lead with
accountability and stop competing with Streaks/Habitify on tracker features."

So the listing has to take a position, and say which one:

- If ad data exists, follow it and cite it.
- If not, write for the brief's stated differentiator (`docs/niche-sub-apps/HABITS_PROJECT_BRIEF.md`)
  and mark the choice as a hypothesis the next campaign read-out will test.
- Tell the user about the partner requirement in the listing. A cold installer who finds
  out about the partner wall only after installing is the 26% uninstall rate in the organic
  baseline. Setting that expectation in the listing costs some installs and saves a lot of
  wasted ones.

## Step 4 — Write or score

**Title (≤ 30).** Brand name plus one keyword phrase from the position. Play policy forbids
in the title, icon and developer name: store-performance or promotional terms ("#1", "top",
"best", "free", "new", "sale", "discount"), all-caps words that aren't the brand, emoji and
repeated special characters.

**Short description (≤ 80).** The one line most visitors read. The hook, the position's
keyword and a concrete benefit. No "download now".

**Full description (≤ 4000).** Play indexes this for search (there is no keyword field, unlike
iOS). Structure:
1. Opening two lines: what it is and who it is for. This is the fold above "About this app".
2. How a pact works, in three or four short lines.
3. What is free and what the Founder Unlock is. Every claim must match the product today: check
   the free-tier limits and prices in the code and `habits.therr.com` landing copy
   (`therr-client-web/src/views/habits/landing.hbs`), not in older docs. A stale "free" claim has
   already shipped once on the web.
4. Features as short bullets using the words from reviews.
5. Privacy line: what is and is not done with phone number and contacts. This addresses the
   top fear the `persona-walkthrough` agent's cold-install persona raises.

Use keywords naturally, a few times each. Repeating a keyword unnaturally, or listing keywords,
is a metadata policy violation and can get the listing rejected.

**Screenshots (2–8 phone; JPEG or 24-bit PNG, no alpha; each side 320–3840px, long side
≤ 2× short).** The first three show up in search results, so they have to make the argument
without the description. Order them to match the position: pact with a partner first if
leading with accountability. Use the same product screenshots and lines as the ad creative
(`scripts/google-ads/assets/build_frames.py` `CONCEPTS`) so the story a paid visitor saw in
the ad continues on the listing. **Feature graphic** 1024×500.

Check lengths with a real character count, not by eye:

```bash
for f in TherrMobile/fastlane/metadata/android/*/{title,short_description,full_description}.txt; do
    [ -f "$f" ] && python3 -c "import sys; t=open(sys.argv[1], encoding='utf-8').read().rstrip('\n'); print(f'{len(t):5d}  {sys.argv[1]}')" "$f"
done
```

## Step 5 — Localize (`localize`, or any rewrite)

A change to `en-US` needs the same change in `es-419` and `fr-CA`, or a note that those
locales are knowingly left behind. Use the app's own terms from `TherrMobile/main/locales/es`
and `fr-ca` so the listing and the app use the same words for "pact", "check-in" and "streak".
French runs longer than English — recount against the limits after translating.

Say in the summary that the `es-419` / `fr-CA` copy was machine-authored, and ask whether it
needs a fluent-speaker pass before publishing. Editorial guides have been cleared to ship
without one; a store listing is more visible and has not been — don't assume the same rule.

## Step 6 — Hand-off

Nothing uploads this automatically (same situation as the release notes; see the metadata
`README.md`). Finish with:

1. The files changed, with old → new character counts.
2. For each change, the evidence or hypothesis behind it.
3. A measurement plan: `play_acquisition` listing conversion over the 28 days before and after
   the Play Console publish date. Note what else changed in that window (a campaign start or
   budget change will swamp the listing effect). At current volume a Play Store Listing
   Experiment will not reach significance; don't propose one until the listing gets a few
   thousand visitors a month.
4. A `- [ ]` item under **§ Manual Operational Follow-ups** in `docs/WORK_IN_PROGRESS.md`:
   paste the copy into Play Console → Store presence → Main store listing (and each
   translation), upload the screenshots, and record the publish date. That file lives on
   `general`, so if the copy was committed on a niche branch, add the follow-up in a separate
   commit on `general`.

Keep the copy commit separate from any code commit (root `CLAUDE.md` → Commit separation).
