# Claude Code Instructions - Maps Service

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

### Media Handling
- `createMediaUrls.ts` - generates signed URLs for media uploads
- Uses AWS S3/Google Cloud Storage via `src/api/aws.ts`

## Database Tables (main schema)

Key tables: `moments`, `spaces`, `events`, `media`, `spaceMetrics`, `spaceIncentives`

All location tables use PostGIS geography columns for coordinates.

## Related Services

- Called by: api-gateway
- Calls: users-service (for user data), reactions-service (for engagement data)
