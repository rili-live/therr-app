# HABITS App-Icon Raster Set

Rasters exported from the canonical
[`../habits-logo.svg`](../habits-logo.svg) (Sage v5), along with the
Android adaptive-icon foreground/background layers.

Everything here is **staging**. Per TherrMobile/CLAUDE.md → *General vs
Niche Branch Files*, the actual `ios/` and `android/` platform icon
files live on the `niche/HABITS-general` branch. This folder is the
canonical source on the `general` lineage; copy from here into the
platform folders when on the niche branch.

## Contents

```
habits-icons/
├── adaptive-background.svg       # Solid white Android adaptive-icon bg
├── adaptive-foreground.svg       # Chameleon scaled to inner 66% safe zone
├── export.py                     # Regenerate all PNGs below
├── ios/
│   └── Icon-{20,29,40,58,60,76,80,87,120,152,167,180,1024}.png
└── android/
    ├── mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/
    │   ├── ic_launcher.png               # 48/72/96/144/192 — legacy square
    │   ├── ic_launcher_round.png         # same sizes — legacy round
    │   ├── ic_launcher_foreground.png    # 108/162/216/324/432 — adaptive fg
    │   └── ic_launcher_background.png    # same sizes — adaptive bg
    └── playstore/icon-512.png            # Play Store listing
```

## Regenerating

Requires `cairosvg` (`pip install cairosvg`). Run from this folder:

```bash
python3 export.py
```

## Deploying to the niche branch (`niche/HABITS-general`)

### iOS

Copy each `ios/Icon-{N}.png` into
`TherrMobile/ios/Therr/Images.xcassets/AppIcon.appiconset/`, renaming
to match the existing filenames referenced in that folder's
`Contents.json`. Verify each entry's `size`/`scale` in `Contents.json`
maps to the expected pixel size (e.g. `60x60` at `@3x` → 180px).

### Android — legacy launcher

For each density folder, replace
`TherrMobile/android/app/src/main/res/mipmap-{density}/ic_launcher.png`
and `ic_launcher_round.png` with the corresponding files from
`android/mipmap-{density}/`.

### Android — adaptive icon (API 26+)

1. Copy `ic_launcher_foreground.png` and `ic_launcher_background.png`
   from each density folder into the matching
   `TherrMobile/android/app/src/main/res/mipmap-{density}/` folder.
2. Update (or create) both adaptive-icon XMLs in
   `TherrMobile/android/app/src/main/res/mipmap-anydpi-v26/`:

   `ic_launcher.xml` and `ic_launcher_round.xml`:
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
       <background android:drawable="@mipmap/ic_launcher_background" />
       <foreground android:drawable="@mipmap/ic_launcher_foreground" />
   </adaptive-icon>
   ```

3. `playstore/icon-512.png` → Play Console listing upload (not committed
   to an Android res folder).

### In-app header

Swap the header-logo reference in `TherrMobile/main/` behind the brand
gate:

```tsx
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';
import { BrandVariations } from 'therr-js-utilities/constants';

const logoSource = CURRENT_BRAND_VARIATION === BrandVariations.HABITS
    ? require('../assets/habits-logo.svg')
    : require('../assets/therr-logo.svg');
```

### Bootsplash

Update `TherrMobile/assets/manifest.json` so the bootsplash background
is white (`#FFFFFF`) to match the icon, and regenerate the bootsplash
PNG set from `../habits-logo.svg` via the `react-native-bootsplash`
generator or the existing `bootsplash/` tooling.

## Design rationale

- **1024×1024 master**, artwork within inner 820px (iOS safe area).
- **Adaptive foreground** scaled to 66% centered (Android inner safe
  zone — avoids launcher-mask cropping).
- **White background** for strong contrast in App Store listings. Verify
  on a light home-screen wallpaper; a dark-purple alternate (`#2E2140`)
  is available in `design-concepts/habits-app-icon/` if needed.
- **29×29 legibility** confirmed: silhouette still reads as "purple
  chameleon face" at iOS notification-slot size.
