# Live Moments (Moving-Picture Photos) — Design & Implementation

> Status: **Phase 1 (foundation + playback + picker-based capture) in progress.**
> Phase 2 (custom native Live/Motion-Photo import + in-app press-and-hold recording)
> is documented below and deferred — it requires native iOS/Android builds.

## Context

Both iOS (Live Photos) and Android (Motion Photos) capture a still image paired with a short
video clip, producing a brief "moving picture." Bringing this to Therr **moments** is a strong
differentiator. This adds the ability to **create** a moving-image moment and to **play** it
back tastefully in the feed and on the moment detail screen — gated behind a feature flag,
**still-image by default** with motion playback as an opt-in.

### Locked decisions
- **Capture (phased):**
  - *Phase 1:* record/select a short clip via the already-installed
    `react-native-image-crop-picker` (`mediaType: 'video'`), no new native module.
  - *Phase 2:* import existing device Live/Motion Photos via a custom native module, and
    in-app press-and-hold recording via `react-native-vision-camera`.
- **Storage/delivery:** still JPEG **+** a muted ~2–3s **H.264 MP4** (mirrors native
  Live/Motion photos). Served via the existing ImageKit CDN (ImageKit transcodes/streams the
  MP4 and can generate a poster frame from it). Reuses the existing `medias[]` JSONB array and
  the existing signed-URL upload flow — **no DB migration**.
- **Defaults:** **Capture defaults to Live** (`settingsCaptureLiveByDefault`, ON by default).
  **Feed playback stays still by default** (`settingsAutoplayLiveMoments`, OFF by default).
  The two are intentionally independent: capture the richer asset, render conservatively while
  scrolling.

## Branch & commit split (CLAUDE.md enforced)
Shared (`therr-public-library/**`) and backend (`therr-services/**`) changes must land on
`general` to deploy. Keep them in commits separate from `TherrMobile/**` so they can be split.

## Data model
A live moment is represented in the existing `medias[]` JSONB array as **two sibling entries**:
- `medias[0]` — the still (`USER_IMAGE_PUBLIC`/`PRIVATE`), unchanged; all current display
  paths and web continue to render it. When a clip exists, the still carries `isLivePhoto: true`.
- an additional entry typed `USER_VIDEO_PUBLIC`/`USER_VIDEO_PRIVATE` holding the MP4 clip.

Clients that don't understand video ignore the second entry and show the still — fully
backward compatible. No `moments` schema change (the `medias` column is already JSONB).

## Shared + backend (commit on `general`)
- `therr-js-utilities/src/constants/Content.ts` — `mediaTypes.USER_VIDEO_PUBLIC` /
  `USER_VIDEO_PRIVATE`.
- `therr-react/src/types/redux/user.ts` — `IUserSettings.settingsCaptureLiveByDefault`
  (default treated as `true`) and `settingsAutoplayLiveMoments` (default `false`). Persisted
  through the existing `updateUser` settings flow — no handler change needed.
- `maps-service/src/utilities/validateLiveMomentMedia.ts` (new) + wired into
  `handlers/moments.ts createMoment`: at most one paired video, and a video must have a
  sibling still. No `MomentsStore` change (already `JSON.stringify`s `medias`).
- `maps-service/handlers/createMediaUrls.ts` / `therr-react MapsService.getSignedUrl*` — the
  signed PUT URL is filename-driven and content-type agnostic; `.mp4` + `video/mp4` flow
  through unchanged.

## Mobile (commit on the feature branch)
- `env-config.js` — `featureFlags.ENABLE_LIVE_MOMENTS`.
- `utilities/content.ts` — `getUserVideoUri` (streamed MP4) and `getLiveMomentPosterUri`
  (ImageKit video-thumbnail fallback poster).
- `utilities/liveMomentMedia.ts` (new) — pure helpers: pick the still vs. video entry out of
  a `medias[]` array and decide whether a moment is "live."
- `components/UserContent/LiveMomentMedia.tsx` (new) — renders the still as poster; overlays
  `react-native-video` (muted, looping, `paused={!isActive}`) when a clip exists and playback
  is enabled. **Defensively loads `react-native-video`** so the app degrades to the still if
  the native module isn't present yet. Shows a small "LIVE" badge.
- `components/UserContent/AreaDisplay.tsx` (+ Medium/Card variants) — render via
  `LiveMomentMedia`, threading an `isActive` prop.
- `routes/Areas/AreaCarousel.tsx` — `viewabilityConfig` + `onViewableItemsChanged` +
  `onMomentumScrollEnd` to track the centered, **settled** item; only that one plays.
- `routes/ViewMoment/index.tsx` — always active (autoplay) when a clip exists and the flag is on.
- `routes/EditMoment/index.tsx` + `components/ActionSheet/ImagePickerSheet.tsx` — a "Live"
  toggle seeded by `settingsCaptureLiveByDefault`; when on, record/select a short clip and
  upload a second `medias[]` entry alongside the still (Phase 1: clip via image-crop-picker;
  still poster derived from the clip via ImageKit when a frame can't be extracted locally).
- `routes/Settings/ManagePreferences.tsx` — two toggles for the settings above.
- `locales/{en-us,es,fr-ca}/dictionary.json` — Live toggle / badge / settings strings.

## Performance
- **One video at a time** — only the settled, centered, visible item plays; all others render
  the still. The single most important guard against scroll jank.
- **Clip budget** — cap ~2–3s, ≤720p H.264 muted; ImageKit serves a size-appropriate variant
  and the still acts as the `poster` so first paint is instant.
- **Lazy decode** — `paused` until active.
- **Data awareness** — honor Data Saver / Low Power / Reduce Motion → still only.

## Phase 2 — deferred native work
- **Custom Live/Motion-Photo importer** native module:
  - iOS: `PHAsset` with `PHAssetMediaSubtype.photoLive` → export the paired video via
    `PHAssetResourceManager` (`PHAssetResourceType.pairedVideo`).
  - Android: Motion Photos are a JPEG with a trailing embedded MP4 (XMP `MotionPhoto` /
    `MicroVideoOffset`); slice the trailing bytes.
  - JS wrapper `extractLivePhoto(uri) -> { stillPath, videoPath, durationMs }`, falling back to
    `{ stillPath }` for plain photos.
- **In-app recording** via `react-native-vision-camera` (press-and-hold), with a key-frame
  still from `react-native-create-thumbnail` or `takePhoto`.

## Verification
1. Build shared libs (`therr-js-utilities`, `therr-react`) so new constants/types resolve.
2. Backend: create a moment with `media=[{image, isLivePhoto:true},{video}]` → persists and
   returns both entries; unit-test the validation limits.
3. Mobile capture (flag on): record/select a short clip → confirm a second signed-URL request
   and a `medias[]` video entry; plain photo path unchanged.
4. Feed: the centered moment plays only after the scroll settles, one at a time; others show
   stills; disabling `settingsAutoplayLiveMoments` reverts to stills.
5. ViewMoment: clip autoplays/loops.
6. Regression: non-live and legacy moments render unchanged on mobile and web.
7. `i18n-sync` (locale parity) + `quality-check` (ESLint + tsc) on changed packages.
