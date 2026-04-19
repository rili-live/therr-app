# Hashtag-Anchored Guides Plan

**Priority:** P2
**Status:** Planned
**Owner:** Editorial / SEO

## Goal

Generate guides anchored on **user-applied hashtags** (e.g., `#firstdate`, `#latenight`, `#worksession`, `#groupfriendly`) instead of categories. The result targets *intent-based* queries that competitors' category-driven directories cannot serve.

## Why this is defensible

- Yelp, Google, and TripAdvisor group spaces by category (cuisine, price, rating). They do not group by *what you're trying to do tonight*.
- Therr's `spaces.hashTags` field captures user-applied intent that category cannot — a `#firstdate` bar is a different recommendation from a `#sportsbar`, even if both are `categories.bar/drinks`.
- Long-tail queries like "first date bars chicago", "late night food portland", "coffee shops to work seattle" have moderate volume + low SERP competition — perfect editorial-content territory.

## Phases

### Phase 1 — discover viable hashtags (0.5 day)

- [x] Build `scripts/generate-content/discover-hashtags.ts` — inspects the distribution of `spaces.hashTags` values, splits comma-separated tags, counts occurrences per (city, hashtag), and lists pairs meeting a minimum threshold (e.g., ≥8 spaces with the tag in one city). Also supports `--intentOnly` to filter to an intent-shaped allowlist. ✓
- [x] Output is ranked `spaceCount DESC` with sample categories — matches the `discover-categories` shape for quick target picking. ✓
- [ ] Look for high-intent verbs/contexts: `firstdate`, `latenight`, `worksession`, `livemusic`, `outdoorseating`, `dogfriendly`, `kidfriendly`, `groupfriendly`, `roomforevent`. **Caveat discovered during implementation:** `spaces.hashTags` is today populated by the OSM ingester (cuisines, amenity types) — intent-shaped tags are not yet present. Phase 5 pilot selection is blocked on enriching the hashTags data upstream.

### Phase 2 — query script (0.5 day)

- [x] Build `scripts/generate-content/query-by-hashtag.ts` mirroring the structure of `query-top-spaces.ts` but accepting `--hashtag <tag>` instead of `--category <slug>`. ✓
- [x] Reuses the auto-fallback discipline: `mode: engagement` only when visit/impression totals clear `--minVisits` + `--minTopVisits`; otherwise `curated`. ✓
- [x] Matching strategy: `EXISTS (SELECT 1 FROM unnest(string_to_array(s."hashTags", ',')) AS tag WHERE LOWER(TRIM(tag)) = $hashtag)`. Exact, normalized match — does **not** substring-match `firstdate` against `firstdateandlast`. ✓

### Phase 3 — schema update (0.5 day)

- [x] Added optional `hashtag?: string` to `IPostMetadata`. Validator enforces exactly one of `{category, hashtag}` (XOR) and validates hashtag format (lowercase letters/digits/hyphens, no leading `#`). ✓
- [x] Mirrored the field into `therr-client-web/src/utilities/guideContent.ts` and exposed `getGuidesByHashtag(tag)`. ✓
- [x] URL decision: post URL stays flat at `/guides/<slug>`. Added a **hashtag filter listing** at `/guides/hashtag/:hashtag` (sibling to `/guides/city/:citySlug` and `/guides/category/:categorySlug`) so the breadcrumb has a real target. ✓

### Phase 4 — JSON-LD + breadcrumb tweaks (0.25 day)

- [x] `buildBreadcrumb` in `guideJsonLd.ts` now inserts a hashtag crumb (humanized) linking to `/guides/hashtag/<tag>` when `post.hashtag` is present. Breadcrumb positions are computed dynamically so city-only, hashtag-only, or both-present posts all render correctly. ✓
- [x] Article schema's `keywords` field includes the hashtag (without the `#`) when present. ✓
- [x] `/sitemap-guides.xml` now emits a URL for each distinct hashtag across published guides, matching the city/category pattern. ✓

### Phase 5 — pilot 3 hashtag posts (1 day)

Pick 3 (city, hashtag) combos with strong density. Suggested:

| City | Hashtag | Rationale |
|------|---------|-----------|
| Chicago | `firstdate` | High-volume search term; date-night content evergreen |
| Portland | `worksession` | Aligns with PDX work-from-cafe culture |
| New York | `latenight` | NYC + late night = never-stale query |

Use curated mode framing: "Editor's Picks: 8 First-Date Bars in Chicago" etc.

## Success criteria

- `discover-hashtags` script ships and reveals at least 10 (city, hashtag) combos with ≥8 qualifying spaces each.
- 3 pilot posts publish via the hashtag pipeline within 2 weeks of plan kickoff.
- GSC reports impressions on intent-based long-tail (e.g., "first date bars chicago") within 60 days.

## Open questions

- Are hashtags applied by space owners or by users? (Affects trust / bias.) Verify before committing to user-driven tags.
- Should we surface a hashtag-specific facet in the directory itself (`/locations/by-hashtag/firstdate`)? Strong companion play but out of scope here.
- How do we handle hashtag normalization (`firstdate` vs `first-date` vs `first_date`)? Need a canonicalization rule before scaling.

## Files this plan touches

- `scripts/generate-content/discover-hashtags.ts` (new)
- `scripts/generate-content/query-by-hashtag.ts` (new)
- `scripts/generate-content/utils/contentSchema.ts` (add `hashtag?: string`)
- `therr-client-web/src/utilities/guideContent.ts` (mirror schema)
- `therr-client-web/src/utilities/guideJsonLd.ts` (hashtag-flavored breadcrumb)
- `.claude/skills/generate-content/SKILL.md` (Mode 5: Hashtag-anchored post)
