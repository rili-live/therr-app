# Claude Code Instructions - TherrMobile

## Package Overview

- **Type**: React Native mobile app (iOS & Android)
- **Purpose**: Main mobile app for Therr social platform
- **Has own package.json**: Yes (isolated React Native dependencies)

## Directory Structure

```
TherrMobile/
├── main/
│   ├── components/               # Reusable UI components
│   │   ├── 0_First_Time_UI/     # Onboarding stages
│   │   ├── ActionSheet/
│   │   ├── BottomSheet/
│   │   ├── ButtonMenu/          # Main navigation
│   │   ├── Input/               # Form inputs
│   │   ├── Loaders/
│   │   ├── LoginButtons/        # OAuth buttons
│   │   ├── Modals/
│   │   └── UserContent/         # Content display
│   ├── routes/                   # Screen components (170+ files)
│   │   ├── Login/
│   │   ├── Register/
│   │   ├── Map/                 # Complex geo features (25+ files)
│   │   ├── Areas/               # Nearby, Bookmarked, Drafts
│   │   ├── Connect/
│   │   ├── DirectMessage/
│   │   ├── Groups/
│   │   ├── Achievements/
│   │   ├── Settings/
│   │   └── index.tsx            # Route configuration
│   ├── redux/
│   │   ├── actions/
│   │   │   ├── LocationActions.ts
│   │   │   ├── UIActions.ts
│   │   │   └── UsersActions.ts
│   │   └── reducers/
│   │       └── index.ts         # Extends therr-react reducers
│   ├── styles/
│   │   ├── themes/
│   │   │   ├── light/           # Light theme (default)
│   │   │   └── retro/           # Retro theme
│   │   └── [style modules]
│   ├── utilities/
│   │   ├── getConfig.ts         # Environment config
│   │   ├── pushNotifications.ts # FCM setup
│   │   └── contacts.ts
│   ├── locales/                  # i18n translations
│   ├── constants/
│   ├── App.tsx                   # Root component
│   ├── Layout.tsx                # Main navigation stack
│   ├── getStore.tsx              # Redux store setup
│   ├── socket-io-middleware.ts   # WebSocket
│   └── interceptors.ts           # Axios config
├── android/                      # Android native code
├── ios/                          # iOS native code
├── index.js                      # Entry point
└── package.json                  # RN-specific dependencies
```

## Key Screens

| Screen | Purpose |
|--------|---------|
| Landing | Initial screen |
| Login/Register | Authentication |
| Home | Main feed |
| Map | Location-based discovery |
| Areas | Nearby, Bookmarked content |
| Connect | User discovery |
| DirectMessage | 1-on-1 messaging |
| Groups | Community features |
| Settings | User preferences |

## Key Patterns

### Redux Integration

Extends therr-react with mobile-specific reducers:

```typescript
// main/redux/reducers/index.ts
import getCombinedReducers from 'therr-react/redux/reducers';

const localReducers = {
    location: locationReducer,
    ui: uiReducer,
};
export default getCombinedReducers(socketIO, localReducers);
```

### Theming

Runtime theme switching via Redux:

```typescript
// main/styles/themes/index.ts
// Themes: light (default), retro
// Selected via user.settings.mobileThemeName
```

### Brand Variation Configuration

Currently hardcoded, configuration points for niche apps:

```typescript
// main/socket-io-middleware.ts
brandVariation: BrandVariations.THERR

// main/interceptors.ts
axios.defaults.headers['x-brand-variation'] = BrandVariations.THERR;

// main/Layout.tsx
'x-brand-variation': BrandVariations.THERR,
```

### Navigation

React Navigation 6 with Stack Navigator:

```typescript
// main/routes/index.tsx
// Route-based access control via AccessLevels
// Fade animation transitions
```

### Push Notifications

Firebase Cloud Messaging + Notifee:

```typescript
// main/utilities/pushNotifications.ts
// Android notification channels
// Data-only notifications from FCM
```

## Build & Dev

```bash
# Install dependencies
npm install

# iOS
npm run ios:clean      # Clean iOS build
npx pod-install        # Install CocoaPods
npm run ios            # Run on iOS simulator

# Android
npm run android:clean  # Clean Android build
npm run android        # Run on Android emulator

# General
npm run clean          # Clean all builds
npm run lint:fix       # Fix ESLint issues
npm test               # Run Jest tests
```

## Niche App Setup

When creating a niche app variant (e.g., HABITS):

1. Create branch: `niche/HABITS-general`
2. Run: `npx react-native-rename "NewAppName" -b "com.therr.mobile.NewAppName"`
3. Update brand variation headers in:
   - `main/socket-io-middleware.ts`
   - `main/interceptors.ts`
   - `main/Layout.tsx`
   - `index.js`
4. Update assets (icons, splash screens)
5. Update translations in `main/locales/`

See `docs/NICHE_APP_SETUP_STEPS.md` for full guide.

## Important Notes

- **Isolated deps**: Has own package.json (not root)
- Uses Metro bundler (not Webpack)
- Path aliases in `tsconfig.json` and `babel.config.js`
- Platform-specific code: `*.ios.ts`, `*.android.ts`
- Requires Xcode (iOS) and Android Studio (Android)
- Google Sign-In requires platform-specific OAuth IDs
- Background geolocation for location features

## Code Quality

Before completing code changes, run linting and fix all errors:

```bash
npm run lint:fix   # Auto-fix issues (runs ESLint on main/**)
npm run lint       # Verify no errors remain
```

See root `CLAUDE.md` for full code quality requirements.
