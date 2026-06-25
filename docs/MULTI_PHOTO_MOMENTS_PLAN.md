# Moment Content Types — Photo / Multi-Photo (Video deferred)

> Supersedes the earlier "Live Moments" (still + auto-playing clip) approach, which was
> dropped: the native-video auto-play UX was confusing and a perf/UX liability. Moments now
> have clear content types.

## Context

Moments should clearly differentiate their content. Three types are intended:
- **Photo** — a single image (the existing behavior).
- **Multi-photo** — up to 5 images shown as a simple, swipeable carousel.
- **Video** — a dedicated video type. **Deferred** for now (no dedicated video moment yet).

This replaces the Live Photo / native-video auto-play concept entirely.

## Model

Everything maps onto the existing `medias[]` JSONB array — **no DB migration**:
- 1 image entry → photo.
- 2–5 image entries → multi-photo carousel.
- (future) 1 video entry → video.

`Content.mediaTypes.USER_VIDEO_PUBLIC/PRIVATE` remain defined but **reserved** for the deferred
video type; nothing produces or plays them today.

## Behavior

- **Capture (EditMoment):** "Add Photos" opens the gallery (multi-select up to 5) or camera
  (one shot, appended). Each photo uploads as an image `medias[]` entry in selection order.
  Gated by `ENABLE_MULTI_PHOTO_MOMENTS` (repurposed feature flag); when off, behaves as the
  original single-photo flow.
- **Display (feed / list / compact):** a single photo renders as today. 2+ photos render a
  swipeable carousel (`react-native-pager-view`, already installed) with page dots. **Swipe**
  changes photo; **tap** opens the moment detail (existing `inspectContent`); **double-tap**
  likes (existing). No autoplay, no gesture conflicts.
- **Map preview cards:** keep a single representative photo — the cards sit inside a horizontal
  snap-scroller, so a nested swipe-pager there would fight the outer gesture.

## Key files

**Shared/backend (general):**
- `therr-js-utilities/constants/Content.ts` — `USER_VIDEO_*` reserved (deferred video).
- `maps-service/utilities/validateMomentMedia.ts` (+ `handlers/moments.ts`) — photos only,
  capped at `MAX_MOMENT_PHOTOS` (5). No `MomentsStore` change.

**Mobile (feature branch):**
- `env-config.js` — `featureFlags.ENABLE_MULTI_PHOTO_MOMENTS`.
- `utilities/content.ts` — `getMomentImageUris` (resolves up to 5 photo URIs; public →
  ImageKit, private → signed-URL map), `isImageMedia`, `MAX_MOMENT_PHOTOS`.
- `components/UserContent/MultiPhotoCarousel.tsx` (new) — pager + dots; reuses
  `PressableWithDoubleTap` for tap/double-tap.
- `components/UserContent/AreaDisplay.tsx`, `AreaDisplayMedium.tsx` — carousel for multi-photo,
  single image otherwise; thread `areaMediaUris`.
- `routes/Areas/AreaCarousel.tsx`, `routes/ViewMoment/index.tsx` — resolve and pass
  `areaMediaUris`.
- `routes/EditMoment/index.tsx` — multi-select capture/upload (up to 5), "Add Photos" /
  "Add More Photos" labels.
- `locales/{en-us,es,fr-ca}/dictionary.json`.

## Performance
- Pager mounts only the moment's own photos (≤5); no video decoding.
- Public images served by ImageKit at device-appropriate sizes; private images reuse the
  signed URL already cached in Redux.

## Deferred — video moment type
A dedicated video type (poster in feed, plays in the detail view with native controls/sound)
is intentionally out of scope here. The `USER_VIDEO_*` media types are reserved so it can be
added later without a migration.

## Verification
1. Build shared libs (`therr-js-utilities`, `therr-react`).
2. Backend: `validateMomentMedia` unit tests (photos only; cap at 5).
3. Mobile: create a moment with 2–5 photos → feed shows a swipeable carousel with dots; swipe
   changes photo; tap opens detail; double-tap likes. Single-photo and legacy moments
   unchanged. Map cards show one photo.
4. `i18n-sync` parity + `quality-check` on changed packages.
