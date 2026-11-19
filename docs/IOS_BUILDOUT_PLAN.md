# iOS Buildout Plan

Started 2026-11-17. Tracking issue: **#3209**. The tickets are its sub-issues, IOS-01 to IOS-20.

This is the plan for bringing the iOS app back after the RN 0.83 → 0.86.3 upgrade and the
months of Android-only work that followed it. It is the reference future sessions read
before touching `TherrMobile/ios/**`. Update it as tickets land:

- tick the status table
- add each native fix to the build log (§ Build log)
- record decisions where marked

## Order of work

1. **Therr first, on `general`.** `niche/HABITS-general` inherits everything from `general`,
   so every native fix made for Therr reaches Habits on the next merge down.
2. **Then Friends with Habits, on `niche/HABITS-general`.** Habits needs its own bundle
   identity, plus the `general`-side server and web changes that point at it.
3. **Developer account, signing and App Store last.** The one exception is Apple Developer
   membership (IOS-17). Pull it forward only when push or on-device testing is the bottleneck.
   The simulator covers almost all of Phases 1 and 2 without it.

## Where iOS stands (audit, 2026-11-17)

Nothing below was compiled. The audit read the files on `origin/general` and
`origin/niche/HABITS-general`, and the RN 0.86.3 sources. Treat each finding as "very likely",
to be confirmed by IOS-05.

| Area | Finding | Ticket |
|---|---|---|
| Build verification | No CI job compiles the mobile app. `TherrMobile/ios/` was last changed by a merge on 2026-09-16. The iOS half of the 0.86.3 upgrade has never been built | IOS-05, IOS-10 |
| Pods | `Podfile.lock` is at RN 0.86.3 but is missing `RNFBAppCheck`, although `@react-native-firebase/app-check` is a dependency. The niche's lockfile has it, so the branches disagree. The Podfile maps `Therr_Debug`/`Therr_Release` configs that do not exist, and forces `ONLY_ACTIVE_ARCH=NO` on every pod | IOS-03 |
| Ruby toolchain | `Gemfile` pins `cocoapods < 1.15`, but the lockfile was written by 1.15.2. The 0.86.3 template's constraints differ (and add Ruby 3.4 gems) | IOS-01 |
| AppDelegate | Subclasses `RCTAppDelegate`, which is deprecated in 0.86.3. BootSplash is initialized in `createRootViewWithBridge`, which the new-arch `RCTRootViewFactory` path never calls. It only calls `customizeRootView` | IOS-04 |
| Entitlements | The **Debug** configuration has no `CODE_SIGN_ENTITLEMENTS`. `TherrDebug.entitlements` is unused, so Debug builds have no push, no Sign in with Apple and no universal links | IOS-07 |
| Google sign-in | iOS passes the iOS OAuth client as `webClientId` and never sets `iosClientId`. The dev iOS client's reversed-id URL scheme is not in Info.plist (only prod's is) | IOS-07 |
| Brand switching | `_bin/switch-brand.sh` copies the iOS plist to `ios/TherrMobile/`, which does not exist. Xcode reads `ios/GoogleService-Info.plist`. There is no iOS example in `_bin/firebase/` | IOS-02 |
| npm scripts | `ios` has a stray comma and an unneeded bundle step. `ios:clean` deletes a path that exists on one machine. `build:release:ipa` does not archive | IOS-02 |
| Dev networking | `env-config.js` dev uses `localhost` for iOS. That is fine on the simulator, but a phone cannot reach it, and there is no host override | IOS-08 |
| Orientation | iOS allows all four orientations; Android is `portrait` | IOS-06 |
| Android-only native modules | `EdgeToEdge` and `InitialIntent` (general), `HabitsWidget` and `InstallReferrer` (niche), and Play Billing via react-native-iap (niche) are all gated on `Platform.OS === 'android'`. iOS needs either no entry point or its own implementation | IOS-06, IOS-09, IOS-13, IOS-14, IOS-16 |
| App Check | `appCheck.ts` returns no token on iOS. iOS phone sign-in therefore always gets the gateway's strict SMS lane (US/CA, small budget) | IOS-15 |
| Habits identity | The niche branch changes the Android `applicationId` but not `PRODUCT_BUNDLE_IDENTIFIER` (`com.therr.mobile.Therr`), the display name or the associated domains. An iOS Habits build today *is* the Therr app | IOS-11 |
| Push routing | `iosApnsTopic` for HABITS is deliberately Therr's bundle id. The guard test reads `general`'s pbxproj, so it can never see a niche bundle id | IOS-12 |
| Universal links | `apple-app-site-association` serves only Therr's app id, on every host including habits.therr.com | IOS-12 |
| Signing | Release is pinned to manual profiles "Therr App Distribution 5-3-22 / 4-5-24". `eas.json` has no iOS profiles | IOS-18 |
| Versions | Therr iOS is `1.71.0 (213)`; Android is `3.18.0 (462)`. Habits iOS has never had a version | IOS-11, IOS-18 |
| Info.plist hygiene | Privacy-manifest reason keys sit in Info.plist, where they do nothing. 26 `LSApplicationQueriesSchemes`. Background `location` is declared, and Habits has no background location | IOS-19 |
| Apple account | Status unknown. The backlog says "Register Apple Developer account"; #3049 suspects listing `id1569988763` is gone | IOS-17, IOS-20 |

