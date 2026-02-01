# Claude Code Instructions - Push Notifications Service

## Service Overview

- **Port**: 7775
- **Database**: None (uses Redis for caching)
- **Purpose**: Firebase Cloud Messaging delivery, location processing

## Key Domains

- **Notifications**: Send push notifications via FCM
- **Location Processing**: Process user location updates for proximity alerts

## Directory Structure

```
src/
├── handlers/
│   ├── notifications.ts        # Push notification logic
│   └── locationProcessing.ts   # Location-based triggers
├── routes/
│   ├── notificationsRouter.ts
│   └── locationProcessingRouter.ts
├── api/
│   └── firebaseAdmin.ts        # FCM configuration per brand
├── store/
│   ├── UserLocationCache.ts    # Redis location caching
│   └── redisClient.ts
└── handlers/helpers/
    ├── areaLocationHelpers.ts  # Geofencing logic
    └── userLocations.ts        # Location tracking
```

## Key Patterns

### Firebase Admin Setup
- `src/api/firebaseAdmin.ts` - initializes FCM per brand variation
- Separate Firebase projects per niche app (Therr, Teem, etc.)
- Uses service account credentials from environment

### Location Caching
- User locations cached in Redis with TTL
- Geo-indexed for proximity queries
- 20-minute default expiration

### Notification Types
Uses `PushNotifications` enum from therr-js-utilities:
- DISCOVERED_UNIQUE_MOMENT
- ACHIEVEMENT_COMPLETED
- CONNECTION_REQUEST_RECEIVED
- etc.

## Brand Variation Support

The `firebaseAdmin.ts` handles multiple app brands:
- Different FCM credentials per brand
- Brand-specific notification content

## Related Services

- Called by: api-gateway, other services needing push delivery
- Calls: users-service (for user device tokens)

## Code Quality

Before completing code changes, run linting and fix all errors:

```bash
npx eslint src/**/*.ts --fix   # Auto-fix issues
npx eslint src/**/*.ts         # Verify no errors remain
```

See root `CLAUDE.md` for full code quality requirements.
