# AR Navigation — Phone AR and Android XR

**Status:** Deprioritized future project. No code exists yet.
**Written:** 2026-09-25
**Audience:** A future coding session picking this up to start building.
**Lands on:** `general`. The map is core Therr, and every file below is shared code (see § Branch placement).

## Goal

A user taps a marker (space, moment, event) on the map and picks **"View in AR"**. The camera
view opens with a 3D arrow floating in front of them. The arrow points toward the marker and
shows the live distance to it. It updates as they walk and turn, and says when they have
arrived.

It ships in two tiers:

1. **Phone AR.** Android phones with ARCore, using ViroReact. This is the first shippable piece.
2. **Android XR.** Headsets such as Galaxy XR. A native Jetpack XR activity reuses the same
   bearing and target logic but renders through the XR SDK.

It **complements** the existing "Get directions" handoff (`TherrMobile/main/utilities/getDirections.ts` →
`react-native-map-link`). It does not replace it. AR answers "which way, and how far"
for the last few hundred metres. Turn-by-turn routing stays with Google Maps.

## Non-goals

- Turn-by-turn routing or street-following paths. The arrow points in a straight line, as the crow flies.
- Pinning a 3D marker to an exact spot on the sidewalk from GPS alone. GPS drifts 3–10 m, so the pin
  would visibly wobble. See § Accuracy.
- iOS. ViroReact supports ARKit, so iOS is a later, cheap add-on, but it is out of scope here.
- Web.

## Decisions already made

| Question | Decision | Why |
|---|---|---|
| Fullscreen HUD or split screen with the live map? | **Phone: fullscreen AR** with a small 2D chip showing distance and a compass, plus a "Back to map" button. **Headset: split**, with the map as a separate spatial panel beside the arrow. | Running `react-native-maps` (a GL surface) under a live ARCore camera surface costs a lot of GPU and battery on phones. On a headset, panels are cheap and a map beside you is the native pattern. |
| AR engine on phones | **ViroReact, `@reactvision/react-viro`** | This is the maintained fork. The old `@viro-community/react-viro` name in early write-ups is dead. It requires the New Architecture, which we already have enabled. |
| AR engine on headsets | **Jetpack XR SDK** (SceneCore + ARCore for Jetpack XR), in a native Kotlin activity | ViroReact drives a phone-style ARCore camera session. Android XR headsets render passthrough through the system and use a different API surface, so ViroReact is not expected to work there. The first spike must confirm this. |
| 3D asset format | **GLB** (glTF binary), not OBJ/MTL | It is one file, Viro and SceneCore both load it, and it is smaller. Use a CC0 arrow (Kenney or Poly Pizza) or model one in Blender, and keep it under 200 KB. |
| ARCore install mode | **AR Optional**, never AR Required | AR Required hides the whole app on Play from every phone and headset that lacks ARCore. See § Play Store. |

## Architecture

```
Map (react-native-maps)           Shared core (pure TS)                Renderers
─────────────────────────         ──────────────────────────          ─────────────────────────────
marker tap → target {lat,lng,  →  getBearingDegrees()          →   Phone: ARNavigation route
  title, id, type}                getDistanceInMeters() (exists)       ViroARSceneNavigator + GLB arrow
                                  useARNavigationTarget() hook     Fallback: 2D compass HUD (no ARCore)
Geolocation.watchPosition    →    heading smoothing, arrival       Headset: XR activity (Kotlin)
Compass heading              →    threshold, relative angle            via a native module bridge
```

### 1. Math: `therr-js-utilities`

- Add `src/location/get-bearing.ts` next to the existing `get-distance.ts`, and export it from
  `src/location/index.ts`. It is isomorphic and has no dependencies. Match `get-distance.ts`: return `NaN` for non-finite input.
- The initial great-circle bearing formula (atan2 of `sin Δλ·cos φ2` over
  `cos φ1·sin φ2 − sin φ1·cos φ2·cos Δλ`), normalized to `[0, 360)`.
- Add `normalizeRelativeAngle(targetBearing − deviceHeading)` → `(-180, 180]`. Every renderer consumes this.
- Unit tests with known city-pair bearings. Include the antimeridian, both poles, and the case where the user is on top of the target.
- **Reuse `getDistanceInMeters`** from the same module. Do not add a second Haversine.

### 2. Sensors and state: `TherrMobile`

