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
- **Node.js**: 24.12.0 required (see `.nvmrc`)
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

## Code Quality Requirements

**Before completing any code changes, you MUST:**

1. **Run linting** on modified files and fix all errors:
   ```bash
   npx eslint <file-path> --fix    # Auto-fix what's possible
   npx eslint <file-path>          # Check for remaining errors
   ```

2. **For TypeScript files**, ensure no type errors:
   ```bash
   npx tsc --noEmit -p <package>/tsconfig.json
   ```

3. **Common lint rules** enforced across the codebase:
   - No unused variables or imports
   - Consistent indentation (2 spaces)
   - No `any` types without explicit reason
   - Prefer `const` over `let` when variable is not reassigned

**Do not consider code changes complete until linting passes with zero errors.**

## Documentation Context

Read these files when relevant to the task:

- `docs/ARCHITECTURE.md` - System design, service boundaries, data layer patterns
- `docs/MULTI_BRAND_ARCHITECTURE.md` - Brand variation system, header flow, conditional code patterns
- `docs/NICHE_APP_DATABASE_GUIDELINES.md` - Schema isolation, migration patterns for niche features
- `docs/niche-sub-apps/PROJECT_BRIEF.md` - Core Therr App product vision and roadmap
- `docs/niche-sub-apps/<TAG>_PROJECT_BRIEF.md` - Niche app variant context (see "Project Brief Context" above)
- `docs/LOCALE_URL_ROUTING.md` - Locale-prefixed URL routing, i18n architecture, SEO strategy
- `docs/NICHE_APP_SETUP_STEPS.md` - Brand variation setup process
- `docs/TARGET_MARKETS.md` - Consumer and business target market definitions (core Therr App)
- `docs/FEATURES.md` - **High-level feature list for mobile & web clients. Update this file when adding or removing features.**

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

## TanStack Query (React Query) — Case-by-Case Adoption

TanStack Query is **not** the default data-fetching tool in this codebase — Redux Toolkit with custom action creators is. TanStack Query **may** be introduced for specific, isolated use cases where its features (request deduplication, background refetch, stale-while-revalidate, `useInfiniteQuery`, optimistic mutations) provide clear value over hand-rolled Redux thunks.

Before reaching for it, check the rules below. When in doubt, stay with Redux.

### When it is a good fit

- **New, read-heavy screens** that are self-contained within one app (web, mobile, or dashboard) and do not share state with other features.
- **Infinite lists / pagination** where `useInfiniteQuery` replaces manual pagination state in Redux.
- **Mutations with optimistic updates** that don't cascade into other Redux slices.
- **Polling / background refresh** (`refetchInterval`, `refetchOnReconnect`, `refetchOnWindowFocus`) — especially useful for dashboards.

### When it is NOT appropriate (keep in Redux)

Do not move any of the following to TanStack Query. These slices are tightly coupled to existing infrastructure and splitting them will cause sync bugs:

| Slice / feature | Why it stays in Redux |
|-----------------|-----------------------|
| `user`, auth, session | Consumed by axios interceptors, socket middleware, route guards, and redux-persist |
| `notifications`, `messages`, reactions | Pushed by `socket-io-middleware` directly into Redux — TanStack has no socket story |
| `userConnections`, presence | Updated by WebSocket events |
| Anything in `therr-react/redux/actions` | Shared across web, dashboard, and mobile; changing shape breaks all three consumers |
| SSR-rendered data on `therr-client-web` | Server pre-populates `__PRELOADED_STATE__` into Redux; TanStack SSR hydration is a separate integration |
| Persisted state (see "Offline-First" in docs) | `redux-persist` already caches key slices; TanStack would need a parallel persister |

### Required precautions before introducing it

If a feature genuinely fits the "good fit" list above, follow these rules:

1. **Scope it to a single app.** Do not add TanStack Query to `therr-react` (the shared library). Add it to `therr-client-web`, `therr-client-web-dashboard`, or `TherrMobile` only, and keep the queries in that app's source.
2. **Reuse existing API clients.** Call into the singleton services in `therr-react/services` (e.g., `MapsService.searchSpaces`) from inside the `queryFn` — do not reimplement the HTTP layer. This preserves auth headers, brand variation header, and interceptor behavior.
3. **Do not duplicate state.** If the data you'd put in TanStack is already read from Redux elsewhere, either (a) keep it in Redux, or (b) migrate the other reader too. Never have both.
4. **Document the decision.** Add a brief comment at the top of the new query file explaining why TanStack was chosen over a Redux action (e.g., "infinite scroll", "needs polling", "optimistic mutation with rollback").
5. **QueryClient placement.** Provide `QueryClient` at the feature subtree or app root — not inside `therr-react`. Use sensible defaults (`staleTime`, `retry: 1`) so it doesn't thrash on mobile data connections.
6. **No socket events into the query cache.** If the data is also pushed by WebSocket, pick one: Redux (preferred) or TanStack with manual `queryClient.invalidateQueries` on socket events. Never both.

