# Therr App Architecture

## Overview

Therr App is a TypeScript/Node.js monorepo powering a location-based social platform. The architecture consists of:
- **6 microservices** handling specific domains (users, maps, messages, reactions, push-notifications, websocket)
- **1 API gateway** routing all external traffic and handling cross-cutting concerns
- **3 shared libraries** (therr-react, therr-js-utilities, therr-styles)
- **2 web clients** (main site, dashboard)
- **1 React Native mobile app**

**Deployment**: Google Kubernetes Engine via CircleCI pipelines
**Philosophy**: API Gateway pattern with service isolation, optimized for solo developer efficiency and security.

---

## Monorepo Structure

```
therr-app/
├── therr-api-gateway/        # Public API entry point
├── therr-services/           # Backend microservices
│   ├── users-service/
│   ├── maps-service/
│   ├── messages-service/
│   ├── reactions-service/
│   ├── push-notifications-service/
│   ├── websocket-service/
│   └── _template/            # Template for new services
├── therr-public-library/     # Shared code
│   ├── therr-react/          # React components, Redux, API services
│   ├── therr-js-utilities/   # Isomorphic utilities, constants
│   └── therr-styles/         # SCSS styles
├── therr-client-web/         # Main web app (www.therr.app)
├── therr-client-web-dashboard/  # Admin dashboard
├── TherrMobile/              # React Native app (iOS/Android)
├── _bin/                     # Build and deployment scripts
├── k8s/                      # Kubernetes manifests (prod/, test/)
└── global-config.js          # Environment-specific configuration
```

### Design Decision: Root-Level Dependencies

Most npm dependencies are defined in the root `package.json` rather than in individual packages.

- **Rationale**: Reduces duplication, ensures consistent versions, simplifies management for solo developer
- **Works Well**: Fast installs, no version conflicts between packages
- **Trade-off**: Implicit coupling between packages; consider migrating to Lerna/Nx workspaces if team grows

---

## Request Flow Architecture

### API Gateway Pattern

All external traffic enters through `therr-api-gateway`, which handles:
- JWT authentication and user context extraction
- Rate limiting (Redis-backed)
- CORS and security headers
- Request validation
- Proxying to internal microservices

```
┌──────────┐     ┌─────────────────┐     ┌────────────────┐     ┌──────────┐
│  Client  │────>│   API Gateway   │────>│  Microservice  │────>│ Database │
│(Mobile/  │     │                 │     │                │     │(Postgres)│
│  Web)    │     │ - authenticate  │     │ - handlers     │     └──────────┘
└──────────┘     │ - rateLimit     │     │ - store        │
                 │ - proxy request │     │ - routes       │
                 └─────────────────┘     └────────────────┘
```

**Key File**: [therr-api-gateway/src/middleware/handleServiceRequest.ts](therr-api-gateway/src/middleware/handleServiceRequest.ts)

- **Rationale**: Single point for security concerns; services stay focused on business logic
- **Works Well**: Clean separation, consistent auth across all endpoints
- **Trade-off**: Gateway is a single point of failure (mitigated by Kubernetes replicas)

### Authentication & Header Propagation

JWT tokens are verified in [therr-api-gateway/src/middleware/authenticate.ts](therr-api-gateway/src/middleware/authenticate.ts). User context is extracted and propagated to services via headers:

| Header | Purpose |
|--------|---------|
| `x-userid` | Authenticated user ID |
| `x-username` | Username |
| `x-user-access-levels` | JSON array of permission levels |
| `x-organizations` | JSON object of org memberships |
| `x-brand-variation` | App brand (THERR, etc.) |
| `x-platform` | Client platform (mobile/web) |
| `x-localecode` | User's locale |

Services trust these headers since they're only accessible within the internal Kubernetes network.

### Rate Limiting

Redis-backed rate limiting with two tiers:
- **Generic**: 1000 requests/minute per IP (all endpoints)
- **Endpoint-specific**: Configurable per route (e.g., login attempts, registration)

**Key File**: [therr-api-gateway/src/middleware/rateLimiters.ts](therr-api-gateway/src/middleware/rateLimiters.ts)

---

## Microservices

| Service | Port | Database | Responsibilities |
|---------|------|----------|------------------|
| **users-service** | 7771 | `therr_dev_users` | Accounts, profiles, connections, notifications, achievements |
| **maps-service** | 7773 | `therr_dev_maps` | Moments, spaces, events, location queries (PostGIS) |
| **messages-service** | 7772 | `therr_dev_messages` | Direct messaging |
| **reactions-service** | 7774 | `therr_dev_reactions` | Likes, comments, content engagement |
| **push-notifications-service** | 7775 | — | Firebase Cloud Messaging delivery |
| **websocket-service** | 7743 | — | Real-time Socket.IO connections |

### Service Internal Structure

