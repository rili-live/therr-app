# React Native New Architecture Migration Plan (Android)

**Created:** April 2026
**Status:** Planning
**Branch:** `claude/react-native-architecture-plan-K8wbh` (based on `general`)
**Target:** `TherrMobile` — Android first, iOS as parallel follow-up

---

## Problem Statement

`TherrMobile` is on React Native 0.80.0 but still runs the legacy bridge-based architecture (`newArchEnabled=false` in `TherrMobile/android/gradle.properties`). RN 0.80 ships with the New Architecture (Fabric renderer + TurboModules + Bridgeless mode) as the forward-default; the legacy bridge is deprecated. Remaining on legacy means:

- Blocks future RN upgrades (0.81+ signals drop legacy support for some subsystems).
- Forfeits startup, rendering, and memory improvements already landed in Fabric.
- Prevents adoption of Fabric-only libraries (e.g. modern keyboard, list, and media libs).
- Will eventually break when RN removes the legacy interop path entirely.

## Goal

Ship a clear, **incremental, non-disrupting** path to turn on the New Architecture for the Android build, validate it in staging, and promote it to production — while cataloging every dependency that blocks the upgrade and estimating effort to clear each blocker.

---

## Current State (on `general`)

| Item | Value |
|---|---|
| React Native | 0.80.0 |
| React | 19.1.0 |
| Hermes | enabled |
| `compileSdk` / `targetSdk` | 35 |
| Kotlin | 2.0.21 |
| Android Gradle Plugin | 8.9.0 |
| NDK | 28.0.13004108 |
| `newArchEnabled` (Android) | **`false`** |
| iOS `RCT_NEW_ARCH_ENABLED` | unset |
| Custom native modules | **none** (every native dep is autolinked) |
| `MainApplication.kt` / `MainActivity.kt` | already uses `DefaultReactNativeHost`, `DefaultReactHost`, `DefaultReactActivityDelegate`, and references `BuildConfig.IS_NEW_ARCHITECTURE_ENABLED` |
| Metro / Babel | on `@react-native/{metro-config,babel-preset}@0.80.0`; `react-native-reanimated/plugin` is last in Babel chain |
| Proguard | already keeps `com.facebook.react.turbomodule.**` |

**Implication:** the host app is architecturally ready. The work is **dependency hygiene**, not native-code rewrites.

---

## Dependency Audit

Categorized by risk level based on `TherrMobile/package.json` at `general` and upstream state as of April 2026.

### Tier A — Blockers (abandoned / unmaintained / no New-Arch path)

These libraries cannot be brought into New Arch without replacement; the RN 0.80 interop layer will not save them because they either crash under Bridgeless or render nothing under Fabric.

| Package | Installed | Status | Replacement | Effort |
|---|---|---|---|---|
| `react-native-snap-carousel` | 3.9.1 | Archived since 2022 | `react-native-reanimated-carousel` | **M** — ~3–6 carousels; rewrite `renderItem`/`sliderWidth`/`itemWidth` → `width`/`data`/`renderItem` |
| `react-native-navigation-bar-color` | 2.0.1 | Unmaintained; incompatible with edge-to-edge | `react-native-edge-to-edge` + `StatusBar`/`SystemBars` APIs | **M** — audit every screen that tints nav bar |
| `react-native-animated-loader` | 0.0.8 | Abandoned (last release 2019) | `lottie-react-native` direct (already installed) | **S** — ~1 component |
| `react-native-keyboard-aware-scroll-view` | 0.9.5 | Unmaintained; broken under Fabric | `react-native-keyboard-controller` | **M-L** — widely used in forms; worst case ~20 screens |
| `react-native-android-location-services-dialog-box` | 2.8.2 | Abandoned | `LocationServices.getSettingsClient` via small TurboModule or `react-native-permissions` flow | **M** |
| `react-native-phone-input` | 1.3.6 | Unmaintained (last release 2021) | `react-native-phone-number-input` | **S-M** |
| `react-native-modal-overlay` | 1.3.1 | Abandoned | built-in `Modal` or `react-native-modal` | **S** |