### Default answer

If you're unsure whether to use TanStack Query for a new feature: **don't**. Use a Redux action in the existing pattern. The cost of two state paradigms in the same app outweighs the ergonomic gains except for the narrow cases listed above.

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
    HABITS = 'habits',
    // Add new variants here
}
```

Brand variation is passed via HTTP header `x-brand-variation` and used to:
- Customize push notification content
- Filter content by brand
- Apply brand-specific business logic
- Load brand-specific achievements

For comprehensive documentation, see `docs/MULTI_BRAND_ARCHITECTURE.md`.

### Adding a New Brand Variation

1. Add to `BrandVariations` enum in `therr-js-utilities`
2. Update `getHostContext()` in relevant services
3. Add Firebase config in `push-notifications-service`
4. Configure mobile app (see `TherrMobile/CLAUDE.md`)
5. Create niche branch: `git checkout -b niche/<TAG>-general`

### Brand-Conditional Code Patterns

**Backend (service layer):**
```typescript
import { parseHeaders } from 'therr-js-utilities/http';
import { BrandVariations } from 'therr-js-utilities/constants';

const handler = (req, res) => {
    const { brandVariation } = parseHeaders(req.headers);

    if (brandVariation === BrandVariations.HABITS) {
        // HABITS-specific logic
    }
    // Default behavior
};
```

**Mobile (component layer):**
```typescript
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';
import { BrandVariations } from 'therr-js-utilities/constants';

if (CURRENT_BRAND_VARIATION === BrandVariations.HABITS) {
    return <HabitsFeature />;
}
```

### Database Schema Isolation

Brand-specific features should use isolated database schemas:
- Core tables: `main.*` (users, connections, notifications)
- Habits features: `habits.*` (pacts, checkins, streaks)

See `docs/NICHE_APP_DATABASE_GUIDELINES.md` for migration patterns.

### Feature Flags (Future)

Feature flags will be implemented via:
- Backend: Service-level configuration
- Frontend: Redux state or context
- Mobile: Similar pattern with AsyncStorage persistence

## Localization / i18n

When adding or modifying user-facing text, always maintain translation strings in **all** locale dictionaries for the relevant package. Never add a key to one dictionary without adding it to all others in that package.

### therr-client-web (3 locales)
- `therr-client-web/src/locales/en-us/dictionary.json` (English)
- `therr-client-web/src/locales/es/dictionary.json` (Spanish)
- `therr-client-web/src/locales/fr-ca/dictionary.json` (Canadian French)

Use the `useTranslation` hook (or `withTranslation` HOC for class components) instead of hardcoded strings.

### TherrMobile (3 locales)
- `TherrMobile/main/locales/en-us/dictionary.json` (English)
- `TherrMobile/main/locales/es/dictionary.json` (Spanish)
- `TherrMobile/main/locales/fr-ca/dictionary.json` (Canadian French)

Use the `translator` utility imported from `../../services/translator` instead of hardcoded strings.

### Hardcoded Locale Strings in Frontend Code

When frontend or mobile code contains hardcoded strings that are matched against locale-translated text (e.g., keyword highlighting, substring matching, pattern detection), **always include variants for all supported locales** (currently `en-us`, `es`, and `fr-ca`). The translated message from the server may be in any supported language, so matching only English strings will silently fail for other locales.

Affected locations:
- `TherrMobile/main/routes/Notifications/Notification.tsx` — `getHighlightValues()` uses keyword matching against translated notification messages

Backend locale dictionaries to reference (in-app notifications use users-service strings; push notifications use push-notifications-service strings):
- `therr-services/users-service/src/locales/en-us/dictionary.json` (in-app notification list)
- `therr-services/users-service/src/locales/es/dictionary.json` (in-app notification list)
- `therr-services/users-service/src/locales/fr-ca/dictionary.json` (in-app notification list)
- `therr-services/push-notifications-service/src/locales/en-us/dictionary.json` (push notifications only)
- `therr-services/push-notifications-service/src/locales/fr-ca/dictionary.json` (push notifications only)

## Notes

- Most npm deps are in root `package.json` (shared across packages)
- TherrMobile has its own `package.json` with React Native specific deps
- Always use `--legacy-peer-deps` flag when installing
