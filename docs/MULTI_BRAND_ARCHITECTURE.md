# Multi-Brand Architecture

This document explains how the Therr platform supports multiple branded app variants (niche apps) that share the same backend infrastructure while maintaining distinct user experiences.

## Overview

The Therr platform uses a **brand variation system** that allows multiple mobile apps to connect to the same backend services. Each app variant can:
- Share user authentication (same email/password works across all apps)
- Share the same database infrastructure
- Have brand-specific UI, features, and content
- Receive brand-appropriate push notifications

## Brand Variations

Brand variations are defined in the shared enum:

```typescript
// therr-public-library/therr-js-utilities/src/constants/enums/Branding.ts
export enum BrandVariations {
    THERR = 'therr',           // Core social/location app
    TEEM = 'teem',             // Team collaboration variant
    HABITS = 'habits',         // Accountability habit tracker
    // Add new variants here
}
```

## How Brand Variation Flows Through the System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Mobile App                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  brandConfig.ts: CURRENT_BRAND_VARIATION = BrandVariations.X    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                  │                                       │
│                                  ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  interceptors.ts: axios.defaults.headers['x-brand-variation']   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ HTTP Request with header:
                                   │ x-brand-variation: 'habits'
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API Gateway (port 7770)                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  handleServiceRequest.ts: Extracts and forwards header          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ Header forwarded to all services
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Backend Services                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │users-service │  │ maps-service │  │push-notif-svc│                  │
│  │              │  │              │  │              │                  │
│  │ parseHeaders │  │ parseHeaders │  │ Brand-aware  │                  │
│  │ Brand logic  │  │ Brand logic  │  │ Firebase app │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Integration Points

| Component | File | Purpose |
|-----------|------|---------|
| Mobile Config | `TherrMobile/main/config/brandConfig.ts` | Sets current brand |
| Mobile Interceptor | `TherrMobile/main/interceptors.ts` | Adds header to requests |
| Gateway | `therr-api-gateway/src/middleware/handleServiceRequest.ts` | Forwards header |
| Header Parser | `therr-js-utilities/src/http/parse-headers.ts` | Extracts brand from headers |
| Inter-service | `therr-js-utilities/src/internal-rest-request.ts` | Preserves header across services |

## Branch Strategy for Multi-Brand Development

| Branch | Purpose | What Goes Here |
|--------|---------|----------------|
| `general` | Shared code for ALL apps | Backend services, shared libraries, reusable mobile components |
| `niche/<TAG>-general` | App-specific code | Brand config, navigation guards, hidden features, assets |
| `stage` | CI build phase | Merged from `general` |
| `main` | Production deploy | Merged from `stage` |

### Decision Tree: Which Branch?

```
Is this change...

├── Backend code (services, APIs, database)?
│   └── → general branch (always)
│
├── Shared library code (therr-js-utilities, therr-react)?
│   └── → general branch (always)
│
├── Mobile component that could be used by multiple brands?
│   └── → general branch
│
├── Mobile navigation/routing that differs per brand?
│   └── → niche/<TAG>-general branch
│
├── Brand-specific assets (icons, splash screens)?
│   └── → niche/<TAG>-general branch
│
├── Feature that should be hidden for certain brands?
│   └── → general branch (with conditional rendering)
│
└── Bug fix or security patch?
    └── → general branch (inherits to all niche branches)
```

## Brand-Conditional Code Patterns

### Backend: Service Layer

Use the brand variation header for conditional logic:

```typescript
// In a handler
import { parseHeaders } from 'therr-js-utilities/http';
import { BrandVariations } from 'therr-js-utilities/constants';

const myHandler = (req, res) => {
    const { brandVariation } = parseHeaders(req.headers);

    if (brandVariation === BrandVariations.HABITS) {
        // HABITS-specific logic
        return handleHabitsRequest(req, res);
    }

    // Default behavior for other brands
    return handleDefaultRequest(req, res);
};
```

### Backend: Email Templates

Use `getHostContext()` for brand-specific email configuration:

```typescript
// therr-services/users-service/src/constants/hostContext.ts
const contextConfig = getHostContext(host, brandVariation);

// Returns brand-specific:
// - brandName, brandGreeting
// - emailTemplates (colors, logos)
// - contactEmail, social handles
// - parentHomepageUrl
```

### Mobile: Component Level

Use conditional rendering based on brand config:

```typescript
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';
import { BrandVariations } from 'therr-js-utilities/constants';

const MyComponent = () => {
    // Show component only for specific brand
    if (CURRENT_BRAND_VARIATION === BrandVariations.HABITS) {
        return <HabitsFeature />;
    }

    return null;
};
```

### Mobile: Feature Flags via Brand

```typescript
// Define feature availability per brand
const BRAND_FEATURES = {
    [BrandVariations.THERR]: {
        showLocation: true,
        showBusinessAccount: true,
        showTherrCoin: true,
        showHabits: false,
    },
    [BrandVariations.HABITS]: {
        showLocation: false,
        showBusinessAccount: false,
        showTherrCoin: false,
        showHabits: true,
    },
};

// Usage
const features = BRAND_FEATURES[CURRENT_BRAND_VARIATION];
if (features.showLocation) {
    // Render location components
}
```

### Mobile: Navigation Guards

For brand-specific onboarding flows:

```typescript
// HABITS requires a pact before accessing main app
const NavigationGuard = ({ children }) => {
    if (CURRENT_BRAND_VARIATION === BrandVariations.HABITS) {
        const hasPacts = useSelector(state => state.pacts.active.length > 0);
        if (!hasPacts) {
            return <CreateFirstPactScreen />;
        }
    }
    return children;
};
```

## Firebase: single project, multiple Android apps (current approach)

For MVP, niche apps share the Therr Friend Firebase project and register as additional Android apps under it:

- **Therr** — `applicationId = app.therrmobile`
- **Friends with Habits** — `applicationId = com.therr.habits`
- *(future niches add their own `applicationId`)*

Registering each `applicationId` in Firebase Console adds a `client` entry to a single merged `google-services.json`. That file lives at `TherrMobile/android/app/google-services.json` and serves every brand — Gradle picks the correct client block at build time based on the `applicationId` in `build.gradle`. The Android `namespace` stays `app.therrmobile` across brands so Kotlin source paths don't change.

When to split into separate Firebase projects instead:
- A brand needs isolated Cloud Messaging quotas or Analytics streams.
- Crashlytics dashboards must not cross brand boundaries.
- An acquirer, partner, or legal requirement forces separation.

Until one of those applies, stay on the shared-project model — it removes the need for per-brand service-account key management in `push-notifications-service` and simplifies the `switch-brand.sh` workflow.

## Push Notifications by Brand

Each brand can have its own Firebase project for push notifications:

```typescript
// therr-services/push-notifications-service/src/api/firebaseAdmin.ts

const getAppBundleIdentifier = (brandVariation: BrandVariations) => {
    switch (brandVariation) {
        case BrandVariations.THERR:
            return 'com.therr.mobile.Therr';
        case BrandVariations.HABITS:
            return 'com.therr.mobile.Habits';
        default:
            return 'com.therr.mobile.Therr';
    }
};
```

Environment variables for Firebase credentials:
```bash
PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_THERR=<base64>
PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_HABITS=<base64>
```

## Firebase Project Strategy (Mobile Client)

The mobile-client side of Firebase is structured differently from the
backend push-notification service. Read this section before introducing a
new brand or attempting to split projects.

### Current state (as of 2026-04)

**Single shared Firebase project (`therr-app`) for all brand variants on the
mobile client.** The Android client uses one merged `google-services.json`
at `TherrMobile/android/app/google-services.json` containing one `client[]`
entry per registered `applicationId`. Gradle's
`com.google.gms.google-services` plugin selects the matching client block at
build time based on the build's `applicationId` (e.g., `com.therr.habits`
selects the HABITS client block).