### Tier B — Major-version upgrades required

New-Arch-compatible release exists but requires a major upgrade with breaking API changes.

| Package | Installed | Target | Effort |
|---|---|---|---|
| `react-native-webview` | ^11.26.1 | ^13.16+ | **L** — two majors of API drift; audit every webview route (OAuth, help, embeds, YouTube) |
| `react-native-vector-icons` | ^9.2.0 | ^10.3 | **S** — subpath imports still work (deprecated); zero source edits |
| `react-native-permissions` | ^3.10.1 | ^5.5 (v4 line has been superseded on npm) | **M** — permission constants reorganized; two majors of API drift |
| `react-native-linear-gradient` | ^2.8.3 | _stay on 2.8.3_ — latest stable; 3.0 is beta only | **n/a** |
| `react-native-haptic-feedback` | ^1.14.0 | ^2.2 (v3 is maintainer-labeled "pre-release battle testing") | **S** — default import + `.trigger()` unchanged |
| `react-native-date-picker` | ^4.4.2 | ^5.0 | **S-M** |
| `react-native-geolocation-service` | ^5.3.0 | ^5.3.1 (patch bump) | **XS** — deeper evaluate-swap task deferred |
| `react-native-image-crop-picker` | ^0.41.6 | ^0.51 (partial New Arch; iOS stronger than Android) | **M** — smoke-test avatar + moment upload |

### Tier C — Already compatible (may need minor bumps)

`react-native-reanimated` 3.16.7 · `react-native-gesture-handler` 2.30.0 · `react-native-screens` 4.5.0 · `react-native-safe-area-context` 5.1.0 · `react-native-svg` 15.12.0 · `@shopify/flash-list` 1.8.3 · `react-native-pager-view` 6.9.1 · `lottie-react-native` 7.3.5 · `@react-native-async-storage/async-storage` 1.24.0 (→ 2.x recommended) · `@react-native-community/netinfo` 12.0.1 · `@react-native-community/slider` 5.1.2 · `@react-native-masked-view/masked-view` 0.3.2 · `@react-native-picker/picker` 2.11.4 · `@react-native-clipboard/clipboard` 1.16.3 · `react-native-maps` 1.20.1 · `react-native-keychain` 9.2.0 · `react-native-device-info` 10.14.0 · `react-native-background-geolocation` 4.19.3 · `react-native-background-fetch` 4.2.8 · `react-native-contacts` 8.0.10 · `react-native-blob-util` 0.19.11 · `react-native-bootsplash` 6.3.11 · `react-native-actions-sheet` 0.9.8 · `@notifee/react-native` 7.9.0 · `@react-native-firebase/*` 21.6.1 · `@react-native-google-signin/google-signin` 16.1.2 · `@invertase/react-native-apple-authentication` 2.5.0 · `@logrocket/react-native` 1.59.4 · `react-native-config` 1.6.1 · `react-native-spotlight-tour` 3.0.1

### Tier D — JS-only (no native code; no direct risk)

`react-native-paper` · `@react-navigation/*` · `react-native-tab-view` · `react-native-toast-message` · `react-native-country-picker-modal` · `react-native-autolink` · `react-native-map-link` · `react-native-youtube-iframe` (wraps webview) · `react-native-dotenv`

---

## Major Blockers — Level of Effort