### Facts worth not re-deriving

- RN 0.86.3 requires **iOS 15.1** (`min_ios_version_supported`) and **Xcode ≥ 16.1**. App Store
  uploads need the current SDK (Xcode 26.x). The Podfile already carries an Xcode 26 Folly patch.
- New architecture is on (`RCTNewArchEnabled` in Info.plist). The bridge path is legacy; do not
  add code that depends on `RCTBridge`.
- `use_frameworks! :linkage => :static` is required for Firebase's Swift pods. Keep it.
- `AppDelegate` reads `GOOGLE_APIS_IOS_KEY` through **react-native-config** (`RNCConfig`), not
  react-native-dotenv. An empty key gives a blank map with no error.
- The `react-native+0.86.3.patch` JS hunk (`StyleSheet.absoluteFillObject`) applies to iOS too.
  Its Kotlin hunk does not.
- An iOS simulator can display pushes without an Apple account: drag a `.apns` file onto it,
  or run `xcrun simctl push <device> <bundle-id> payload.apns`. Real APNs delivery needs the
  APNs key in Firebase (IOS-17).
- A free personal signing team cannot sign Push, Sign in with Apple or Associated Domains.
  On-device Debug with real entitlements needs the paid membership.

## Phases and tickets

Status: ☐ open · ◐ in progress · ☑ done. Branch: G = `general`, H = `niche/HABITS-general`.

### Phase 0: dev environment

| ID | Issue | Branch | Status | Summary |
|---|---|---|---|---|
| IOS-01 | #3210 | G | ☐ | Mac toolchain (Xcode, Ruby/CocoaPods), Gemfile aligned to the 0.86.3 template, iOS section in `SECRETS_AND_LOCAL_BOOTSTRAP.md` |
| IOS-02 | #3211 | G | ☐ | Fix `switch-brand.sh` iOS plist path, add an iOS vault example, tidy the `ios*` npm scripts, add `ios:<brand>` aliases |

### Phase 1: Therr on the simulator

| ID | Issue | Branch | Status | Summary |
|---|---|---|---|---|
| IOS-03 | #3212 | G | ☐ | Regenerate Pods (app-check missing), clean up Podfile and pbxproj (Flipper, configs, `ONLY_ACTIVE_ARCH`, Folly patch) |
| IOS-04 | #3213 | G | ☐ | `RCTReactNativeFactory` AppDelegate; BootSplash moved to `customizeRootView` |
| IOS-05 | #3214 | G | ☐ | First green Debug simulator build; record every fix in § Build log |
| IOS-06 | #3215 | G | ☐ | Simulator smoke test (safe areas, keyboard, dialogs, map, permissions, media, orientation) |
| IOS-07 | #3216 | G | ☐ | Debug entitlements; Google and Apple sign-in config per platform and environment |

### Phase 1b: device and push

| ID | Issue | Branch | Status | Summary |
|---|---|---|---|---|
| IOS-08 | #3217 | G | ☐ | Physical iPhone against the local stack (host override, signing per developer, hardware checks) |
| IOS-09 | #3218 | G | ☐ | Push end to end: simulator payloads first, then real APNs once IOS-17 lands |

### Phase 1c: keep it from rotting

| ID | Issue | Branch | Status | Summary |
|---|---|---|---|---|
| IOS-10 | #3219 | G | ☐ | **Decision:** CI job that compiles iOS (recommendation: macOS simulator build, path-filtered) |

### Phase 2: Friends with Habits on iOS

| ID | Issue | Branch | Status | Summary |
|---|---|---|---|---|
| IOS-11 | #3220 | H | ☐ | **Decision:** bundle id (recommendation: `com.therr.habits`). Identity, Firebase iOS app, OAuth client, entitlements, usage strings, new version sequence |
| IOS-12 | #3221 | G | ☐ | **Decision:** how the APNs-topic guard test learns niche bundle ids (recommendation: a committed brand → bundle-id manifest). Per-host AASA. Ships together with IOS-11 |
| IOS-13 | #3222 | H | ☐ | Habits simulator build and smoke test; Android-only features show no dead entry points on iOS |

### Phase 2b: iOS parity features

| ID | Issue | Branch | Status | Summary |
|---|---|---|---|---|
| IOS-14 | #3223 | H + G | ☐ | **Decision:** StoreKit vs. free-tier-only on iOS (recommendation: free-tier-only for the first TestFlight) |
| IOS-15 | #3224 | G (+H) | ☐ | App Attest for App Check, so iOS phone sign-in leaves the strict lane |
| IOS-16 | #3225 | H | ☐ | WidgetKit widget (post-launch; create the App Group with the App ID in IOS-17) |

