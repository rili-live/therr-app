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

- [ ] Build `scripts/generate-content/utils/geo.ts` with:
  - `haversineMeters(a, b)` — distance between two lat/long points
  - `clusterByRadius(spaces, maxDiameterMeters)` — DBSCAN-flavored grouping; returns clusters of `{ spaces, centroid, diameterMeters }`
  - `walkingMinutes(meters)` — rough estimate at 80 m/min
- [ ] Default cluster constraints: 4–8 spaces, ≤1500m diameter (~12-min walk total).

### Phase 2 — cluster discovery script (0.5 day)

- [ ] Build `scripts/generate-content/discover-clusters.ts` that pulls all spaces in a (city, [optional category]) bucket and surfaces the densest clusters. Output ranks clusters by completeness-weighted density (sum of completeness scores / area).
- [ ] Allow filtering by primary category (e.g., "find me 5-bar clusters in Chicago neighborhoods").

### Phase 3 — query + ordering (1 day)

- [ ] Build `scripts/generate-content/query-walkable-cluster.ts` that takes `--city <slug> --neighborhood <name>` (or a centerpoint via `--center lat,lng --radius <m>`), pulls the cluster's spaces, and orders them via a simple TSP heuristic (nearest-neighbor walking-tour order from the densest pin outward).
- [ ] Output includes total walking distance, estimated time, and the ordered space list.

### Phase 4 — schema + new section type (0.5 day)

- [ ] Add a `walkable-route` section type to `utils/contentSchema.ts`:
  ```ts
  { type: 'walkable-route'; centroid: { lat: number; lng: number }; totalMeters: number; estimatedMinutes: number; stops: Array<{ spaceId: string; order: number; walkFromPreviousMeters?: number; note?: string }>; }
  ```
- [ ] Mirror in `therr-client-web/src/utilities/guideContent.ts`.
- [ ] Update `validatePost` to accept the new section type.

### Phase 5 — frontend rendering (1 day)

- [ ] Build `therr-client-web/src/routes/Guide/sections/WalkableRoute.tsx` — renders an ordered list with walking-distance badges between stops, plus an embedded map.
- [ ] Map embed: Mantine doesn't have a map component; integrate the same `react-leaflet` or Mapbox usage already present in `therr-client-web` (verify what's installed) or fall back to an `<img>` of a pre-rendered map for static SSR safety.
- [ ] Add JSON-LD `TouristAttraction` or `TouristTrip` schema in `guideJsonLd.ts` — there is a `TouristTrip` type that fits walking routes specifically.

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