1. **`react-native-snap-carousel`** — _Medium._ Drop-in replacement `react-native-reanimated-carousel` uses Reanimated 3 (already installed). ~6 call sites; no native code required.
2. **`react-native-keyboard-aware-scroll-view`** — _Medium-Large._ `react-native-keyboard-controller` has a compat component, but custom offset math and `getNode()` references must be removed. Worst case ~20 screens (login/signup/profile/messaging).
3. **`react-native-webview` v11→v13** — _Revised: Small._ Despite two major versions, the actual call sites (OAuthModal, UserMedia) only use stable props. No source edits needed. **Done** on `rn-newarch/webview-13`.
4. **`react-native-navigation-bar-color`** — _Medium._ Android 15 (target SDK 35) enforces edge-to-edge; this package is a dead-end. Adopt `react-native-edge-to-edge` and move color logic into status/nav bar theming hooks.
5. **`react-native-image-crop-picker`** — _Revised: Small._ v0.51 is API-compatible; `didCancel`/`errorCode` checks in Edit screens are no-ops in both versions. **Done** on `rn-newarch/image-crop-picker-051`. Still needs on-device QA for Android Photo Picker UX change (v0.42+).
6. **`react-native-background-geolocation`** — _Small–Medium._ Transistorsoft's lib supports New Arch on 4.19+, but it is the most complex native integration in the app. Risk is behavioral regressions, not compile failures. Exercise on a physical device with app-kill scenarios before flipping the flag in staging.

Everything else in Tier B is **Small-to-Medium** effort — one PR per upgrade with a short smoke test.

---

## Incremental Implementation Plan

**Strategy:** don't flip `newArchEnabled` until every Tier A blocker is replaced and every Tier B lib is on a New-Arch-ready major. RN 0.80's Interop Layer is real but leaky for complex libs — we'll rely on it only for remaining Tier C libs during validation.

### Phase 0 — Branch setup & baseline (0.5 day)

1. Rebase work branch onto `origin/general` (done).
2. Capture baseline performance on a physical Android device (cold start, Home→Map nav, list scroll FPS) via `adb shell dumpsys gfxinfo` + LogRocket session.
3. Document current APK size from a release build.
4. Create this tracking doc.

### Phase 1 — Dependency hygiene: Tier B upgrades ✅ COMPLETE

All Tier B upgrades are on separate branches off `general`, ready for review/merge:

| # | Library | Branch | Status | Source edits |
|---|---|---|---|---|
| 1 | `react-native-haptic-feedback` 1 → 2.2 | `claude/react-native-architecture-plan-K8wbh` | ✅ done | none |
| 2 | `react-native-vector-icons` 9 → 10.3 | `claude/react-native-architecture-plan-K8wbh` | ✅ done | none |
| 3 | `react-native-geolocation-service` 5.3.0 → 5.3.1 | `claude/react-native-architecture-plan-K8wbh` | ✅ done | none |
| 4 | `react-native-linear-gradient` | — | _skipped_ — already on latest stable (2.8.3); 3.0 is beta | — |
| 5 | `react-native-date-picker` 4 → 5.0.13 | `rn-newarch/date-picker-5` | ✅ done | none |
| 6 | `react-native-permissions` 3 → 5.5 | `rn-newarch/permissions-5` | ✅ done | Podfile: replaced manual Permission-* pods with setup_permissions; removed HEADER_SEARCH_PATHS workaround |
| 7 | `react-native-image-crop-picker` 0.41 → 0.51 | `rn-newarch/image-crop-picker-051` | ✅ done | none |
| 8 | `react-native-webview` 11 → 13.16 | `rn-newarch/webview-13` | ✅ done | none |

**Key finding:** The original plan estimated webview as "Large" effort and image-crop-picker as "Medium," but thorough API audit showed all call sites use only stable, unchanged props — no JS/TS source edits required for any upgrade.

**Merge order:** Items 1-3 land via the main tracking branch. Items 5-8 are independent branches that can merge to `general` in any order. The only branch with Podfile changes is `rn-newarch/permissions-5`.

**After merging all Phase 1 branches**, the developer must run:

```bash
cd TherrMobile && npm install --legacy-peer-deps
cd ios && rm -rf Pods && bundle exec pod install
npm run android:clean && npm run android
```

QA checklist: login, OAuth flow (Instagram/Facebook), map, create moment (with photo + crop), event date picker, send message, push notification, embedded media content, YouTube playback.

