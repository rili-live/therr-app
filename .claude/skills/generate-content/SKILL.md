---
name: generate-content
description: Generate editorial guides and data-driven posts for /guides using production data (top spaces by city/category, activity stats). Writes static JSON to therr-client-web/src/content/guides/ for SSR rendering.
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash(npx ts-node scripts/generate-content/*), Read, Write, Edit
argument-hint: [--list --city slug --category slug [--curated]] [--data --topic name --city slug] [--hashtag --city slug --hashtag tag] [--walkable --city slug [--category slug]] [--review slug] [--refresh slug [--apply] [--add-new n]] [--limit n] [--draft]
---

# Generate Content (Editorial Guides)

You are an editor producing **publishable** local guides for therr.com. The goal is content that ranks for high-intent queries Google's directory pages cannot win — "best X in Y", "things to do in Y", and data-driven angles that competitors don't have.

Output goes to `therr-client-web/src/content/guides/<slug>.json` and is rendered server-side at `/guides/<slug>`. The frontend, JSON-LD (Article + ItemList + BreadcrumbList + FAQPage), sitemap, and "Featured in" backlinks are already wired up.

## Mode selection

| Arguments | Mode | Description |
|-----------|------|-------------|
| `--list` | **Curated list post** | Rank top spaces in a city + category; write commentary blurbs |
| `--data` | **Data-driven post** | Aggregate Therr activity (e.g., busiest hour for bars in Denver) |
| `--hashtag` | **Hashtag-anchored post** | Rank spaces by user-applied intent tag (e.g., `firstdate`, `latenight`) in a city |
| `--walkable` | **Walkable-cluster post** | Find a dense cluster of nearby spaces, order them as a route, render map + stops |
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

## Mode 5: Hashtag-anchored post (`--hashtag`)

Hashtag posts rank spaces by user-applied intent tags (`firstdate`, `latenight`, `worksession`, `livemusic`) rather than by category. The goal is to serve intent-based long-tail queries — "first date bars chicago", "late night food portland", "coffee shops to work seattle" — that category-driven directories can't.

The post's anchor is stored as `hashtag: "<tag>"` in `IPostMetadata` **instead of** `category`. The validator enforces exactly one of `{category, hashtag}`. A hashtag filter listing is served at `/guides/hashtag/<tag>` and hashtag URLs are included in `/sitemap-guides.xml`.

### Before you start: check the data

The `spaces.hashTags` column is today mostly populated by the OSM ingester (`scripts/import-spaces/transforms/mapToSpace.ts`), which derives tags from OSM `cuisine` / `amenity` / `shop` / `tourism` values. These look more like categories (`italian`, `bar`, `coffee`) than user intent (`firstdate`, `latenight`). **Run discovery first to confirm there's meaningful intent-shaped signal in the target city before writing a post**:

```
npx ts-node scripts/generate-content/discover-hashtags --city <city> --minSpaces 8 --intentOnly
```

- Drop `--intentOnly` to see all tags (useful for understanding what's actually there).
- `--intentOnly` filters to an allowlist of intent-shaped tags (see `INTENT_HASHTAG_ALLOWLIST` in the script).
- If the intent-only output is empty or thin, this plan is blocked on enriching user-applied tags upstream; don't force it.

### Step 1: Query spaces by hashtag

```
npx ts-node scripts/generate-content/query-by-hashtag --city <slug> --hashtag <tag> --limit <n> [--window <days>] [--mode auto|engagement|curated]
```

Same ranking discipline as `query-top-spaces` (engagement / curated / auto with `modeReason`). The matcher does an **exact, normalized tag match** after splitting `hashTags` on commas — `firstdate` will not match `firstdateandlast`. A leading `#` on `--hashtag` is stripped.

### Step 2: Write the post

Build the post JSON with `hashtag` in place of `category`:

```json
{
  "slug": "first-date-bars-chicago",
  "type": "list",
  "status": "published",
  "title": "8 First-Date Bars in Chicago",
  "description": "Editor-picked bars with the right vibe for a first date — conversational, not too loud, easy to find.",
  "city": "chicago-il",
  "hashtag": "firstdate",
  "publishedAt": "2026-04-19",
  "updatedAt": "2026-04-19",
  "author": "Therr Editorial",
  "lead": "...",
  "sections": [ /* same section types as Mode 1 */ ]
}
```

All other rules from Mode 1 apply: title ≤ 70 chars, description ≤ 165, honest mode framing, at least one `space-list`, 3–5 FAQ items.

### Step 3: Save

```
echo '<post-json>' | npx ts-node scripts/generate-content/save-post --stdin
```

The validator enforces `category XOR hashtag` — setting both or neither fails.

### When to use this vs. Mode 1

- **Category post (`--list` + `--category`)**: "best bars in Chicago" — broad, covers the whole category.
- **Hashtag post (`--hashtag`)**: "best first-date bars in Chicago" — narrower, intent-anchored. Sibling to the category post, not a replacement.

Cross-link hashtag posts from their category-post sibling in prose ("for date-night specifically, see our first-date bars guide") and vice versa.

## Mode 6: Walkable-cluster post (`--walkable`)

Walkable-cluster posts present 4–8 nearby spaces as a **walking route**, not a ranked list — "Wicker Park bar crawl: 5 stops, 1 mile". The frontend renders an ordered stop list with walking-distance badges between stops *plus* a Leaflet map centered on the cluster centroid. `TouristTrip` JSON-LD is emitted so the post can appear in Google's walking-tour rich results.

The section type is `walkable-route`; it is an **additional** section alongside the usual prose/FAQ blocks, not a replacement for `space-list`. Use category or hashtag anchoring normally — the route is orthogonal.

### Step 1: Discover dense clusters in a city

```
npx ts-node scripts/generate-content/discover-clusters --city <slug> [--category <slug>] [--limit 10] [--minSize 4] [--maxSize 8] [--maxDiameter 1500]
```

Defaults: `--limit 10`, `--minSize 4`, `--maxSize 8`, `--maxDiameter 1500` (meters — roughly a 19-minute walk tip-to-tip).

Output is a ranked list of clusters by **completeness-weighted density** (sum of member completeness scores / area). Each cluster includes its centroid, diameter, walking-time estimate, distinct categories, and the member spaces with address + completeness fields. Pick one whose narrative hook is obvious — a tight cluster of 5 well-documented bars beats a sprawling 8-space cluster with half the members missing phone numbers.

### Step 2: Build the route from the selected cluster

```
npx ts-node scripts/generate-content/query-walkable-cluster --spaceIds "<id1>,<id2>,<id3>,..."
```

OR, when you only have a centerpoint (e.g., from an editorial pitch "Wicker Park"):

```
npx ts-node scripts/generate-content/query-walkable-cluster --center <lat>,<lng> --radius 800 [--category <slug>]
```

Either mode returns `{ query, cluster, route }` where `route.stops[]` is ordered via nearest-neighbor TSP starting from the highest-completeness member. The shape is the exact section payload minus the editorial `note` strings — you fill those in.

### Step 3: Write the post

Build a normal post with a `walkable-route` section in addition to the usual list/prose/FAQ blocks. Minimal shape:

```json
{
  "slug": "wicker-park-bar-crawl",
  "type": "list",
  "status": "published",
  "title": "Wicker Park Bar Crawl: 5 Stops, About a Mile",
  "description": "An editor-picked walking route through Wicker Park — five bars, one loop, all walkable in an afternoon.",
  "city": "chicago-il",
  "category": "categories.bar/drinks",
  "publishedAt": "2026-04-19",
  "updatedAt": "2026-04-19",
  "author": "Therr Editorial",
  "lead": "...",
  "sections": [
    { "type": "prose", "body": "..." },
    {
      "type": "walkable-route",
      "centroid": { "lat": 41.9088, "lng": -87.6796 },
      "totalMeters": 1420,
      "estimatedMinutes": 18,
      "stops": [
        { "order": 1, "spaceId": "<uuid>", "name": "The First Stop", "lat": 41.9101, "lng": -87.6812, "note": "Start here — the patio is the best introduction to the neighborhood." },
        { "order": 2, "spaceId": "<uuid>", "name": "Second Spot", "lat": 41.9085, "lng": -87.6798, "walkFromPreviousMeters": 310, "note": "Duck in for the cocktail list." }
      ]
    },
    { "type": "space-list", "items": [ /* same stops as a ranked list for users who skip the map */ ] },
    { "type": "faq", "items": [ /* 3-5 items */ ] }
  ]
}
```

Validator rules for `walkable-route`:
- `stops.length >= 2`, `order` must be 1-indexed and dense (1..n)
- `lat` / `lng` / `name` required on every stop (denormalized from space — the map and SSR rendering don't async-fetch)
- `walkFromPreviousMeters` required on stops 2..n, omitted on stop 1
- `spaceId` must be unique across stops (no visiting the same bar twice)

### Step 4: Save

```
echo '<post-json>' | npx ts-node scripts/generate-content/save-post --stdin
```

### Editorial tips

- **One walkable section per post.** Multiple routes in one post split the reader's attention.
- **Keep notes concrete.** "Start here — best patio in the cluster" beats "This is a great bar." The route is the hook, but the stop-by-stop color is the content.
- **Pair with a `space-list` section.** The map is great for visual skimmers; the list is better for users who skip maps or are on slow connections.
- **Cross-link to the city's category post.** "For a broader guide to bars in Chicago, see our [bars in Chicago list]." The walkable post is a sub-angle, not a standalone.
- **Don't force mixed-category routes** unless the hook is the mix. "5 coffee shops in Pearl District" reads cleanly; "3 coffee shops, a bar, and a bookstore" needs a strong narrative reason.

## Locale workflow (multilingual guides)

Guides can carry translated content under `locales.es` / `locales.fr-ca`. The SSR layer (`resolveGuideForLocale()`) swaps in the localized `title`, `description`, `lead`, and `sections` when the request comes in at `/es/guides/<slug>` or `/fr-ca/guides/<slug>`. Pick target locales per city based on local-language population density and weak competitor coverage — see `docs/CONTENT_LOCALE_FIRST_PLAN.md` for the target-market table.

### Step 1: generate a translator-ready prompt

```
npx ts-node scripts/generate-content/translate-post --slug <slug> --locale <es|fr-ca>
```

Output is a single prompt string (instructions + source JSON) that you can paste into any translator:

- **Claude / ChatGPT.** Default path. Paste the prompt, get back the `locales.<X>` block, merge it into the post, ship it. The prompt already spells out register, length caps, and the "don't touch identifiers" rule.
- **DeepL / Google Translate.** Fine for gisting; poor at preserving JSON structure — use `--format skeleton` instead and fill in manually.
- **Native speaker / professional translator.** Optional — only reach for this if a specific post matters enough to warrant outside cost (e.g., a flagship city guide). Not gated on by default.

Alternate outputs:
- `--format source-json` — just the source payload, for headless integrations.
- `--format skeleton` — a zeroed-out locale block with ids/rows preserved, for hand-filling.

### Step 2: fold the translated block into the post

The translator returns a JSON object matching `{ title, description, lead, sections }`. Merge it into the post under `locales.<locale>`:

```json
{
  "slug": "editors-picks-bars-chicago",
  "title": "...",
  "description": "...",
  "lead": "...",
  "sections": [ /* English */ ],
  "locales": {
    "es": { "title": "...", "description": "...", "lead": "...", "sections": [ /* parallel to sections */ ] }
  }
}
```

The validator enforces parallel structure: `locales.<X>.sections` must have the same length and the same `type` in the same order as the default-locale `sections`. This keeps the renderer safe — section shapes and identifiers (spaceId, rank, href, numeric rows) are not translated.

### Step 3: save with a required-locales gate

When publishing a city where we've committed to a second locale (e.g., Chicago → `es`), require the translation upfront:

```
cat draft.json | npx ts-node scripts/generate-content/save-post --stdin --require-locales es
```

`--require-locales <a,b,...>` fails validation if any listed locale is missing from the `locales` block. Use this to prevent en-us-only posts from shipping in cities where the locale plan says otherwise.

### Locale-selection rules of thumb

| Locale | Publish with guide when city is… | Skip when city is… |
|--------|----------------------------------|--------------------|
| `es` | Chicago, Houston, Atlanta, Phoenix, Charlotte | Miami, LA, San Antonio (Yelp es coverage) |
| `fr-ca` | Boston, NYC, Burlington VT, Plattsburgh NY | Montreal, Quebec City, Gatineau |

For cities where we'd publish **only** in `es` or `fr-ca` (e.g., Mexico City, Montreal), skip the en-us doorway page entirely and emit the localized URL as `x-default`. Current slug routing uses one slug across all locales; localized slugs (e.g., `mejores-bares-chicago`) are an open question — see plan doc.

### LLM-assisted translation (in-process, future)

`translate-post.ts` currently emits a translator prompt only. A future enhancement can wire the Anthropic SDK in directly so the script returns the translated block rather than a prompt — flag it as `--mode llm`. Until that ships, the assistant running this skill produces the translation by reading the emitted prompt, drafting the JSON, and piping it to `save-post --require-locales <X>`.

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

## Roadmap

Planned expansions to this content system are tracked in `docs/`. Read the umbrella first when scoping any non-trivial change to the editorial pipeline:

- `docs/CONTENT_GUIDES_ROADMAP.md` — index + sequencing rationale
- `docs/CONTENT_LOCALE_FIRST_PLAN.md` (P1) — make every guide trilingual (en-us / es / fr-ca) before scaling
- `docs/CONTENT_HASHTAG_GUIDES_PLAN.md` (P2) — hashtag-anchored guides as alternative to category posts
- `docs/CONTENT_WALKABLE_CLUSTERS_PLAN.md` (P2) — geo-clustered "walkable route" sections
- `docs/CONTENT_MOMENT_DRIVEN_PLAN.md` (P2) — pull user-generated moments into guides (privacy/consent gated)

When implementing any of these, the relevant schema/script files contain `TODO:` comments pointing back at the plan doc — start there.

## Reference

- Schema: `scripts/generate-content/utils/contentSchema.ts`
- Query (rank by engagement OR completeness with auto-fallback): `scripts/generate-content/query-top-spaces.ts`
- Activity stats (data posts): `scripts/generate-content/query-activity-stats.ts`
- Save/validate post: `scripts/generate-content/save-post.ts` (supports `--require-locales <es,fr-ca>`)
- Refresh existing post: `scripts/generate-content/refresh-post.ts`
- Translate post: `scripts/generate-content/translate-post.ts` (emits a translator prompt for a given locale)
- Discovery helpers: `scripts/generate-content/discover-categories.ts`, `scripts/generate-content/discover-hashtags.ts`, `scripts/generate-content/discover-clusters.ts`
- Query by hashtag: `scripts/generate-content/query-by-hashtag.ts`
- Query walkable cluster (route-ordered): `scripts/generate-content/query-walkable-cluster.ts`
- Geo utilities (haversine, clustering, TSP ordering): `scripts/generate-content/utils/geo.ts`
- Diagnostics (ad-hoc): `scripts/generate-content/diagnostics/discover-impressions.ts`, `diagnostics/discover-metrics.ts`
- Frontend renderer: `therr-client-web/src/routes/Guide/index.tsx`
- JSON-LD builder: `therr-client-web/src/utilities/guideJsonLd.ts`
- Sitemap entry: `/sitemap-guides.xml` (regenerated hourly)
- Featured-in backlink: `therr-client-web/src/routes/ViewSpace.tsx` (auto-discovered from any post that lists the spaceId)
