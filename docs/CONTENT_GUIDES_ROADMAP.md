# Editorial Guides — Content Roadmap

This roadmap covers the next four planned expansions of the `/guides` editorial system. Three pilot guides are live (curated mode; see `therr-client-web/src/content/guides/`). The angles below are designed for content competitors (Yelp, Google Maps, TripAdvisor) cannot easily replicate, given Therr's data and platform shape.

| Priority | Plan | Why it's defensible | Effort |
|----------|------|---------------------|--------|
| **P1** | [Locale-first guides](./CONTENT_LOCALE_FIRST_PLAN.md) | `/es/` and `/fr-ca/` infra is built but unused at scale. Yelp/Google have thin multilingual long-tail outside obvious markets. Lowest-cost rank wins. | 2–3 days |
| P2 | [Hashtag-anchored guides](./CONTENT_HASHTAG_GUIDES_PLAN.md) | Groups spaces by *user-applied intent* (#firstdate, #latenight) rather than category. Categories are commodity; intent is not. | 3–5 days |
| P2 | [Walkable-cluster guides](./CONTENT_WALKABLE_CLUSTERS_PLAN.md) | Computes a route through 4–6 close spaces. Directories show pins on a map but never write the route as content. Strong evergreen value. | 5–7 days |
| P2 | [Moment-driven freshness posts](./CONTENT_MOMENT_DRIVEN_PLAN.md) | Quotes recent user-generated `moments` at featured spaces. First-party UGC nobody else has + the freshness signal lifts SERP. | 4–6 days |

## Sequencing rationale

P1 first because:
- The `locales` block already exists in `IPost` schema.
- The `/es/` and `/fr-ca/` URL routing is already shipped.
- Cost is mostly translation + a few wiring tasks; no new section types or new query patterns.
- Fastest signal on whether multilingual SEO works for us before investing in deeper structural changes.

P2 plans are listed in suggested order of implementation difficulty (hashtag is closest to the existing pattern; moment-driven needs new privacy considerations; walkable requires geospatial logic + new UI section). All three can be parallelized across sessions if needed.

## What's deliberately not on this list

- **Brand-niche themed guides (TEEM, HABITS angles)** — useful, but blocked on each niche app's own product strategy. Revisit once those have measurable usage.
- **AI-generated photos / hero images** — wait for at least one P2 plan to ship; we'll have a clearer sense of which posts deserve hero treatment.
- **Comparison/versus posts** ("Capitol Hill vs. Belltown") — derivative; we'd be playing on competitors' field. Skip until our own first-party angles plateau.

## Cross-cutting infrastructure (shared across plans)

- `scripts/generate-content/refresh-post.ts` already supports `--apply` and `--add-new`; reuse for any plan's enrichment workflow.
- The `mode` discipline from `query-top-spaces.ts` (auto-fallback to curated when data is thin) should carry through into every new query script. **Never claim popularity/ranking when the signal isn't there.**
- The validator in `utils/contentSchema.ts` is the gate. Any new section type or field must be added there first or `save-post` will reject it.
