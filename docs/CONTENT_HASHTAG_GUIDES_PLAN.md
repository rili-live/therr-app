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

- [ ] Build `scripts/generate-content/discover-hashtags.ts` — inspects the distribution of `spaces.hashTags` values, splits comma-separated tags, counts occurrences per (city, hashtag), and lists pairs meeting a minimum threshold (e.g., ≥8 spaces with the tag in one city).
- [ ] Output should rank by the same density rules as `discover-categories` so we can pick targets quickly.
- [ ] Look for high-intent verbs/contexts: `firstdate`, `latenight`, `worksession`, `livemusic`, `outdoorseating`, `dogfriendly`, `kidfriendly`, `groupfriendly`, `roomforevent`.

### Phase 2 — query script (0.5 day)

- [ ] Build `scripts/generate-content/query-by-hashtag.ts` mirroring the structure of `query-top-spaces.ts` but accepting `--hashtag <tag>` instead of `--category <slug>`.
- [ ] Reuse the auto-fallback discipline: `mode: engagement` only when there's enough visit data to support a ranking; otherwise `curated` by completeness.
- [ ] WHERE clause: `s."hashTags" ILIKE '%' || $1 || '%'` (case-insensitive substring match, since hashTags is a comma-separated string field — verify before trusting). May need a more careful regex to avoid `#firstdate` matching `#firstdateandlast` etc.

### Phase 3 — schema update (0.5 day)

- [ ] Add an optional `hashtag?: string` field to `IPostMetadata` (alongside `city` and `category`). The validator should require *one of* `category` or `hashtag` — not both, not neither. Update `validatePost` in `utils/contentSchema.ts`.
- [ ] Mirror the field into `therr-client-web/src/utilities/guideContent.ts` (`IPostMetadata`).
- [ ] Decide on URL path: do we keep `/guides/<slug>` flat, or prefix `/guides/by-hashtag/<slug>`? Current recommendation: keep flat — the hashtag is metadata, not a path segment.

### Phase 4 — JSON-LD + breadcrumb tweaks (0.25 day)

- [ ] In `therr-client-web/src/utilities/guideJsonLd.ts`, add a hashtag-flavored breadcrumb when `post.hashtag` is present (e.g., Home → Guides → "First Date" → post). Skip the city crumb if no city is set.
- [ ] Article schema's `keywords` field should include the hashtag (without the `#`).

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
