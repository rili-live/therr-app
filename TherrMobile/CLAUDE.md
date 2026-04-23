# Claude Code Instructions - TherrMobile

## Overview

React Native 0.83.6 mobile app (iOS + Android) for the Therr social platform. React 19.2.0. Has its own `package.json` isolated from the monorepo root. Android namespace `app.therrmobile`; `applicationId` varies by niche (`app.therrmobile` on Therr, `com.therr.habits` on Friends with Habits). Native code in Kotlin. New Architecture (`newArchEnabled=true`) + Hermes.

## Directory Structure

```
TherrMobile/
├── main/
│   ├── App.tsx                    # Root component
│   ├── Layout.tsx                 # Navigation stack + brand context
│   ├── getStore.tsx               # Redux store setup
│   ├── interceptors.ts            # Axios request/response interceptors
│   ├── socket-io-middleware.ts    # WebSocket via socket.io
│   ├── components/                # Reusable UI (ButtonMenu, Input, Modals, etc.)
│   ├── routes/                    # Screen components (~30 route dirs)
│   │   ├── index.tsx              # Route config with AccessLevel guards
│   │   ├── Map/                   # Geo features (largest route, 25+ files)
│   │   ├── Areas/                 # Nearby, Bookmarked, Drafts
│   │   ├── Connect/               # User discovery
│   │   ├── DirectMessage/         # 1-on-1 messaging
│   │   ├── Groups/                # Community features
│   │   └── ...
│   ├── redux/                     # Mobile-only actions + reducers (extends therr-react)
│   ├── styles/themes/             # light (default), dark, retro
│   ├── locales/                   # i18n: en-us, es, fr-ca
│   ├── config/brandConfig.ts      # Brand variation selector (THERR, TEEM, HABITS)
│   ├── constants/                 # App constants (map, carousel, notifications)
│   └── utilities/                 # getConfig, pushNotifications, contacts
├── env-config.js                  # Dev/prod API URLs, feature flags, OAuth IDs
├── metro.config.js                # Module resolution (see gotchas below)
├── babel.config.js                # Module resolver + deprecated prop types shim
├── resolver/react-native/         # Proxy for deprecated ViewPropTypes etc.
├── patches/                       # patch-package patches (applied via postinstall)
├── android/                       # Native Android (Kotlin)
├── ios/                           # Native iOS
└── package.json
```

## Build & Dev Commands

```bash
# Install deps (always use --legacy-peer-deps)
npm install --legacy-peer-deps

# Start Metro bundler
npm start

# iOS
npm run ios                  # Build + run on simulator (Debug scheme)
npm run ios:clean            # Nuke Pods, DerivedData, reinstall pods
npm run ios:pod:install      # Just reinstall CocoaPods
npm run ios:bundle:release   # Bundle for release

# Android
npm run android              # Build + run on emulator
npm run android:device       # Run on physical device (sets up adb reverse)
npm run android:emulator     # Launch Pixel_9 AVD
npm run android:clean        # Clean Gradle build dirs
npm run build:release        # AAB for Play Store
npm run build:release:apk    # APK for sideloading

# Testing & Linting
npm test                     # Jest (uses root node_modules jest)
npm run lint:fix             # ESLint auto-fix
npm run lint                 # Check for remaining errors
```

## Environment Config

`env-config.js` holds dev/prod settings:
- **Dev**: API at `localhost:7770` (iOS) or `10.0.2.2:7770` (Android emulator)
- **Prod**: API at `api.therr.com`, WebSocket at `websocket-service.therr.com`
- **Feature flags**: `featureFlags` object toggles nav tabs, content types, social features
- **`.env` file**: Required for `GOOGLE_APIS_ANDROID_KEY` and `GOOGLE_APIS_IOS_KEY` (loaded via `react-native-dotenv`)

`main/utilities/getConfig.ts` selects dev or prod based on `__DEV__`.

## Module Resolution (Important Gotchas)

The module resolution is complex due to the monorepo. Understanding this prevents hard-to-debug runtime errors:

