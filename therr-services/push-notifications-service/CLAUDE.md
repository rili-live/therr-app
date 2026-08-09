# Claude Code Instructions - Push Notifications Service

> ⚠️ **Shared code — only edit from the `general` branch. Niche branches cannot deploy.**
> Changes under `therr-services/` committed to a `niche/*` branch will never reach production. See root `CLAUDE.md` → "Deployment reality".

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
- `src/api/firebaseAdmin.ts` initializes one `admin.app` instance per brand,
  cached in `brandAppCache` and looked up per send via `getAdminAppForBrand(brandVariation)`.
- Every brand is an **app inside the single shared `therr-app` Firebase project**
  today, not a project of its own. One service account can address every app in
  its own project, which is why the THERR fallback below is correct rather than a
  degradation. Do not split a brand into its own project to fix undelivered
  pushes — see `docs/PUSH_NOTIFICATIONS_DEBUGGING.md`. Credentials are
  base64-encoded service account JSON supplied in environment variables:
  - `PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64` — THERR (required at startup;
    also the fallback for any brand whose own env var is not set).
  - `PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_TEEM` — TEEM (optional).
  - `PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_HABITS` — HABITS (optional).
  - Pattern for new brands: `PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_<BRAND_UPPER>`.
- Brands without a configured env var log a one-time warning at first send and
  fall back to the THERR default app. This is compatible with deployments that
  have not yet provisioned per-brand Firebase projects.
- THERR credentials are validated at module load (project_id / client_email /
  private_key); a missing or malformed THERR JSON fails the service at startup.

### Debugging delivery

`src/handlers/diagnostics.ts` exposes two SUPER_ADMIN endpoints (routed through
the gateway, and **available in production**, unlike `/notifications/test` which
is compiled out there):

- `GET /notifications/diagnostics` — per-brand Firebase project, credential env
  key, fallback status, and the `apns-topic` each brand's iOS pushes carry.
- `POST /notifications/diagnostics/send-test` — builds the real envelope for a
  type and sends it, returning the **raw** FCM result. `dryRun` defaults to true.

They exist because `predictAndSendNotification` swallows every FCM error by
design, and because APNS drops a push whose `apns-topic` isn't the receiving
app's bundle id without reporting anything — so "Push successfully sent" in the
logs is compatible with the user receiving nothing.

A brand's `apns-topic` must be a bundle id some iOS target actually builds. Niche
branches don't change `PRODUCT_BUNDLE_IDENTIFIER`, so a brand with no iOS target
of its own runs as the Therr binary and must use Therr's bundle id.
`brandRouting.test.ts` reads the Xcode project and enforces this.

Full runbook: `docs/PUSH_NOTIFICATIONS_DEBUGGING.md`. Driver script:
`./_bin/push-debug.sh`.

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