- **Location.** `react-native-geolocation-service` is already installed and the Map route already
  calls `watchPosition` (`TherrMobile/main/routes/Map/index.tsx`). The AR screen starts its own
  high-accuracy watch while it is mounted, clears it on unmount, and ignores any fix with `accuracy > 30 m`.
- **Heading.** You need true-north heading. Options, in order of preference:
  1. The ARCore Geospatial API, if the ViroReact version exposes it. It gives VPS-corrected heading and
     position, which also fixes the GPS drift problem. Check the ReactVision changelog for geospatial support.
  2. A small compass module such as `react-native-compass-heading`, which is maintained and backed by the rotation vector.
     Avoid `react-native-sensors`: its raw magnetometer needs tilt compensation done by hand.
- **Calibrate once, then let AR track.** Do not rotate the arrow on every magnetometer tick,
  because it jitters. At session start, record `heading0`. The world-frame yaw of the arrow is then
  `bearing − heading0`, and ARCore's own 6DoF tracking handles the user turning. Re-anchor only
  when the compass and the AR yaw drift apart by more than about 15°, or when the user moves more than about 20 m.
- **Sign convention.** Viro and SceneCore both use a right-handed frame with Y up and −Z forward, so a
  positive Y rotation turns counter-clockwise. Compass bearings go clockwise, so the yaw is **negated**.
  The early write-up this plan came from used `+(bearing − heading)`. Confirm on a device in the
  Phase 0 spike, then lock it in with a test.
- **`useARNavigationTarget(target)` hook.** It owns the location watch, the heading, `distance`,
  `relativeAngle`, `accuracy` and `hasArrived` (under 15 m for 3 consecutive fixes). It is a
  functional hook with no Redux slice. The state is screen-local and short-lived.

### 3. Phone AR renderer

- **New route `ARNavigation`**, registered in `TherrMobile/main/routes/index.tsx` with params
  `{ latitude, longitude, title, areaId, areaType }`. Write it as a functional component. Do **not**
  grow the class-based `Map/index.tsx`.
- **Entry points.** Show them only where `isARNavigationAvailable()` is true:
  - the map marker preview (`components/BottomSheet/MapBottomSheetContent.tsx` preview strip),
  - the `ContentOptionsSheet` action list, next to `getDirections` (`contentType === 'area'`),
  - `ViewSpace` / `ViewEvent` headers, optionally.
- **Scene.** `ViroARSceneNavigator` → `ViroARScene` → an ambient light and a `ViroNode` about 2 m ahead
  and slightly below eye level, holding the GLB arrow (`Viro3DObject type="GLB"`) and a `ViroText`
  distance label. Scale the arrow down as the user gets closer. When they arrive, swap to a
  "You're here" state and give haptic feedback.
- **HUD overlay.** Plain React Native views sit on top of the scene. They show the distance chip, a
  GPS-accuracy warning while `accuracy` is poor, "Back to map", and the safety banner.
- **Fallback when ARCore is unavailable or declined.** Show the same screen without the AR scene:
  a 2D arrow rotated by `relativeAngle` over a plain background. It needs no camera permission. This is also what
  headsets get until Phase 4 lands.
- **Permissions.** Use the existing `utilities/permissionsOrchestrator.ts` and `requestOSPermissions.ts`,
  and add an `'arNavigation'` trigger. The screen needs `CAMERA` and `ACCESS_FINE_LOCATION`. Both are already in
  the manifest. Ask only when the user taps "View in AR", never on launch.
- **Safety.** On first use, show an interstitial telling the user to stay aware of their surroundings.
  If a speed above about 7 m/s suggests the user is driving, pause AR and show the 2D fallback.
- **Locales.** Every new string goes in `en-us`, `es` and `fr-ca` (`npm run locales:check`).

### 4. Android XR renderer (headsets)

Read this first: the Galaxy XR is an indoor, seated or standing device and is **not expected to have GPS**.
Verify that. Walking navigation with a headset on is not a real use case. On XR, this feature
becomes **"spatial preview"**: a spatial map panel with the selected space, the bearing and the distance from the user's
**home or last phone location**, and an optional immersive 3D preview of the place. Walking AR
navigation on Android XR belongs to **display glasses**, and Play cannot distribute to those yet (see § Play Store).

- Build a native Kotlin `XrNavigationActivity` in `TherrMobile/android/app/src/main/java/...`, using
  Jetpack Compose for XR (`Subspace`, `SpatialPanel`) and SceneCore for the GLB arrow.
- A small TurboModule, `XrNavigationModule`, exposes `isSpatialSupported()` (wrapping
  `PackageManager.hasSystemFeature("android.software.xr.api.spatial")`) and
  `open(target)`, which starts the activity with the target in intent extras.
