# Claude Code Instructions - therr-js-utilities

## Package Overview

- **Type**: Shared isomorphic library
- **Purpose**: Constants, enums, utilities, and types shared across frontend AND backend
- **Consumers**: All services, web clients, mobile app

## Directory Structure

```
src/
├── config/
│   └── achievements/     # Achievement system definitions (12 classes)
├── constants/
│   ├── enums/           # 20+ enum definitions
│   ├── Categories.ts    # Content categories & interest mappings
│   ├── Currencies.ts    # Valuation rates
│   ├── ErrorCodes.ts    # Error code mappings
│   ├── Resources.ts     # Default resources and exchange rates
│   └── index.ts         # Central export (40+ exports)
├── db/                   # Database query helpers
├── http/                 # HTTP/REST utilities
├── middleware/           # Express middleware (JWT auth)
├── metrics/              # Honeycomb observability
├── location/             # Location utilities
├── types/                # TypeScript definitions
└── [utilities].ts        # Various utility functions
```

## Key Exports

### Constants & Enums

| Export | Purpose |
|--------|---------|
| `AccessLevels` | User permission levels |
| `BrandVariations` | App variants (THERR, TEEM, HABITS, etc.) |
| `CampaignTypes/Statuses/AdGoals` | Campaign management |
| `Categories` | Content categories for moments, spaces, events, thoughts |
| `ErrorCodes` | Application error mappings |
| `GroupMemberRoles` | Group permission levels |
| `Notifications`, `PushNotifications` | Notification type enums |
| `SocketClientActionTypes`, `SocketServerActionTypes` | WebSocket events |
| `UserConnectionTypes` | Connection type enums |
| `Currencies` | Valuation rates |
| `Resources` | Default user resources |

### Utilities

| Export | Purpose |
|--------|---------|
| `calculatePages()` | Pagination helper |
| `configureTranslator()` | i18n translation factory |
| `configureHandleHttpError()` | HTTP error response formatter |
| `configureAuthenticate()` | JWT middleware factory |
| `getDbQueryString()` | Database query builder with pagination |
| `getSearchQueryString/Args()` | URL query builders |
| `parseHeaders()` | HTTP header parser |
| `internalRestRequest()` | Inter-service HTTP client |
| `sanitizeUserName()` | Username sanitization |
| `isValidPassword()` | Password strength checker |
| `normalizePhoneNumber()` | Phone normalization |
| `MetricsService` | Honeycomb observability wrapper |

### Types

| Export | Purpose |
|--------|---------|
| `IAreaType` | 'moments' \| 'spaces' \| 'events' |
| `IPostType` | 'thoughts' \| IAreaType |
| `IMetric`, `IMetricDimensions` | Metrics types |
| `InternalConfigHeaders` | Inter-service header types |
| `IAchievement` | Achievement configuration |

## Key Patterns

### Adding New Constants

Add to `src/constants/enums/` and export via `src/constants/index.ts`:

```typescript
// src/constants/enums/NewEnum.ts
export enum NewStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
}

// src/constants/index.ts
export { NewStatus } from './enums/NewEnum';
```

### Adding Brand Variations

When creating niche apps, add to `src/constants/enums/Branding.ts`:

```typescript
export enum BrandVariations {
    THERR = 'therr',
    TEEM = 'teem',
    HABITS = 'habits',  // Add new variation
}
```

### Database Query Helpers

Use for consistent pagination and filtering:

```typescript
import { getDbQueryString, getDbCountQueryString } from 'therr-js-utilities/db';

// Generates: WHERE ... ORDER BY ... LIMIT ... OFFSET ...
const queryStr = getDbQueryString({
    filterBy: 'status',
    filterOperator: '=',
    filterValue: 'active',
    orderBy: 'createdAt',
    order: 'desc',
    limit: 20,
    offset: 0,
});
```

### HTTP Error Handling

```typescript
import { configureHandleHttpError } from 'therr-js-utilities/http';

const handleHttpError = configureHandleHttpError(logContext);
// Returns standardized error response
```

### Inter-Service Communication

```typescript
import { internalRestRequest } from 'therr-js-utilities';

// Makes HTTP call with internal headers (x-userid, x-username, etc.)
const response = await internalRestRequest({
    method: 'POST',
    url: `${USERS_SERVICE_URL}/users/search`,
    headers: req.headers,
    data: { query: 'test' },
});
```

## Build & Distribution

- Built via webpack into `/lib/` directory
- Imported using path aliases: `therr-js-utilities/[module-name]`
- Tree-shakeable - only requested modules are bundled

```bash
npm run build        # Production build
npm run build:dev    # Development build
npm run build:watch  # Watch mode
```

## Important Notes

- **Isomorphic**: Code must work in both Node.js and browser
- **No side effects**: Keep utilities pure
- **Version consistency**: Used by all packages, changes affect entire monorepo
- Changes here require rebuilding dependent packages
