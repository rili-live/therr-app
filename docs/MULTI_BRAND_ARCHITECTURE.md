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