- Declare the activity with `android.window.PROPERTY_XR_ACTIVITY_START_MODE` =
  `XR_ACTIVITY_START_MODE_FULL_SPACE_MANAGED`. Leave `MainActivity` alone: it keeps running as a 2D panel in Home Space.
- Pass in the math results computed by the shared core, or port `getBearingDegrees` to Kotlin
  **with the same test vectors**. Two implementations that disagree is the failure to avoid.
- Follow the XR quality guidelines: 48dp minimum targets (56dp recommended), no forced locomotion,
  and nothing head-locked closer than about 1 m.

## Accuracy

- GPS alone gives you a direction, not a precise location. A floating, straight-line arrow tolerates
  3–10 m of drift. A world-anchored pin does not. Keep it an arrow.
- Hide the distance number when accuracy is poor (over 30 m). Show "Improving GPS…" instead of a number that jumps around.
- The upgrade path is the **ARCore Geospatial API** (VPS). It gets under 1 m in cities with Street View coverage, and
  it needs an ARCore API key or keyless auth in the Google Cloud project. It enables real
  anchored pins later. Put this behind its own flag.

## Play Store enablement

The current setup: one AAB per brand, all on the mobile release track. Therr is
`com.therr.mobile.Therr`. Niche apps are separate listings, such as `com.therr.habits`.

### Phase A: phone AR (mobile track, same AAB)

1. **ARCore as AR Optional.** Add this inside `<application>` in `TherrMobile/android/app/src/main/AndroidManifest.xml`:
   ```xml
   <meta-data android:name="com.google.ar.core" android:value="optional" />
   ```
   Do **not** add `<uses-feature android:name="android.hardware.camera.ar" android:required="true"/>`.
   Doing so hides the app on Play from every non-ARCore device, including XR headsets. The existing
   `android.hardware.camera` `required="false"` entry stays as it is.
2. **Runtime gate.** Before showing the button, check with `ArCoreApk.checkAvailability()` (Viro wraps this).
   On `SUPPORTED_NOT_INSTALLED`, let ARCore prompt the user to install Google Play Services for AR.
3. **Data safety form.** The camera is used on-device only and no frames are stored or sent. Confirm that the
   form's "Camera / photos" answers still hold. Location answers are unchanged.
4. **Size.** Measure the AAB size difference that ViroReact's native libs cause. Every brand's binary
   carries them, because `TherrMobile` is shared. If the difference is more than about 10 MB per ABI, evaluate a Play Feature
   Delivery dynamic module. Expect friction, since RN native modules in dynamic features are awkward. If that fails,
   accept the size and gate by brand at runtime.
5. **Brand gating.** Put the feature behind a remote feature flag that defaults off. Enable it for the
   Therr brand only. Friends with Habits has no marker-navigation use case.
6. **Rollout.** Internal testing track, then closed testing, then a staged production rollout. Check the pre-launch report
   for crashes on non-ARCore devices, because the fallback path has to hold. Run `/mobile-release-preflight`.
7. **Listing.** Add one phone screenshot of the AR arrow, and mention AR in the full description only once
   it is at 100% rollout (`/aso-listing`).

### Phase B: Android XR (headsets)

Today the app already reaches XR headsets through the mobile track as a 2D panel, as long as nothing
in the manifest marks it unsupported. The AR Optional setting from Phase A keeps it that way.

1. **Stay on the mobile track with the same AAB.** The XR activity is additive and the core app behaves
   the same on both device types. Google recommends this path for "existing app + XR features". Use the dedicated
   Android XR track only if the XR build ever diverges into a separate product.
2. **Declare the XR feature as optional.**
   ```xml
   <uses-feature android:name="android.software.xr.api.spatial" android:required="false" />
   ```
   `required="false"` keeps phones eligible. Gate the XR code path at runtime with `hasSystemFeature`.
3. **Activity start mode.** Set `PROPERTY_XR_ACTIVITY_START_MODE` on `XrNavigationActivity` only (see § 4).
4. **XR permissions.** Request only what you use. Scene understanding or head tracking permissions
   apply only if the experience anchors to surfaces. Check the current names in the Android XR permissions docs
   when you implement this, because they are still moving.
5. **Play Console.** Under *Test and release → Advanced settings → Form factors*, confirm that Android
   XR shows as supported and that headsets are not excluded in the *Device catalog*. Add XR screenshots and,
   ideally, a spatial video preview (180°, 360° or stereoscopic). Play shows these as immersive previews on headsets.
