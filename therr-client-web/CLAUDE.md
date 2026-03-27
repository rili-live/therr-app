# Claude Code Instructions - therr-client-web

## Package Overview

- **Port**: 7070
- **Type**: React web application with SSR
- **Purpose**: Public-facing web app (www.therr.app)
- **Features**: User auth, profiles, forums, spaces directory, messaging

## Directory Structure

```
src/
├── components/
│   ├── Layout.tsx           # Main layout with nav, footer
│   ├── Header.tsx           # Navigation bar
│   ├── AppRoutes.tsx        # Route configuration
│   ├── forms/               # Login, Register, Profile forms
│   ├── footer/              # Footer, MessagingContainer
│   └── nav-menu/            # UserMenu, Notification
├── routes/                   # Page components (15+ files)
│   ├── Home.tsx
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── Forum.tsx
│   ├── ListSpaces.tsx
│   ├── ViewSpace.tsx
│   ├── ViewMoment.tsx
│   └── index.tsx            # Route config with access control
├── redux/
│   ├── actions/
│   │   └── UsersActions.ts  # Wraps therr-react actions
│   └── reducers/
│       └── index.ts         # Extends therr-react reducers
├── styles/
│   ├── themes/              # forest, ocean, retro, primary
│   ├── layout/
│   ├── pages/
│   └── components/
├── locales/                  # i18n translations
├── utilities/
├── server-client.tsx         # Express SSR server
├── store.tsx                 # Redux store
├── socket-io-middleware.ts   # WebSocket integration
└── interceptors.ts           # Axios config
```

## Localization

All user-facing text must use translation keys from `src/locales/`. When adding or modifying UI strings:
1. Add the key to **all three** dictionaries: `en-us/dictionary.json`, `es/dictionary.json`, and `fr-ca/dictionary.json`
2. Use `useTranslation` hook or `withTranslation` HOC — never hardcode strings
3. URLs are locale-prefixed: English = unprefixed (`/locations`), Spanish = `/es/locations`, French = `/fr-ca/locations`
4. The URL prefix is the source of truth for locale — see `server-client.tsx` middleware
5. All `<Link>` and `navigate()` calls auto-include the locale prefix via React Router's `basename`

## Key Routes

Routes below are shown without locale prefix. All public routes are also served at `/es/<route>`.

| Route | Component | Auth |
|-------|-----------|------|
| `/` | Home | No |
| `/login` | Login | No |
| `/register` | Register | No |
| `/user/profile` | UserProfile | Yes |
| `/forums` | Forum | Yes |
| `/locations` | ListSpaces | No |
| `/spaces/:spaceId` | ViewSpace | No |
| `/moments/:momentId` | ViewMoment | No |

## Key Patterns

### Redux Integration

Extends therr-react reducers with local state:

```typescript
// src/redux/reducers/index.ts
import getCombinedReducers from 'therr-react/redux/reducers';
import { socketIO } from '../../socket-io-middleware';

const localReducers = { location: locationReducer };
export default getCombinedReducers(socketIO, localReducers);
```

### Server-Side Rendering

Express server renders React on the server:

```typescript
// src/server-client.tsx
// Matches route, pre-fetches data, renders to HTML
// Injects Redux state into window.__PRELOADED_STATE__
```

### Auth-Protected Routes

Uses `AuthRoute` from therr-react:

```typescript
import { AuthRoute } from 'therr-react/components/routing';

<AuthRoute
    path="/user/profile"
    isAuthorized={user.isAuthenticated}
    redirectPath="/login"
>
    <UserProfile />
</AuthRoute>
```

### Axios Interceptors

```typescript
// src/interceptors.ts
// Sets auth token, platform header, brand variation
// Handles 401 logout flow
```

## Build & Dev

```bash
npm run dev           # Development with watch
npm run build         # Production build (app + server)
npm start             # Start SSR server (requires build)
npm test              # Run Jest tests
```

## CSS Cache Busting (`update-views.js`)

Production builds output CSS with content hashes (e.g., `app.abc123.css`) for cache busting. The Handlebars templates in `src/views/` reference CSS by name (e.g., `/app.css`), so `update-views.js` runs post-build to replace those references with the actual hashed filenames.

**When adding a new `.hbs` view template, you must add it to the `viewFiles` array in `update-views.js`.** Otherwise the template will reference `/app.css` and `/vendor.css` which won't exist in production, causing the page to load without styles on first visit.

This only affects SSR first-load. Client-side navigation appears to work because CSS was already loaded from a different page's correctly-updated template.

## Theming

Multiple SCSS theme bundles:
- `themes/retro.scss`
- `themes/primary.scss`
- `themes/ocean.scss`
- `themes/forest.scss`

## Important Notes

- Uses path aliases: `therr-react/*`, `therr-js-utilities/*`, `therr-styles/*`
- SSR requires both `webpack.app.config.js` and `webpack.server.config.js`
- Socket.IO middleware for real-time messaging and notifications
- Brand variation: `BrandVariations.THERR`
- Locale-prefixed URL routing: see `docs/LOCALE_URL_ROUTING.md` for architecture details

## Code Quality

Before completing code changes, run linting and fix all errors:

```bash
npx eslint src/**/*.ts src/**/*.tsx --fix   # Auto-fix issues
npx eslint src/**/*.ts src/**/*.tsx         # Verify no errors remain
```

See root `CLAUDE.md` for full code quality requirements.