The Android `namespace` stays `app.therrmobile` across all brands so Kotlin
source paths don't change. Only the `applicationId` (defined in
`TherrMobile/android/app/build.gradle`) varies per brand.

**Asymmetry to be aware of:**
- Mobile client: ONE Firebase project, all brands share it
- Backend `push-notifications-service`: supports per-brand service-account
  credentials via env vars (see "Push Notifications by Brand" above)

If a per-brand `PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_<BRAND>` env
var is configured to point at a *different* Firebase project from the one
the mobile client registered against, FCM token routing will silently
break — tokens are scoped to the project they were issued by, and a server
authenticating as a different project cannot send to them.

**Today both sides resolve to `therr-app`,** so this is consistent. If you
introduce a brand-specific Firebase service account on the backend, you
must also split the mobile client to register against the matching project,
or pushes for that brand will fail to deliver.

### Implications for analytics, crash reporting, and FCM

Because all brands share the `therr-app` Firebase project on the mobile
client:
- **Crashlytics** issues from all brands appear in one dashboard, filtered
  by `applicationId`. To isolate per-brand issue counts you must filter by
  app in the Firebase Console.
- **Analytics** events from all brands flow into one property. Build a
  custom dimension on `app_id` (or use the auto-populated app filter) for
  per-brand metrics. There is no per-brand Audiences isolation.
- **FCM tokens** are issued by `therr-app`. The push service authenticates
  as `therr-app` (default `PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64`)
  and sends to all brands' tokens through one credential.

This is **fine for MVP** but becomes painful once any brand needs:
- Independent ownership / access control (a partner team running TEEM
  shouldn't see Therr's user crashes)
- Per-brand budget tracking (Firebase billing rolls up to project, not app)
- Per-brand A/B test surface (Firebase Remote Config / In-App Messaging
  audiences are project-scoped)

### Risks of the current single-project model

1. **Bus factor.** The active `google-services.json` is gitignored and
   reconstructable only by re-exporting from Firebase Console for every
   registered app and merging the `client[]` arrays manually. See
   `docs/SECRETS_AND_LOCAL_BOOTSTRAP.md` for the recovery procedure.

2. **Cross-brand contamination.** A noisy crash in Therr clutters HABITS'
   Crashlytics dashboard and vice versa. Alert rules on issue count get
   noisier as brand count grows.

3. **No template-in-repo by default.** A new developer cloning the repo
   cannot build until they obtain the file out-of-band. Mitigated by
   `TherrMobile/android/app/google-services.example.json` (sanitized
   template) — keep the example file's `package_name` list current as new
   brands are added.

4. **iOS does not support the merged-file pattern.** Each `BUNDLE_ID`
   requires its own `GoogleService-Info.plist`. Today only the Therr
   variant is configured for iOS. When HABITS iOS ships, the build
   pipeline will need either Xcode build phase scheme switching or a
   `_bin/switch-brand.sh` extension that copies the correct plist into
   place.

### Migration path: when to split into per-brand Firebase projects

Triggers that warrant splitting:
- A brand variant reaches its first 1k+ MAU and analytics signal noise
  becomes a real obstacle to product decisions
- A brand variant gets its first paying customer (premium tier) — payments
  + per-brand revenue analytics become important
- A non-founder team takes ownership of a brand variant and needs IAM
  isolation
- An incident requires rotating a Firebase API key for one brand without
  affecting others

Migration playbook (when a trigger fires):

1. Create a new Firebase project for the brand (e.g., `therr-habits`)
2. Register the brand's Android `applicationId` and iOS `BUNDLE_ID` in the
   new project; collect SHA-1 fingerprints from existing keystores and
   register them
3. Extract the brand's `client[]` entry from the merged
   `google-services.json` and replace it with the new project's exported
   block; place the new file at `TherrMobile/android/app/src/<brand>/google-services.json`