Each service follows a consistent pattern:
```
src/
├── index.ts          # Express app setup
├── routes/           # Express routers
├── handlers/         # Request handlers (business logic)
├── store/            # Data access layer
│   ├── connection.ts # DB connection pools
│   ├── *Store.ts     # Entity-specific queries
│   └── migrations/   # Knex migrations
├── middleware/       # Service-specific middleware
└── utilities/        # Helper functions
```

### Design Decision: Database-per-Service

Each service owns its database, enforcing clear boundaries.

- **Rationale**: Service autonomy, independent deployments, clear data ownership
- **Works Well**: Clean boundaries, can scale databases independently
- **Trade-off**: Cross-service data requires HTTP calls (no joins across services)

---

## Data Layer

### PostgreSQL with Read/Write Separation

Each service maintains separate connection pools for reads and writes:

```typescript
// Pattern from therr-services/users-service/src/store/connection.ts
const read: Pool = new Pool({
    host: process.env.DB_HOST_MAIN_READ,
    max: 20,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
});

const write: Pool = new Pool({
    host: process.env.DB_HOST_MAIN_WRITE,
    // ... same pool config
});
```

**Key File**: [therr-services/users-service/src/store/connection.ts](therr-services/users-service/src/store/connection.ts)

- **Rationale**: Enables read replicas for scaling without code changes
- **Works Well**: Architecture is ready for scale when needed
- Uses **Knex.js** for migrations; raw SQL queries (not ORM) for flexibility

### Redis Strategy

Two Redis instances serve different purposes:

| Instance | Config Vars | Purpose |
|----------|-------------|---------|
| **Generic** | `REDIS_GENERIC_HOST/PORT` | Critical operations: rate limiting |
| **Ephemeral** | `REDIS_EPHEMERAL_HOST/PORT` | Non-critical: caching, can be cleared |

- **Rationale**: Ephemeral cache can be flushed without affecting rate limiting
- **Works Well**: Clear importance hierarchy for data persistence

Common caching patterns:
- Exchange rates: 5-minute TTL
- Area details (moments/spaces): 300-second TTL
- User location data: 20-minute TTL with geo-indexing

---

## Real-Time Communication

### WebSocket Architecture

`websocket-service` handles all real-time connections using Socket.IO with Redis adapter for horizontal scaling:

```
┌─────────┐     ┌──────────────────┐     ┌───────┐
│ Client  │────>│ websocket-service│<───>│ Redis │ (pub/sub adapter)
│         │     │   (Socket.IO)    │     │       │
└─────────┘     └──────────────────┘     └───────┘
                         │
                         v
                 ┌───────────────┐
                 │ Other Services│ (via HTTP)
                 └───────────────┘
```

- Client path: `/socketio`
- Events follow Redux middleware pattern (`SOCKET_MIDDLEWARE_ACTION`)
- Session data stored in Redis for user presence tracking

**Key File**: [therr-services/websocket-service/src/index.ts](therr-services/websocket-service/src/index.ts)

---

## Shared Libraries

### Build Dependency Chain

```
therr-styles ──────────────────────────────────────────┐
      │                                                 │
      v                                                 v
therr-js-utilities ───────────────────────> [All Services]
      │
      v
therr-react ───────────────> [Web Clients, Mobile App]
```

| Library | Purpose | Key Exports |
|---------|---------|-------------|
| **therr-js-utilities** | Isomorphic utilities | Constants (AccessLevels, SocketActionTypes), HTTP helpers, location utils |
| **therr-react** | Shared React code | Components, Redux state/actions, API service classes |
| **therr-styles** | Design system | SCSS variables, mixins, compiled CSS |

### Design Decision: Compiled Libraries via TypeScript Paths

Libraries compile to `lib/` directories and are imported via TypeScript path aliases:

```json
// tsconfig.json in clients
"paths": {
  "therr-react/*": ["../therr-public-library/therr-react/lib/*"],
  "therr-js-utilities/*": ["../therr-public-library/therr-js-utilities/lib/*"]
}
```

- **Rationale**: Code sharing between web and mobile without npm publish step
- **Works Well**: Fast iteration, single source of truth
- **Trade-off**: Webpack configs are complex; Metro config for React Native requires extra setup

---

## Build System

### Smart Rebuild Scripts

The `_bin/` directory contains scripts for efficient builds:

| Script | Purpose |
|--------|---------|
| `apply-to-all.sh` | Run command across all packages in dependency order |
| `apply-to-changed.sh` | Rebuild only packages changed since target branch |
| `prep.sh` | Ensure correct npm version via nvm |

**Key File**: [_bin/apply-to-changed.sh](_bin/apply-to-changed.sh)

`apply-to-changed.sh` detects changes via git diff and handles dependency cascades:
- If `global-config.js` changes → rebuild everything
- If `therr-js-utilities` changes → rebuild therr-react and all consumers
- If a service changes → rebuild only that service

### Design Decision: Custom Scripts over Monorepo Tools

- **Rationale**: Simple, predictable, no additional tooling overhead
- **Works Well**: CI/CD efficiency, developers understand exactly what runs
- **Trade-off**: Manual maintenance of dependency arrays in scripts