### Phase 2 — Tier A blocker replacements (in progress)

| # | Library | Status | Notes |
|---|---|---|---|
| 1 | `react-native-animated-loader` → `lottie-react-native` | ✅ done | EarthLoader.tsx rewritten; Map/index.tsx updated |
| 2 | `react-native-modal-overlay` → built-in `Modal` | ✅ done | Map overlay replaced with `Modal` + `Pressable` backdrop |
| 3 | `react-native-phone-input` | ✅ reclassified | JS-only (no native code), not a New Arch blocker |
| 4 | `react-native-snap-carousel` | ✅ removed | Not imported anywhere — was dead code |
| 5 | `react-native-navigation-bar-color` | ✅ removed | All usages were commented out — dead code |
| 6 | `react-native-keyboard-aware-scroll-view` → `react-native-keyboard-controller` | ✅ done | 21 files updated to import from `react-native-keyboard-controller` (same `KeyboardAwareScrollView` component name). App root wrapped with `<KeyboardProvider>` in `App.tsx`. Package override removed. |
| 7 | `react-native-android-location-services-dialog-box` → `Linking.sendIntent` | ✅ done | `requestLocationServiceActivation.ts` now uses `Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS')`; the existing `locationProviderStatusChange` listener in `Layout.tsx` picks up the new GPS state on return. `{ status, alreadyEnabled }` return shape preserved so all six call sites work unchanged. Behavioral change: user leaves app briefly to toggle GPS. |

### Phase 3 — Enable New Architecture for Android dev build only (2–3 days)

1. Add a `-PnewArchEnabled=true` Gradle override path (or dev-only product flavor) so engineers can opt in without affecting CI release builds. Document in `TherrMobile/CLAUDE.md`.
2. Flip `newArchEnabled=true` locally; run `./gradlew :app:assembleDebug` and fix codegen failures.
3. Regenerate codegen artifacts (`npx react-native codegen`) or rely on the Gradle hook.
4. Launch; touch every primary surface (feed, map, moments, messages, notifications, profile, settings). File a sub-issue per runtime bug.
5. Metro config: add `config.transformer.unstable_allowRequireContext = true` if codegen needs it; verify blocklist does not exclude `android/app/build/generated/source/codegen/...`.

#### Phase 3 status (2026-04-17)

- ✅ **Step 2 — Build with `newArchEnabled=true`:** `./gradlew :app:assembleDebug -PnewArchEnabled=true` succeeds (clean 6m 13s, incremental 1m 18s). Initial attempt failed with 29 `cannot find symbol NativeGoogleSigninSpec` errors in `@react-native-google-signin/google-signin@16.1.2`; a clean rebuild (`./gradlew clean` + removing `node_modules/@react-native-google-signin/google-signin/android/build`) resolved it — the codegen output directory just wasn't on the compile classpath during the initial run.
- ✅ **Step 2.1 — FileProvider authority conflict resolved** (commit `a78c51f2`): `react-native-blob-util` and `react-native-image-crop-picker` both declared `android:authorities="${applicationId}.provider"`. On Android 16 (API 36) this escalated from a warning to blocking activity registration (launcher got `Error type 3 — Activity class does not exist`, `am start` returned `START_CLASS_NOT_FOUND`). Fix: suppress image-crop-picker's provider via `tools:node="remove"` in `AndroidManifest.xml`; its runtime calls to `FileProvider.getUriForFile(..., packageName + ".provider", ...)` transparently resolve to blob-util's provider, whose `provider_paths` already cover the `getExternalFilesDir(DIRECTORY_PICTURES)` temp-file location.
- ✅ **Step 2.2 — GPS status sync regression fixed** (commit `de0085d1`): Phase 2 Tier A #7 removed `react-native-android-location-services-dialog-box`, which was the native emitter of `DeviceEventEmitter.locationProviderStatusChange`. Without it, Redux `isGpsEnabled` never refreshed when the user toggled GPS in Settings and returned. Fix: wire `BackgroundGeolocation.onProviderChange` (already subscribed but only logging per existing TODO) to dispatch `updateGpsStatus('enabled'|'disabled')`; drop the dead `DeviceEventEmitter` listener and import.
- ⛔ **Step 4 — Runtime crash under `newArchEnabled=true`:** With the manifest conflict fixed, FileProvider + SpaceEdit image upload verified on Android 16, and MMKV upgraded to v3 (`^3.3.3` for TurboModule support), the app still SIGABRTs at launch before rendering. Diagnosis:
  - MMKV v3 **is initializing successfully** — logcat confirms `RNMMKV : Creating MMKV instance "therr-storage"... (Path: , Encrypted: false)` on post-rebuild installs.
  - Native crash stack: `com.horcrux.svg.VirtualViewManager.createViewInstance` (class-verification failure during Fabric view-manager instantiation).
  - Preceded by a concerning Reanimated JNI warning: `CheckJNI: method to register "installJSIBindings" not in the given class (libreanimated.so)`.
  - Installed versions at time of test: `react-native-svg@^15.12.0` (latest: 15.15.4), `react-native-reanimated@^3.16.7` (RN 0.80 + new arch officially wants 3.17+ with `react-native-worklets` installed separately).
