# Walkable-Cluster Guides Plan

**Priority:** P2
**Status:** Planned
**Owner:** Editorial / SEO

## Goal

Generate guides that compute a **walkable cluster** of 4–6 spaces within a small geographic radius and present them as a *route*, not a list. Output includes a map embed and an ordered "stop 1 → stop 2 → ..." narrative.

## Why this is defensible

- Yelp, Google Maps, and TripAdvisor display pins on a map but never compose them as a narrative crawl.
- Lat/long is already on every space (`spaces.latitude`, `spaces.longitude`), and density in core neighborhoods is high enough to find natural clusters.
- "[neighborhood] bar crawl", "things to do in [neighborhood] one afternoon", "[neighborhood] walking tour" are evergreen queries with strong intent and low competition for opinionated narrative content.
- Naturally cross-promotes Therr's mobile app — a route guide on the web is *better* in the mobile app where the map is interactive.

## Phases

### Phase 1 — clustering algorithm (1 day)

- [x] `scripts/generate-content/utils/geo.ts`: `haversineMeters`, `walkingMinutes`, `centroidOf`, `diameterMeters`, `clusterByRadius`, `orderAsWalkingRoute`. Pure functions, no DB. ✓
- [x] Defaults: 4–8 spaces, ≤1500m diameter. Greedy agglomerative-ish (seed by weight desc, grow by nearest neighbor under the diameter constraint). `orderAsWalkingRoute` uses nearest-neighbor TSP starting from the highest-weight member. ✓

### Phase 2 — cluster discovery script (0.5 day)

- [x] `scripts/generate-content/discover-clusters.ts` — pulls public spaces per (city, [optional category]), runs `clusterByRadius`, ranks by completeness-weighted density (sum of member completeness / πr²; 100m radius floor). ✓
- [x] Output includes centroid, diameter, walkingMinutes estimate, categories, and member rows with address + completeness fields. ✓

### Phase 3 — query + ordering (1 day)

- [x] `scripts/generate-content/query-walkable-cluster.ts` — two entry modes: `--spaceIds <csv>` (direct from discover-clusters output) or `--center lat,lng --radius <m>` (centerpoint query with re-clustering). Orders via `orderAsWalkingRoute`. ✓
- [x] Output shape matches the `walkable-route` section payload minus editorial `note`s: `{ query, cluster, route: { totalMeters, estimatedMinutes, stops[] } }`. ✓

### Phase 4 — schema + new section type (0.5 day)

- [x] `walkable-route` section added to `utils/contentSchema.ts` with a full runtime validator (stops 1-indexed and dense, `lat`/`lng`/`name` required per stop, `walkFromPreviousMeters` required on 2..n only, `spaceId` unique). ✓
- [x] Mirrored in `therr-client-web/src/utilities/guideContent.ts`. ✓
- [x] `lat`/`lng`/`name` are denormalized onto each stop so the SSR map and popup render without a space lookup. ✓

### Phase 5 — frontend rendering (1 day)

- [x] `therr-client-web/src/routes/Guide/sections/WalkableRoute.tsx` — Mantine-styled stop cards with "Stop N" badges, inter-stop walking-distance text, total+minutes badges, and an embedded `SpacesMap` (existing Leaflet integration). ✓
- [x] Registered in `Guide/index.tsx` `renderSection` switch. ✓
- [x] `TouristTrip` JSON-LD added to `guideJsonLd.ts`: `itinerary` list of `TouristAttraction`s with `GeoCoordinates`, emitted via `/views/guides.hbs` when present. ✓

### Phase 6 — pilot 2 cluster posts (1 day)

Pick 2 dense, walkable neighborhoods. Suggested:

| City | Neighborhood | Theme |
|------|--------------|-------|
| Chicago | Wicker Park | "Wicker Park bar crawl: 5 stops, 1 mile" |
| Portland | Pearl District | "An afternoon in the Pearl: 6 stops, walking" |

## Success criteria

- Walkable-route section renders as both a list and a static map on first SSR load (no client-side map required for SEO).
- `TouristTrip` JSON-LD validates in Google's Rich Results Test.
- Pilot posts capture impressions on long-tail like "wicker park bar crawl" within 60 days.

## Open questions

- Static map vs. interactive: SEO needs the static fallback, but mobile app users want the interactive version. Two render paths or one?
- Walking time estimate: rough heuristic (80 m/min) vs. Google Distance Matrix API call (more accurate but adds runtime cost + key dependency). Recommendation: ship with heuristic; add API enhancement only if user feedback demands it.
- Should the route be a closed loop (return to start) or one-way? Probably one-way with a clear "endpoint near transit" callout.
- How do we handle clusters that span multiple categories (a coffee shop, a bar, a bookstore)? Are mixed clusters a feature or a bug?

## Files this plan touches

- `scripts/generate-content/utils/geo.ts` (new)
- `scripts/generate-content/discover-clusters.ts` (new)
- `scripts/generate-content/query-walkable-cluster.ts` (new)
- `scripts/generate-content/utils/contentSchema.ts` (`walkable-route` section)
- `therr-client-web/src/utilities/guideContent.ts` (mirror schema)
- `therr-client-web/src/routes/Guide/sections/WalkableRoute.tsx` (new)
- `therr-client-web/src/utilities/guideJsonLd.ts` (`TouristTrip` schema)
- `.claude/skills/generate-content/SKILL.md` (Mode 6: Walkable-cluster post)