### Phase 3: Apple Developer, signing, App Store

| ID | Issue | Branch | Status | Summary |
|---|---|---|---|---|
| IOS-17 | #3226 | n/a | ☐ | Membership, App IDs and capabilities, APNs key into both Firebase projects, ASC API key |
| IOS-18 | #3227 | G (+H) | ☐ | **Decision:** EAS vs fastlane (recommendation: EAS). Signing, versioning, TestFlight upload, iOS checks in `/mobile-release-preflight` |
| IOS-19 | #3228 | G + H | ☐ | App Review readiness: privacy manifest, Info.plist, background modes, account deletion, export compliance |
| IOS-20 | #3229 | G + H | ☐ | App Store Connect records and listings, TestFlight beta, iOS badges on the web, email the waitlist (#3049) |

### Dependencies

```
IOS-01 ─┬─> IOS-03 ─┐
IOS-02 ─┘           ├─> IOS-05 ─┬─> IOS-06
         IOS-04 ────┘           ├─> IOS-07 ─> IOS-08 ─> IOS-09 (real APNs needs IOS-17)
                                ├─> IOS-10
                                └─> merge general → niche ─> IOS-11 ─> IOS-13 ─> IOS-14
                                                              └─ IOS-12 (ships with IOS-11)
IOS-17 ─> IOS-15, IOS-18 ─> IOS-19 ─> IOS-20
```

## Branch rules that bite here

- Every native fix to `TherrMobile/ios/**` that is not brand identity lands on **`general`**,
  then merges down. Fixing it only on the niche branch means Therr never gets it, and the next
  merge conflicts.
- Brand identity lands on **`niche/HABITS-general` only**: bundle id, display name, entitlements
  domains, the `GoogleService-Info.plist` choice, usage-string copy, icons, iOS version numbers.
  After every `general` → niche merge, run `/split-branch-prs verify-brand`. That merge is a
  silent fast-forward that can un-brand the app.
- **`Podfile.lock` conflicts between the branches are expected** (Habits drops background-geolocation and
  adds react-native-iap/Nitro). Resolve them by re-running `pod install` on the branch, never by
  picking a side.
- The **push-service and web changes for Habits iOS (IOS-12) are backend/web and land on
  `general`**, timed to ship when Habits iOS builds reach testers. Switching `iosApnsTopic`
  early drops every data-only push to anyone still running Habits JS in the Therr binary.

## Local iOS quickstart (fill in as IOS-01/02 land)

```bash
# once per machine: Xcode 26.x, Ruby ≥ 3.1, Node 24.12 (.nvmrc)
cd TherrMobile
bundle install                                   # CocoaPods from Gemfile (IOS-01)
npm install --legacy-peer-deps                   # needs background-geolocation npm creds for Therr
cp <vault>/GoogleService-Info.plist ios/         # or ../_bin/switch-brand.sh therr (after IOS-02)
echo "GOOGLE_APIS_IOS_KEY=..." >> .env           # read by react-native-config in AppDelegate
cd ios && bundle exec pod install && cd ..
npm start                                        # terminal 1
npm run ios                                      # terminal 2 (Therr_Debug scheme)
```

## Build log

Record every native fix needed to build or run on iOS here: date, pod or file, error, fix, ticket.
This log is what makes the Habits build (IOS-13) and the next RN upgrade quick.

| Date | Component | Error | Fix | Ticket |
|---|---|---|---|---|
| | | | | |

## Decisions

Record each decision with its date and the reason, as the tickets resolve them.

| Decision | Choice | Date | Ticket |
|---|---|---|---|
| Habits iOS bundle id | (recommended `com.therr.habits`) | | IOS-11 |
| APNs-topic guard for niche bundle ids | (recommended committed manifest) | | IOS-12 |
| iOS orientation | (recommended portrait, matching Android) | | IOS-06 |
| iOS CI compile gate | (recommended macOS simulator job) | | IOS-10 |
| Paid features on iOS | (recommended free-tier-only first) | | IOS-14 |
| Build/submit pipeline | (recommended EAS) | | IOS-18 |
| Therr iOS marketing version | (recommended adopt Android's 3.x) | | IOS-18 |

## Related

- `TherrMobile/CLAUDE.md`: module resolution, patches, edge-to-edge, push
- `docs/MULTI_BRAND_ARCHITECTURE.md`, `docs/NICHE_APP_SETUP_STEPS.md`
- `docs/APP_CHECK.md`: read before IOS-15
- `docs/SECRETS_AND_LOCAL_BOOTSTRAP.md`: gains an iOS section in IOS-01
- `docs/WORK_IN_PROGRESS.md` § iOS buildout (#3209) and § iOS demand tracking (#3049)
- Skills: `/mobile-dep-guard` after any pod or npm change, `/mobile-crash-guard` after `main/**`
  changes, `/split-branch-prs` for every general → niche hop, `/push-notification-guard` for IOS-09/12
