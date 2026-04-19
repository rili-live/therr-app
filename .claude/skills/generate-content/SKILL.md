---
name: generate-content
description: Generate editorial guides and data-driven posts for /guides using production data (top spaces by city/category, activity stats). Writes static JSON to therr-client-web/src/content/guides/ for SSR rendering.
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash(npx ts-node scripts/generate-content/*), Read, Write, Edit
argument-hint: [--list --city slug --category slug [--curated]] [--data --topic name --city slug] [--review slug] [--refresh slug [--apply] [--add-new n]] [--limit n] [--draft]
---

# Generate Content (Editorial Guides)

You are an editor producing **publishable** local guides for therr.com. The goal is content that ranks for high-intent queries Google's directory pages cannot win — "best X in Y", "things to do in Y", and data-driven angles that competitors don't have.

Output goes to `therr-client-web/src/content/guides/<slug>.json` and is rendered server-side at `/guides/<slug>`. The frontend, JSON-LD (Article + ItemList + BreadcrumbList + FAQPage), sitemap, and "Featured in" backlinks are already wired up.

## Mode selection

| Arguments | Mode | Description |
|-----------|------|-------------|
| `--list` | **Curated list post** | Rank top spaces in a city + category; write commentary blurbs |
| `--data` | **Data-driven post** | Aggregate Therr activity (e.g., busiest hour for bars in Denver) |
| `--review <slug>` | **Review existing post** | Read the post JSON and check headline, lead, blurbs, FAQ for quality |
| `--refresh <slug>` | **Refresh existing post** | Re-check space references against production; optionally prune/bump updatedAt |

`--draft` saves as `status: "draft"` (not publicly viewable). Default is `published`.

---

## Mode 1: Curated list post (`--list`)

A list post is an editorial ranking like "10 Best Coffee Shops in Denver" with commentary that's defensible — not just "good vibes" filler.

### Step 1: Fetch ranked spaces

Run the query script. **Strip skill-only flags before passing to the script.**

```
npx ts-node scripts/generate-content/query-top-spaces --city <slug> --category <slug> --limit <n> --window <days> [--mode auto|engagement|curated] [--minVisits 25] [--minTopVisits 5]
```

Defaults: `--limit 15`, `--window 90`, `--mode auto`, `--minVisits 25`, `--minTopVisits 5`.

**Production category slugs are prefixed with `categories.`** — e.g., `categories.restaurant/food`, `categories.bar/drinks`, `categories.storefront/shop`, `categories.cafe`. Use `npx ts-node scripts/generate-content/discover-categories --window 365 --minSpaces 5` to find available (city, category) buckets.

The script returns JSON to stdout: `{ query, mode, modeReason, totals, spaces[] }`. Each space includes `id`, `name`, `category`, `address`, `websiteUrl`, `phoneNumber`, `hasMedia`, `completeness` (which signals are present), and `metrics` (`visits`, `uniqueVisitors`, `impressions`, `score`).

**Two ranking modes — read `mode` from the response and frame the post honestly:**

- `engagement`: ranked by `visits * 5 + impressions` over the window. Use language like "ranked by community visits" or "the most-visited X in <city>".
- `curated`: ranked by a completeness score (has website + phone + full address + ≥60-char description + media). Use language like "an editor-curated list", "hand-picked", or "venues with the most complete profiles". **Do NOT claim popularity, ranking, or visit counts in this mode** — the data does not support it.

**Auto-fallback:** with the default `--mode auto`, the script picks `engagement` only when (a) total visits across candidates ≥ `--minVisits` (default 25) AND (b) the top-ranked space itself has ≥ `--minTopVisits` (default 5). Either check failing falls back to `curated`. The `modeReason` field explains the decision. This prevents writing "most-visited" claims when the data is too thin OR too flat (40 spaces × 1 visit each is technically "lots of visits" but doesn't support a ranking).

**Force a mode** when you know what you want: `--curated` (or `--mode curated`) to skip the engagement check, `--mode engagement` to demand it (will still return data, but you must double-check `totals.visits` is meaningful before claiming a ranking).

### Step 2: Triage and write blurbs

For each space in the top N:
- **Skip generic chains** (Starbucks, Subway, etc.) — they add no editorial value to a "best of" list
- **Write a 1-2 sentence blurb** that gives a concrete reason to visit — vibe, signature item, who it's for
- **Add a `reason` field** when the rank is non-obvious (e.g., "highest visit count among indie roasters in 90-day window")

**Do not write fake details.** If you don't know the signature item, keep the blurb generic — quality first.

### Step 3: Write the post body

Build the post JSON with this structure (see `scripts/generate-content/utils/contentSchema.ts` for the runtime validator):

```json
{
  "slug": "best-coffee-shops-denver",
  "type": "list",
  "status": "published",
  "title": "10 Best Coffee Shops in Denver (2026)",
  "description": "A locally-curated guide to the top coffee shops in Denver — ranked by community visits and editorial picks.",
  "city": "denver-co",
  "category": "cafe",
  "publishedAt": "2026-04-19",
  "updatedAt": "2026-04-19",
  "author": "Therr Editorial",
  "lead": "Two-sentence hook that summarizes the premise and ranking method.",
  "sections": [
    { "type": "prose", "body": "Optional intro paragraph(s)..." },
    { "type": "space-list", "items": [
      { "spaceId": "<uuid>", "rank": 1, "blurb": "...", "reason": "..." }
    ]},
    { "type": "faq", "items": [
      { "question": "...", "answer": "..." }
    ]},
    { "type": "cta", "heading": "...", "body": "...", "href": "/locations/city/denver-co/cafe", "ctaText": "Browse all" }
  ]
}
```

**Constraints (enforced by validator):**
- `title` ≤ 70 chars, `description` ≤ 165 chars (SEO meta limits)
- `slug` lowercase + hyphens, must be unique
- `publishedAt` and `updatedAt` ISO date `YYYY-MM-DD`
- Always include at least one `space-list` section so the ItemList JSON-LD fires
- 3-5 FAQ items is the sweet spot for FAQPage rich snippets

### Step 4: Save

Pipe the JSON into the save script:

```
echo '<post-json>' | npx ts-node scripts/generate-content/save-post --stdin
```

Or write to a temp file and pass `--content <path>`. The script:
1. Validates the post against the schema
2. Writes it to `therr-client-web/src/content/guides/<slug>.json`
3. Regenerates `src/content/guides/index.json`

Use `--dry-run` to validate without writing. Use `--force` to overwrite an existing slug.

---

## Mode 2: Data-driven post (`--data`)

Data posts use unique Therr metrics (visit counts, hour-of-day patterns, category mix) that aggregators don't have. They're optimized for "X in Y by the numbers" queries and as link bait.

### Step 1: Fetch stats

```
npx ts-node scripts/generate-content/query-activity-stats --topic <topic> --city <slug> [--category <slug>] [--window <days>]
```

Available topics:
- `hour-of-day` — Visit volume by hour (good for "when is X busiest")
- `day-of-week` — Visit volume by day of week
- `top-by-hour` — Top space per hour bucket
- `category-mix` — Share of visits by category in a city

The script outputs JSON arrays / tables you can drop directly into `data-table` or `data-callout` sections.

### Step 2: Write the post

Lead with the **headline number** (e.g., "Bars in Denver are busiest at 9 PM on Saturdays"). Use these section types:

- `data-callout`: One big stat with a label — e.g., `{ "stat": "9 PM", "statLabel": "peak hour for Denver bars", "body": "..." }`
- `data-table`: Tabular breakdown — `{ "caption": "...", "headers": [...], "rows": [[...]] }`
- `prose`: Interpretation — what the data means, who should care
- `faq`: 3-5 questions that capture related search intent

**Methodology paragraph required.** Always add a `prose` section explaining: window of analysis, what counts as a "visit", any filtering. Credibility matters for data posts.

### Step 3: Save

Same as Mode 1 — pipe to `save-post --stdin`.

---

## Mode 3: Review existing post (`--review <slug>`)

Read `therr-client-web/src/content/guides/<slug>.json` and check:

| Check | What to look for |
|-------|------------------|
| Title length | ≤ 70 chars (Google SERP truncation) |
| Description length | ≤ 165 chars |
| Lead quality | Hooks the reader in 1-2 sentences? Not generic? |
| Blurbs | Concrete and defensible? No "great vibes" filler? |
| FAQ | 3-5 items? Real questions a person would search? |
| `space-list` | Has at least one item? IDs look like UUIDs? |
| Methodology | If `type: "data"`, is window/source/method explained? |
| Locales | If `locales` block exists, do `es` / `fr-ca` mirror the structure? |
| Fact-check | Are dates current? Any spaces likely closed? |

Report issues in a punch list. Do not edit the post unless the user asks.

---

## Mode 4: Refresh existing post (`--refresh <slug>`)

Use this when a post has been live for a while and you want to re-verify that every space it references is still open, public, and in the right city. Also useful for bumping `updatedAt` (a freshness signal for SEO) and optionally promoting newly-qualifying spaces into the list.

### Step 1: Run a report-only refresh first

```
npx ts-node scripts/generate-content/refresh-post --slug <post-slug>
```

Output JSON includes `drift` with a status per spaceId:

- `ok` — space is still live, public, and in-city
- `missing` — space no longer exists in DB (deleted)
- `private` — `isPublic = false` (owner unpublished it)
- `moved` — `addressLocality` no longer matches the post's city

No files are written in this mode. Read the report, decide whether the post is still credible, and flag spaces that need an editorial rewrite (e.g., a `moved` status might mean the blurb's "heart of downtown" framing is now wrong).

### Step 2: Apply safe pruning

```
npx ts-node scripts/generate-content/refresh-post --slug <post-slug> --apply
```

With `--apply`, the script:
1. Removes every item whose status is `missing` or `private`
2. Re-ranks the remaining items 1..N, preserving their relative order
3. Bumps `updatedAt` to today
4. Rewrites the guide JSON and regenerates `index.json`

`moved` spaces are **kept** — moving is judgement-intensive (maybe the space relocated within the city, which is fine). Review `moved` entries by hand.

### Step 3 (optional): Enrich with new candidates

```
npx ts-node scripts/generate-content/refresh-post --slug <post-slug> --apply --add-new 3
```

Adds up to N new spaces to the last `space-list` section (drawing from the post's city + category, excluding existing ids, ranked by completeness). New items are appended with **empty blurbs and a `reason` of "Added during refresh — needs editorial blurb."** so they're easy to spot.

**You must write a blurb for each newly-added item** before the next deploy — the validator will accept empty blurbs, but a blank blurb in production is embarrassing.

### When to refresh

- Any time a guide is 60+ days old — bump `updatedAt` to keep it fresh for Google
- After a known data issue (mass cleanup, owner takedowns, city migration)
- Before re-sharing the guide on social / in email
- Quarterly for the whole library: loop every slug in `therr-client-web/src/content/guides/index.json` and run report-only first, then selectively `--apply`

---

## Workflow tips

- **Pilot before scaling.** Generate 1 list post + 1 data post, get the user to review URLs in `/guides/<slug>`, then iterate.
- **Don't generate 50 thin posts.** A handful of well-researched guides outperform a flood of low-effort pages — Helpful Content Update was built to penalize the latter.
- **Cross-link.** When writing a list post, mention sibling categories in prose ("for nightlife after dinner, see our [bars in Denver guide]"). Internal links help.
- **Keep slugs evergreen.** Avoid year-only slugs (`best-coffee-2026`) — they rot. The title can include the year; the slug should not.

## What NOT to do

- Don't fabricate visit counts, ratings, or quotes
- Don't claim "most-visited" / "ranked by community" framing when `mode === "curated"` — the engagement signal is too thin to back it up
- Don't generate per-(city × category) posts mechanically — that's the doorway-page pattern Google penalizes
- Don't write more than 5 FAQ items — diminishing returns and dilutes the rich snippet
- Don't skip the validator. If `save-post` fails, fix the JSON; do not bypass
- Don't `--apply` a refresh without first reading the report-only output — pruning is irreversible without git

## Reference

- Schema: `scripts/generate-content/utils/contentSchema.ts`
- Query (rank by engagement OR completeness with auto-fallback): `scripts/generate-content/query-top-spaces.ts`
- Activity stats (data posts): `scripts/generate-content/query-activity-stats.ts`
- Save/validate post: `scripts/generate-content/save-post.ts`
- Refresh existing post: `scripts/generate-content/refresh-post.ts`
- Discovery helpers: `scripts/generate-content/discover-categories.ts`, `discover-impressions.ts`, `discover-metrics.ts`
- Frontend renderer: `therr-client-web/src/routes/Guide/index.tsx`
- JSON-LD builder: `therr-client-web/src/utilities/guideJsonLd.ts`
- Sitemap entry: `/sitemap-guides.xml` (regenerated hourly)
- Featured-in backlink: `therr-client-web/src/routes/ViewSpace.tsx` (auto-discovered from any post that lists the spaceId)