- ⏸️ **Decision (2026-04-17): revert Phase 3 flip.** `newArchEnabled` is restored to `false` in `gradle.properties`; MMKV is rolled back to `^2.12.2`. FileProvider + GPS-sync fixes remain on the branch as Phase 2 cleanup (they're legacy-arch safe). Re-attempting Phase 3 requires clearing the blockers below first.

#### Phase 3 blockers to resolve before re-flipping

1. ✅ **`react-native-svg` 15.12.0 → 15.15.4.** Fixed the `VirtualViewManager` class-verification SIGABRT. However, Fabric ViewManagerPropertyUpdater now emits ~30 `Could not find generated setter for class com.horcrux.svg.RenderableViewManager$*Manager` warnings at startup — non-fatal, but indicates svg's view managers aren't fully on Fabric yet. Deferred: evaluate later whether to raise with the svg maintainers or accept as a warning.
2. ⚠️ **`react-native-reanimated` 3.16.7 → 3.19.5.** The assumption that 3.17 split worklets into a separate npm package turned out to be wrong for the 3.x line — reanimated 3.19.5 (latest 3.x stable) still bundles worklets internally (see `node_modules/react-native-reanimated/android/build.gradle` targets). The split happens in reanimated 4.x, which also bumps the required RN peer range. **Do not install `react-native-worklets` separately** — the current published `react-native-worklets@0.8.1` requires `react-native: 0.81 - 0.85` and is incompatible with RN 0.80. Upgrading to 3.19.5 alone should clear the `installJSIBindings` JNI warning seen on 3.16.7.
3. ⚠️ **`react-native-mmkv` 2.12.2 → 3.3.3 → back to 2.12.2.** Upgraded to v3 for TurboModule support, but **v3 is new-arch-only**: when `newArchEnabled=false`, `MmkvPlatformContextModule.java` fails to compile (`cannot find symbol: class NativeMmkvPlatformContextSpec` — that spec is only emitted by codegen when new arch is on). Since we've reverted the flag, MMKV must stay on v2 until Phase 3 actually lands. Rolled back to `^2.12.2`; `SecureStorage.ts` usage is v2/v3 compatible so no source changes needed either direction.
4. ⛔ **NEW — `react-native-screens` Fabric assertion (2026-04-17 re-attempt, Option A tried):** With svg/reanimated/mmkv upgraded, compileSdk bumped 35 → 36, screens upgraded to `^4.24.0`, and `newArchEnabled=true`, the app still SIGABRTs at launch with:
   ```
   RNSScreenComponentDescriptor.h:54: function adopt: assertion failed
       (dynamic_cast<const RNSScreenProps *>( screenShadowNode.getProps().get()))
   ```
   Crash stack: `libappmodules.so!ConcreteComponentDescriptor<RNSScreenShadowNode>::createShadowNode` → `RNSScreenComponentDescriptor::adopt` → `react_native_assert_fail`. Root cause analysis:
   - **Duplicate RTTI across shared libraries.** The screens build produces `libreact_codegen_rnscreens.so` (from `node_modules/react-native-screens/android/src/main/jni/CMakeLists.txt`, which compiles both the codegen `Props.cpp/ShadowNodes.cpp` and the custom `common/cpp/**/*.cpp`). Meanwhile, RN 0.80's autolinking pipeline includes `<rnscreens.h>` into `libappmodules.so` (via `autolinking.cpp:201`), which forces `libappmodules.so` to also instantiate the `RNSScreenComponentDescriptor` / `RNSScreenProps` templates from the header. Both libraries end up with their own RTTI `type_info` for `RNSScreenProps`. On Android with `-fvisibility=hidden` defaults, `dynamic_cast` across .so boundaries then fails even when the object's runtime type is in fact `RNSScreenProps`. This is a build-system issue inside react-native-screens' RN 0.80 support, not an app bug.
   - **React Navigation 6 JS stack hits the crash immediately** because its `MaybeScreen` shim (`node_modules/@react-navigation/stack/lib/module/views/Screens.js`) renders `Screens.Screen`, which is the component name `RNSScreen` that triggers the failing descriptor on first render.
   - Tried and confirmed not-the-fix: compileSdk 35 → 36, screens 4.23 → 4.24, full `android/app/.cxx app/build .gradle build` clean + APK uninstall + fresh codegen on every attempt.

   **Decision (2026-04-17):** `newArchEnabled` reverted to `false`. Kept on the branch: svg 15.15.4, reanimated 3.19.5, screens 4.24.0, compileSdk/buildTools 36 (all safe on legacy arch). Rolled back: mmkv to 2.12.2 (v3 doesn't build on Paper). Phase 3 retry requires one of:
   - **Option A — React Navigation 7 + native-stack (recommended for retry).** RN7's `@react-navigation/native-stack` uses `<ScreenStack>`/`<Screen>` in the composition screens 4.x is actively tested with; the JS-stack `MaybeScreen` codepath is what screens maintainers have called out as under-exercised on Fabric. Scope: ~1–2 days, touches every `createStackNavigator` call.
   - **Option B — Patch react-native-screens CMakeLists to stop building `libreact_codegen_rnscreens.so` as SHARED.** Convert it to an `OBJECT` library linked into `libappmodules.so`, so RTTI lives in one place. Requires a `patches/react-native-screens+4.24.0.patch`; upstream fix would be preferable.
   - **Option C — Wait for a react-native-screens release that addresses RN 0.80 + new-arch Fabric RTTI across library boundaries.** Track [software-mansion/react-native-screens](https://github.com/software-mansion/react-native-screens/issues) for the assertion signature.

5. ✅ **Dependency upgrades kept** (legacy-arch safe):
   - `react-native-svg`: 15.12.0 → 15.15.4 (fixes the Paper `VirtualViewManager` class-verification crash too)
   - `react-native-reanimated`: 3.16.7 → 3.19.5 (eliminates the Paper `installJSIBindings` JNI warning)
   - `react-native-screens`: 4.5.0 → 4.24.0 (Paper code-path unchanged; bug only manifests on Fabric)
   - `compileSdkVersion` / `buildToolsVersion`: 35 / 35.0.0 → 36 / 36.0.0 (required by screens 4.24; `targetSdk` held at 35 so runtime behavior is unchanged)
6. **Full Phase 3 smoke pass** (boot/render, login email+Apple+Google, feed, map, create moment with photo + crop, messaging, notifications, profile, settings, keyboard in forms, modals) is the exit criterion for any future `gradle.properties` flip.

### Phase 4 — Stabilize on New Architecture (1–2 weeks)

1. Fix Fabric-layout regressions — common culprits: shadow styles, `position:absolute` children of `FlatList` rows, custom text measurement.
2. Validate Reanimated worklets (layout animations, shared-element transitions in Feed).
3. Validate `react-native-background-geolocation` on a physical device across app-kill scenarios.
4. Validate push path: `@notifee/react-native` + `@react-native-firebase/messaging` cold-start deep linking.
5. Profile and compare against Phase 0 baselines.

### Phase 5 — Staging rollout (1 week)

1. Flip `newArchEnabled=true` permanently in `TherrMobile/android/gradle.properties` on `general`.
2. Merge `general` → `stage` to trigger CI build phase; install staging APK on QA devices.
3. Full regression on two+ physical devices (one low-end, one recent).
4. Monitor LogRocket + Crashlytics for 3–5 days.

### Phase 6 — Production rollout (1 week)

1. Merge `stage` → `main` to trigger deploy.
2. Play Store staged rollout 10% → 50% → 100%, ≥48h between steps.
3. Watch Crashlytics for New-Arch-specific signatures (`FabricUIManager`, `TurboModuleManager`).
4. Rollback path: keep a Phase-2-final tag (legacy arch, all deps upgraded) to ship a hotfix with `newArchEnabled=false` without reverting dep upgrades.

### Phase 7 — iOS (parallel-track candidate, out of scope for this plan)

iOS host code is already New-Arch-ready. Enable via `RCT_NEW_ARCH_ENABLED=1 bundle exec pod install` once Android is stable. iOS-specific risks: `@invertase/react-native-apple-authentication`, `react-native-image-crop-picker` photo library permissions, Firebase pod constraints.

---

## Critical Files

- `TherrMobile/android/gradle.properties` — flip `newArchEnabled`
- `TherrMobile/android/app/build.gradle` — product flavors for dev opt-in (Phase 3)
- `TherrMobile/android/app/src/main/java/app/therrmobile/MainApplication.kt` — already ready
- `TherrMobile/android/app/src/main/java/app/therrmobile/MainActivity.kt` — already ready
- `TherrMobile/package.json` — Tier A + B dependency updates
- `TherrMobile/metro.config.js` — possible codegen output adjustments
- `TherrMobile/babel.config.js` — verify Reanimated plugin ordering after any upgrade
- `TherrMobile/CLAUDE.md` — document dev-build opt-in and rollback

## Existing Utilities to Reuse

- Lottie wrapper use cases already exist inside `TherrMobile/main/components/` — reuse these when replacing `react-native-animated-loader`.
- Notification / haptic call sites flow through `TherrMobile/main/utilities/` — upgrade call signatures there rather than at every leaf.
- The brand-variation header pattern (`parseHeaders` / `CURRENT_BRAND_VARIATION`) in `therr-js-utilities` stays untouched — this migration does not cross the brand-variation boundary.

## Verification

End-to-end checklist run at the end of Phase 4, Phase 5, and Phase 6:

1. **Build:** `./android/gradlew -p TherrMobile/android :app:assembleDebug` and `:app:assembleRelease` both succeed with `newArchEnabled=true`.
2. **Type/lint:** `npx tsc --noEmit -p TherrMobile/tsconfig.json` and `npx eslint TherrMobile/main` zero errors.
3. **Smoke tests on physical Android:** login (email + Apple + Google), view feed, open map, drop a moment (with photo + crop), send a message, receive a push (warm + cold), enter/leave a geofence, edit profile, sign out.
4. **Performance:** cold start ≤ baseline + 5%, list scroll FPS ≥ baseline.
5. **Regression monitoring:** 72h clean Crashlytics window post-staging rollout before production promotion.
6. **Rollback rehearsal:** confirm a single-line revert of `newArchEnabled=true` → `false` produces a working build on the same commit.