4. Convert `TherrMobile/android/app/build.gradle` to use Gradle product
   flavors so the per-flavor `google-services.json` is selected
   automatically; update `_bin/switch-brand.sh` to no longer copy the
   merged file (it'll select via flavor)
5. Add a new `PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_<BRAND>` env var
   to the backend push service, populated with a service-account export
   from the new project
6. **Plan for FCM token re-registration.** Existing users of that brand
   have tokens scoped to `therr-app` and will not receive pushes from the
   new project until the next app launch refreshes their token against
   the new project. Communicate this in a release-notes line, or stagger
   the rollout (mobile release first; backend env-var swap a week later
   once token refresh is statistically complete).
7. Update `docs/SECRETS_AND_LOCAL_BOOTSTRAP.md` with the new project's
   recovery procedure.
8. Update `TherrMobile/android/app/google-services.example.json` to remove
   the brand's client entry (it's no longer in the merged file).

This work is meaningful (~1 week) and risky (FCM token transition window).
Do not undertake it speculatively — wait for an actual trigger.

## WebSocket Brand Context

Brand variation is passed via Socket.IO handshake:

```typescript
// Mobile: socket-io-middleware.ts
const socket = io(SOCKET_URL, {
    query: {
        brandVariation: CURRENT_BRAND_VARIATION,
    },
});

// Backend: websocket-service/src/index.ts
const brandVariation = socket.handshake.query.brandVariation || BrandVariations.THERR;
```

## Adding a New Brand Variation

### Step 1: Add to Enum

```typescript
// therr-public-library/therr-js-utilities/src/constants/enums/Branding.ts
export enum BrandVariations {
    // ... existing
    NEW_BRAND = 'new-brand',
}
```

### Step 2: Add Host Context (for emails)

```typescript
// therr-services/users-service/src/constants/hostContext.ts
const hostContext = {
    // ... existing
    'new-brand.app': {
        brandName: 'New Brand',
        brandGreeting: 'Hey there',
        // ... email config
    },
};
```

### Step 3: Add Firebase Config (for push)

1. Create Firebase project for new brand
2. Add iOS/Android apps to project
3. Export service account JSON
4. Base64 encode and add to environment:
   ```bash
   PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_NEW_BRAND=<base64>
   ```
5. Update `firebaseAdmin.ts` switch statements

### Step 4: Create Niche Branch

```bash
git checkout general
git checkout -b niche/NEW_BRAND-general
```

### Step 5: Configure Mobile Brand

```typescript
// TherrMobile/main/config/brandConfig.ts
export const CURRENT_BRAND_VARIATION = BrandVariations.NEW_BRAND;
```

### Step 6: Add Brand Assets

- App icons: `TherrMobile/assets/`
- Splash screens
- App Store/Play Store metadata

## Database Considerations

See [NICHE_APP_DATABASE_GUIDELINES.md](./NICHE_APP_DATABASE_GUIDELINES.md) for detailed database patterns.

Key principle: **All brands share the same database**, but brand-specific features use:
- Isolated schemas (e.g., `habits.*` instead of `main.*`)
- Brand-conditional queries in service layer
- No `brand_id` column needed in most tables

## Testing Across Brands

### Local Development

Switch brand by modifying `brandConfig.ts`:

```typescript
// Test HABITS features
export const CURRENT_BRAND_VARIATION = BrandVariations.HABITS;

// Test THERR features
export const CURRENT_BRAND_VARIATION = BrandVariations.THERR;
```

### Backend Testing

Pass the header in API requests:

```bash
curl -H "x-brand-variation: habits" \
     -H "Authorization: Bearer <token>" \
     http://localhost:7770/users-service/users/me
```

### Automated Tests

Include brand variation in test fixtures:

```typescript
const mockHeaders = {
    authorization: 'Bearer test-token',
    'x-brand-variation': BrandVariations.HABITS,
};
```

## Related Documentation

- [NICHE_APP_DATABASE_GUIDELINES.md](./NICHE_APP_DATABASE_GUIDELINES.md) - Database patterns for niche apps
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [NICHE_APP_SETUP_STEPS.md](./NICHE_APP_SETUP_STEPS.md) - Setting up a new niche app
- [niche-sub-apps/](./niche-sub-apps/) - Documentation for specific niche apps
