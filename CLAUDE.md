# Claude Code Instructions

## Branch Awareness (Check First)

Before making code changes, check the current git branch name:

- **`niche/*` branches** (e.g., `niche/TEEM-general`): Changes should be specific to that niche app variant. These branches contain app-specific branding, assets, and configurations.

- **`general` branch**: Contains shared code inherited by all niche apps.

- **`stage` branch**: Merging `general` → `stage` triggers CI **build** phase.

- **`main` branch**: Merging `stage` → `main` triggers CI **deploy** phase to production.

**Important**: If on a `niche/*` branch and a requested change should apply to all niche apps (shared functionality, bug fixes, library updates), ask before proceeding:
1. Should this change be committed to the current niche branch, or
2. Should we switch to `general` branch first so all niche apps inherit the change?

This prevents accidentally putting shared code in niche-specific branches or vice versa.

### Project Brief Context (Required)

Always associate the current context with the appropriate project brief based on the checked out branch:

| Current Branch | Project Brief to Reference |
|----------------|----------------------------|
| `general`, `stage`, `main` | `docs/niche-sub-apps/PROJECT_BRIEF.md` (core Therr App) |
| `niche/HABITS-general` | `docs/niche-sub-apps/HABITS_PROJECT_BRIEF.md` |
| `niche/TEEM-general` | `docs/niche-sub-apps/TEEM_PROJECT_BRIEF.md` |
| `niche/<TAG>-general` | `docs/niche-sub-apps/<TAG>_PROJECT_BRIEF.md` |

**Pattern**: For any `niche/<TAG>-general` branch, the corresponding project brief is `docs/niche-sub-apps/<TAG>_PROJECT_BRIEF.md` (uppercase TAG with underscores).

When working on a branch, read the associated project brief early in the conversation to understand the product context, vision, and specific requirements for that app variant.

## Key Dependencies

- **React**: 18.x.x (web clients) - Use hooks, functional components
- **React Native**: 0.74.3 (TherrMobile) - Has its own package.json with isolated deps
- **TypeScript**: 4.8.x
- **Node.js**: 18+ required
- **npm**: 11+ required (enforced by `_bin/prep.sh`)

## Code Patterns

### Imports
- Use TypeScript path aliases defined in `tsconfig.json`
- Shared libraries: `therr-react/*`, `therr-js-utilities/*`
- Services import from compiled `lib/` directories

### React
- Functional components with hooks (no class components)
- Redux for state management (`@reduxjs/toolkit` 1.9)
- React Router 6 for web routing

### Backend
- Express handlers follow pattern: `(req, res) => handleServiceRequest(...)`
- Database: Raw SQL with Knex.js (not ORM)
- Separate read/write connection pools per service

### Error Handling
- Services return HTTP status codes via `http-status` constants
- Gateway handles auth errors, services handle business logic errors

## Build Commands

```bash
npm run build:all:dev   # Build all libraries and services
npm run build:changed   # Smart rebuild (changed packages only)
npm run install:all     # Install deps across all packages
```

## Documentation Context

Read these files when relevant to the task:

- `docs/ARCHITECTURE.md` - System design, service boundaries, data layer patterns
- `docs/niche-sub-apps/PROJECT_BRIEF.md` - Core Therr App product vision and roadmap
- `docs/niche-sub-apps/<TAG>_PROJECT_BRIEF.md` - Niche app variant context (see "Project Brief Context" above)
- `docs/NICHE_APP_SETUP_STEPS.md` - Brand variation setup process

## Monorepo Structure

```
therr-api-gateway/        # Public API entry point (port 7770)
therr-services/           # Backend microservices (ports 7771-7775, 7743)
therr-public-library/     # Shared code (therr-react, therr-js-utilities, therr-styles)
therr-client-web/         # Main web app (port 7070)
therr-client-web-dashboard/ # Admin dashboard (port 7071)
TherrMobile/              # React Native app (isolated deps)
```

## When to Abstract Utilities

Place utility functions in shared libraries only when:

| Location | When to Use |
|----------|-------------|
| `therr-js-utilities/` | Isomorphic code needed by both frontend AND backend (constants, enums, pure functions) |
| `therr-react/` | React-specific code shared between web AND mobile (components, hooks, Redux, API services) |
| Service `utilities/` | Backend-only logic used within a single service |
| Local file | Single-use helper; don't abstract prematurely |

**Keep it local** unless the function is:
1. Already duplicated across 2+ packages, OR
2. Clearly reusable and stable (not likely to diverge per use case)

Avoid creating abstractions for hypothetical future reuse.

## Package-Level Documentation

Each package has its own `CLAUDE.md` with package-specific details:

| Package | CLAUDE.md Location |
|---------|-------------------|
| API Gateway | `therr-api-gateway/CLAUDE.md` |
| Users Service | `therr-services/users-service/CLAUDE.md` |
| Maps Service | `therr-services/maps-service/CLAUDE.md` |
| Messages Service | `therr-services/messages-service/CLAUDE.md` |
| Reactions Service | `therr-services/reactions-service/CLAUDE.md` |
| Push Notifications | `therr-services/push-notifications-service/CLAUDE.md` |
| WebSocket Service | `therr-services/websocket-service/CLAUDE.md` |
| therr-js-utilities | `therr-public-library/therr-js-utilities/CLAUDE.md` |
| therr-react | `therr-public-library/therr-react/CLAUDE.md` |
| therr-styles | `therr-public-library/therr-styles/CLAUDE.md` |
| Web Client | `therr-client-web/CLAUDE.md` |
| Dashboard | `therr-client-web-dashboard/CLAUDE.md` |
| Mobile App | `TherrMobile/CLAUDE.md` |

## Feature Flags & Brand Variations

### Brand Variation System

The codebase supports multiple app variants via the `BrandVariations` enum:

```typescript
// therr-public-library/therr-js-utilities/src/constants/enums/Branding.ts
export enum BrandVariations {
    THERR = 'therr',
    TEEM = 'teem',
    // Add new variants here
}
```

Brand variation is passed via HTTP header `x-brand-variation` and used to:
- Customize push notification content
- Filter content by brand
- Apply brand-specific business logic

### Adding a New Brand Variation

1. Add to `BrandVariations` enum in `therr-js-utilities`
2. Update `getHostContext()` in relevant services
3. Add Firebase config in `push-notifications-service`
4. Configure mobile app (see `TherrMobile/CLAUDE.md`)

### Feature Flags (Future)

Feature flags will be implemented via:
- Backend: Service-level configuration
- Frontend: Redux state or context
- Mobile: Similar pattern with AsyncStorage persistence

## Notes

- Most npm deps are in root `package.json` (shared across packages)
- TherrMobile has its own `package.json` with React Native specific deps
- Always use `--legacy-peer-deps` flag when installing
