# Claude Code Instructions - Maps Service

> ⚠️ **Shared code — only edit from the `general` branch. Niche branches cannot deploy.**
> Changes under `therr-services/` committed to a `niche/*` branch will never reach production. See root `CLAUDE.md` → "Deployment reality".

## Service Overview

- **Port**: 7773
- **Database**: `therr_dev_maps`
- **Purpose**: Location-based content - moments, spaces, events, activities
- **Requires**: PostGIS extension for geospatial queries

## Key Domains

- **Moments**: User-created location-tagged posts (temporary content)
- **Spaces**: Business/location pages (persistent)
- **Events**: Time-bound location events
- **Activities**: User activity tracking
- **Space Metrics**: Analytics for spaces

## Directory Structure

```
src/
├── handlers/       # Business logic (moments, spaces, events, activities)
├── routes/         # Express routers
├── store/          # Data access with PostGIS queries
│   ├── MomentsStore.ts
│   ├── SpacesStore.ts
│   ├── EventsStore.ts
│   └── SpaceMetricsStore.ts
├── api/            # External service calls
└── utilities/      # Geo utilities, content safety
```

## Key Patterns

### Geospatial Queries
Uses PostGIS for location-based queries:
- ST_DWithin for proximity searches
- ST_Distance for distance calculations
- Geography type for lat/lng coordinates

### Content Types
Three main content types with similar patterns:
- `moments` - ephemeral user posts
- `spaces` - persistent business/location pages
- `events` - time-bound happenings

### Spaces: ownership and claims (gotchas that have shipped as bugs)
- Every proximity query reads `spaces."geomCenter"` (POINT), not `geom` (POLYGON). Any code
  path that inserts a space must write both — a row with a NULL `geomCenter` is invisible to
  search with no error anywhere.
- `SpacesStore.updateSpace` scopes its WHERE to `{ id, fromUserId }` as the ownership check
  and rejects when `params.fromUserId` is missing. Pass the row's *current* owner (which is
  `SUPER_ADMIN_ID` for unclaimed inventory), not the requesting user.
- The admin queue holds two different things, and approval means something different for
  each. A **space request** (`POST /spaces/request-claim`, `isClaimPending = true`) is a
  consumer's "Request a Space" suggestion (owner = `SUPER_ADMIN_ID`) or a business creating
  its own space from the dashboard (owner = requester); approval *publishes* it — a
  consumer's request is released to unclaimed inventory (`requestedByUserId` cleared), a
  business keeps its own. A **claim on an existing space** (`POST /spaces/request-claim/
  :spaceId`, only `requestedByUserId` set so the listing stays on the map) *transfers
  ownership* on approval. `SpacesStore.approveClaim` decides by shape; the dashboard lists
  them separately. This feature has broken repeatedly by conflating the two.
- "Awaiting approval" is `isClaimPending OR (requestedByUserId IS NOT NULL AND fromUserId <>
  requestedByUserId)` — `requestedByUserId` alone is not enough.
- Ownership moves only in `SpacesStore.approveClaim`, never through `updateSpace`. Only spaces
  owned by `SUPER_ADMIN_ID` may be claimed (`claimSpace` enforces this), because approval of
  a claim reassigns `fromUserId`.

### Media Handling
- `createMediaUrls.ts` - generates signed URLs for media uploads
- Uses AWS S3/Google Cloud Storage via `src/api/aws.ts`

## Database Tables (main schema)

Key tables: `moments`, `spaces`, `events`, `media`, `spaceMetrics`, `spaceIncentives`

All location tables use PostGIS geography columns for coordinates.

## Related Services

- Called by: api-gateway
- Calls: users-service (for user data), reactions-service (for engagement data)

## Code Quality

Before completing code changes, run linting and fix all errors:

```bash
npx eslint src/**/*.ts --fix   # Auto-fix issues
npx eslint src/**/*.ts         # Verify no errors remain
```

See root `CLAUDE.md` for full code quality requirements.