1. **Metro config** (`metro.config.js`):
   - `extraNodeModules` maps `therr-react` and `therr-js-utilities` to their compiled `lib/` dirs
   - React, react-native, Redux packages resolve to TherrMobile's local `node_modules` (not root) to prevent duplicate singletons
   - Root copies of react/react-native/redux are **blocklisted** via regex
   - **Axios singleton fix**: All axios imports forced to single CJS file (`axios/dist/browser/axios.cjs`) to avoid dual-singleton bug
   - **use-latest-callback fix**: Forced to root copy to avoid CJS/ESM mismatch

2. **Babel config** (`babel.config.js`):
   - `module-resolver` aliases `shared` -> `../node_modules`
   - Custom `resolvePath` redirects `react-native` imports to `resolver/react-native/` which provides deprecated prop type polyfills (for older libraries)
   - `react-native-reanimated/plugin` **must be last** in plugins array

3. **TypeScript paths** (`tsconfig.json`):
   - `therr-react/*`, `therr-js-utilities/*`, `therr-styles/*` -> compiled `lib/` dirs
   - `shared/*` -> root `node_modules/*`

4. **Patches** (`patches/`, applied via `postinstall`):
   - `react-native+0.83.6.patch`
   - `@react-native-community+slider+5.1.2.patch`
   - `react-native-tab-view+3.5.2.patch`
   - `react-native-screens+4.24.0.patch` (RTTI fix required for New Architecture)
   - `react-native-worklets+0.8.1.patch` (prefab headers race fix for Reanimated 4)

**When adding a new shared library dependency**: Add it to root `package.json`, then ensure Metro can find it via `extraNodeModules` or the Proxy fallback.

## Key Patterns

### Redux

Mobile extends `therr-react` reducers with local ones (location, ui):
```typescript
// main/redux/reducers/index.ts
import getCombinedReducers from 'therr-react/redux/reducers';
const localReducers = { location: locationReducer, ui: uiReducer };
export default getCombinedReducers(socketIO, localReducers);
```

### Navigation

React Navigation 6 with Stack Navigator. Routes defined in `main/routes/index.tsx` with `AccessLevels` guards. Fade transitions.

### Theming

Three themes: light (default), dark, retro. Selected via `user.settings.mobileThemeName` in Redux. Uses `@callstack/react-theme-provider`.

### Push Notifications

Firebase Cloud Messaging + Notifee. Android channels defined in `main/constants/index.tsx` (default, contentDiscovery, rewardUpdates, reminders). FCM setup in `main/utilities/pushNotifications.ts`.

### Brand Variation

Configured in `main/config/brandConfig.ts`. Consumed by interceptors (HTTP headers), socket middleware, and Layout. Feature flags in `env-config.js` control which tabs/features are visible.

```typescript
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';
import { BrandVariations } from 'therr-js-utilities/constants';

if (CURRENT_BRAND_VARIATION === BrandVariations.HABITS) {
    return <HabitsFeature />;
}
```

### General vs Niche Branch Files

**`general` branch** (shared by all apps): Components, shared screens, Redux, API services, conditional rendering.

**`niche/<TAG>-general` branch** (app-specific): `brandConfig.ts`, app icons/splash, nav guards, feature toggles, store metadata.

## Common Debugging

- **"Cannot read property X of undefined" at startup**: Usually a module resolution issue. Check metro.config.js blocklist and extraNodeModules.
- **Two copies of React**: Metro is resolving React from root node_modules. Verify blockList patterns match.
- **Axios interceptors not firing**: Dual axios singleton issue. Verify `resolveRequest` in metro.config.js forces single CJS path.
- **Android emulator can't reach API**: Run `adb reverse tcp:7770 tcp:7770` (or use `npm run android:device`).
- **Deprecated prop types warning**: The `resolver/react-native/` proxy handles this. If a new library triggers it, the proxy may need updating.
- **Pod install fails**: `npm run ios:clean` nukes everything and reinstalls.

## Code Quality

Before completing changes:
```bash
npm run lint:fix   # Auto-fix
npm run lint       # Verify zero errors
```

See root `CLAUDE.md` for full requirements.