### Common Commands

```bash
npm run build:all       # Full rebuild of everything
npm run build:changed   # Smart rebuild (CI uses this)
npm run install:all     # Install deps across all packages
npm run dev             # Start individual service (from service dir)
```

---

## Deployment

### CircleCI Pipeline

```
┌─────────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ docker_build_base   │────>│ test_libraries  │────>│ docker_build_   │
│ _image              │     │                 │     │ test_publish    │
└─────────────────────┘     └─────────────────┘     └─────────────────┘
                                                            │
                                                            v (main branch)
                                                    ┌─────────────────┐
                                                    │     deploy      │
                                                    │   (to GKE)      │
                                                    └─────────────────┘
```

### Kubernetes Architecture

Manifests in `k8s/prod/` and `k8s/test/`:
- Each service: Deployment + ClusterIP Service
- API Gateway: Deployment + LoadBalancer Service
- Ingress: nginx with cert-manager for TLS
- Two Redis deployments (generic + ephemeral)

Internal service discovery: `{service-name}-cluster-ip-service:{port}`

**Key File**: [_bin/cicd/deploy.sh](_bin/cicd/deploy.sh)

---

## Niche App Strategy

The codebase supports multiple "brand variations" from the same source:

- **Header**: `x-brand-variation` identifies the app brand
- **Constants**: `BrandVariations` enum in therr-js-utilities
- **Feature Flags**: Services can customize behavior per brand

### Branch Strategy

- `general` branch: Shared code for all niche apps
- `niche/APP-general`: App-specific customizations (e.g., `niche/TEEM-general`, `niche/HABITS-general`)

### Database Schema Isolation

Brand-specific features use isolated PostgreSQL schemas to prevent breaking changes:

```
main schema (core features)
├── users                 # User accounts, profiles
├── userConnections       # Social connections
├── notifications         # In-app notifications
└── ...

habits schema (HABITS app features)
├── habit_goals           # Habit templates
├── pacts                 # Accountability partnerships
├── pact_members          # Membership with stats
├── habit_checkins        # Daily completions
├── streaks               # Streak tracking
├── streak_history        # Event log
├── proofs                # Media verification
└── pact_activities       # Activity feed
```

This pattern allows niche features to be deployed without affecting core app functionality.

**Documentation**:
- [docs/MULTI_BRAND_ARCHITECTURE.md](MULTI_BRAND_ARCHITECTURE.md) - Brand variation system details
- [docs/NICHE_APP_DATABASE_GUIDELINES.md](NICHE_APP_DATABASE_GUIDELINES.md) - Schema isolation patterns
- [docs/NICHE_APP_SETUP_STEPS.md](NICHE_APP_SETUP_STEPS.md) - Setting up a new niche app

---

## Known Technical Debt

| Area | Issue | Priority | Notes |
|------|-------|----------|-------|
| **Dependencies** | Most deps in root package.json creates coupling | Medium | Consider Lerna/Nx if team grows |
| **React/Webpack** | Stale versions (especially React) | Low | Feature delivery takes priority |
| **Local Dev** | No docker-compose for services | Medium | Each service started via `npm run dev` |
| **API Docs** | No OpenAPI/Swagger specs | Low | Would help external integrations |
| **Testing** | Integration tests incomplete | Medium | CI has placeholder step |
| **Error Handling** | Inconsistent error formats across services | Low | Should standardize error codes |
| **Type Safety** | Socket event payloads lack strict typing | Low | Add typed event interfaces |

---

## Quick Reference

### Port Assignments

| Port | Service |
|------|---------|
| 7770 | API Gateway |
| 7771 | Users Service |
| 7772 | Messages Service |
| 7773 | Maps Service |
| 7774 | Reactions Service |
| 7775 | Push Notifications Service |
| 7743 | WebSocket Service |
| 7070 | Web Client |
| 7071 | Dashboard Client |

### Key Files for Common Tasks

| Task | File |
|------|------|
| Add API endpoint | `therr-api-gateway/src/services/{service}/router.ts` |
| Add service handler | `therr-services/{service}/src/handlers/` |
| Database migration | `therr-services/{service}/src/store/migrations/` |
| Shared constants | `therr-public-library/therr-js-utilities/src/constants/` |
| Shared components | `therr-public-library/therr-react/src/components/` |
| Environment config | `global-config.js`, `.env.template` |
| CI/CD pipeline | `.circleci/config.yml` |
| K8s manifests | `k8s/prod/`, `k8s/test/` |

### Adding a New Service

1. Copy `therr-services/_template/` to `therr-services/{new-service}/`
2. Update `package.json` with name and port
3. Add to `_bin/apply-to-changed.sh` package arrays
4. Add route in `therr-api-gateway/src/routes/index.ts`
5. Create K8s manifests in `k8s/prod/` and `k8s/test/`
6. Add service URL to `global-config.js`