6. **Quality review.** Walk through the Android XR app quality guidelines before submitting.
   Apps that miss them can be kept out of XR-specific featuring.
7. **Glasses.** As of 2026-09, Play distribution covers **headsets and wired XR glasses only**. Display
   and audio glasses experiences run only in the emulator, pending a distribution path. Re-check this before
   starting Phase B, because glasses are where walking AR navigation actually belongs.

## Phased plan

| Phase | Deliverable | Branch | Gate to proceed |
|---|---|---|---|
| 0. Spike (1–2 days) | Throwaway branch: `@reactvision/react-viro` installs on RN 0.86.3 with the New Arch, a GLB renders, APK size difference measured. Run `/mobile-dep-guard`. Also try it on the Android XR emulator to confirm what happens there. | scratch | Builds on Gradle, no Metro singleton conflicts (see memory: axios/Metro), size is acceptable |
| 1. Shared math | `getBearingDegrees`, `normalizeRelativeAngle` and tests in `therr-js-utilities` | `general` | Tests green, library rebuilt |
| 2. Phone AR MVP | `ARNavigation` route, hook, 2D fallback, entry points, locales, feature flag | `general` | `/quality-check`, `/mobile-crash-guard`, device test on 2 ARCore phones and 1 non-ARCore phone |
| 3. Play Phase A | Manifest changes, data safety review, staged rollout | `general` → `stage` → `main` | No crash regression in the pre-launch report |
| 4. XR spatial preview | Kotlin XR activity, TurboModule bridge, Play Phase B | `general` | XR emulator plus a device if available, quality guidelines checklist |
| 5. Geospatial (optional) | VPS-anchored heading and position, then anchored pins | `general` | Accuracy measured under 2 m in 3 test cities |

## Branch placement

All of this is shared, brand-agnostic code, so it lands on **`general`**. That covers `therr-js-utilities`,
the `TherrMobile` route, the native module and the manifest. The only brand-specific part is the feature flag value.
Split commits by package per CLAUDE.md: library first, then mobile.

## Files a session will touch

- `therr-public-library/therr-js-utilities/src/location/get-bearing.ts` (new), `index.ts`
- `TherrMobile/package.json`: `@reactvision/react-viro`, a compass module
- `TherrMobile/main/routes/ARNavigation/` (new): `index.tsx`, `useARNavigationTarget.ts`, `ARScene.tsx`, `CompassFallback.tsx`
- `TherrMobile/main/routes/index.tsx`: route registration
- `TherrMobile/main/components/BottomSheet/MapBottomSheetContent.tsx`, `components/ActionSheet/ContentOptionsSheet.tsx`: entry points
- `TherrMobile/main/utilities/permissionsOrchestrator.ts`: `'arNavigation'` trigger
- `TherrMobile/main/assets/ar/arrow.glb` (new)
- `TherrMobile/main/locales/{en-us,es,fr-ca}/dictionary.json`
- `TherrMobile/android/app/src/main/AndroidManifest.xml`: ARCore meta-data, XR feature, XR activity
- `TherrMobile/android/app/src/main/java/.../xr/`: XR activity and module (Phase 4)
- `docs/FEATURES.md`: add the entry when Phase 2 ships

## Open questions for when this is picked up

- Does the current ViroReact release expose ARCore Geospatial? If yes, go straight to option 1 for heading.
- Does Galaxy XR expose location at all, and does it have GPS? This decides whether the XR "distance from you" uses
  the device location or the last location synced from the phone.
- Has Play opened distribution for display glasses? If yes, re-scope Phase 4 toward a glasses HUD
  (Jetpack Compose Glimmer / projected activities) instead of a headset preview.

## References

- [Package and distribute apps for Android XR](https://developer.android.com/develop/xr/package-and-distribute)
- [5 things to know about publishing for Android XR](https://android-developers.googleblog.com/2025/10/5-things-you-need-to-know-about.html)
- [Play Console: dedicated form factor tracks](https://support.google.com/googleplay/android-developer/answer/13295490)
- [Android XR app quality guidelines](https://developer.android.com/docs/quality-guidelines/android-xr)
- [ReactVision/viro](https://github.com/ReactVision/viro) ([npm](https://www.npmjs.com/package/@reactvision/react-viro))
- [ARCore: enable AR (Required vs Optional)](https://developers.google.com/ar/develop/java/enable-arcore)
