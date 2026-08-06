# Steps to Setup a Niche App

These niche apps are a branch and/or child app of Therr App. The general idea is for a niche app to inherit the core foundations of Therr with unique, niche branding, content filtering specific to that branding, and some simple customizations that are controlled by feature flags.

## Daily switching workflow

Once a niche branch is set up, switching between brands during development is three commands:

```bash
git checkout niche/HABITS-general            # or general, or niche/TEEM-general
./_bin/switch-brand.sh habits                # habits | therr | teem
cd TherrMobile && npm start                  # terminal 1
cd TherrMobile && npm run android:habits     # terminal 2
```

`switch-brand.sh` rewrites `CURRENT_BRAND_VARIATION` in `TherrMobile/main/config/brandConfig.ts` when the target differs, kills any running Metro bundler, and clears Metro caches. It warns (does not block) if the current git branch doesn't match the target brand.

## Multi-app-per-Firebase-project pattern

Niche apps reuse the Therr Firebase project by registering a second Android app with a distinct `applicationId` (e.g. `com.therr.habits`) in Firebase Console. The resulting `google-services.json` contains entries for every registered `applicationId`, so a single file in `TherrMobile/android/app/google-services.json` works across brands on the same device. Gradle selects the correct client entry by `applicationId` at build time. Android `namespace` stays `app.therrmobile` across brands so Kotlin sources don't move.

This pattern is preferred over per-brand Firebase projects for MVP; split into separate projects only if a niche app needs isolated Cloud Messaging quotas, Analytics streams, or Crashlytics dashboards.

## Mobile App Setup (ex. Uses Teem for demonstration)

### Prerequisites

Before setting up the mobile app, you may need to complete the following:

- **Domain Name & Landing Page**: If your niche app requires a dedicated website, landing page, or custom email domain, see Google Drive documentation for instructions on configuring DNS, WordPress, SSL certificates, and AWS SES email identity.

### Configuration Updates (commit to "general" branch)

Add config entries to the following files:

- `therr-public-library/therr-js-utilities/src/constants/enums/Branding.ts`
- `therr-services/push-notifications-service/src/api/firebaseAdmin.ts`
- `therr-services/users-service/src/constants/hostContext.ts`
  - Update the `getHostContext()` function to recognize the host
- `therr-client-web-dashboard/src/utilities/getHostContext.ts`
- `therr-public-library/therr-js-utilities/src/constants/enums/PushNotifications.ts`

### App Renaming

1. Create a new branch from general with format similar to `niche/TEEM-general`
2. Run the following command and replace with your new app name (ex. Teem):
```
   npx react-native-rename "Teem" -b "com.therr.mobile.Teem"
```
3. `npm run android:clean`
4. `npm run clean`
5. Rename `Therr_Debug.xcscheme` and `Therr_Release.xcscheme` to `Teem_Debug.xcscheme` and `Teem_Release.xcscheme` then find and replace occurrences in Podfile
6. Rename `TherrTests-Bridging-Header.h` to `TeemTests-Bridging-Header.h`
7. `npm run ios:clean`
8. Open the project in xcode and wait for it to index then run "clean build". Target the simulator device and try to run the build

### Additional Configuration (commit to "niche" branch)

Add config entries to the following files:

- `TherrMobile/index.js`
- `TherrMobile/main/socket-io-middleware.ts`
- `TherrMobile/main/components/Layout.tsx`
- `TherrMobile`

### Branding & Assets

1. Create new app icons
   - One option is to use npm app-icon https://www.npmjs.com/package/app-icon
   - You could also use Android Studio to create an adaptive icon
2. Import the existing file, `therr-font-config.json` into icomoon and add new icons
3. Look for occurrences of "therr-logo" in the app to replace the logo in the top left corner of the app header. Customize as needed

### Translations & Content

1. Update the translations files and replace occurrences of "Therr" with the new app name
2. Also update the urls to reference the new app website/landing page
3. Search for `therr.app` and replace urls like the link to the privacy policy
4. `TherrMobile/main/routes/Map/EULA.ts` has a hard coded terms of service that should probably be moved to translations
   - Replace "Therr" with new app name
5. `TherrMobile/main/locales/en-us/dictionary.json`
   - Do this for all locales
   - Update verbiage to match branding

### Additional Setup

1. Handle new intent IDs for backend push notifications and app links
   - Ex. `com.therr.mobile.CREATE_YOUR_PROFILE_REMINDER`
2. Add link to associated domains in xcode

## TODO

**NOTE: Untracked git files (maybe deploy only change)**

- `Google-services.json` for Google Cloud api keys that will work with the new bundle identifier
- also `GoogleService-info.plist`
- Find way to implement single sign-on for the new app name/url
- Store user brandVariation and add brandVariation filters to scheduled processes