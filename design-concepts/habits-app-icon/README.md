# Friends With Habits — App Icon Design Concepts

> **Status:** Idea process, not production assets.
>
> This directory tracks visual exploration for the HABITS app icon / logo.
> Concepts here are iteration artifacts — brand direction, colors, and
> motifs are all still in flux. Nothing in this folder is wired into the
> mobile app or build pipeline. When a direction is chosen and finalized,
> the winning SVG will be productionized separately (see *Productionization*
> at the bottom).

## Current brand direction (April 2026)

- **Primary color:** deep, dark, faded purple (not the teal from earlier
  Therr branding). Working values: `#2E2140` background with a muted
  `#6B5180` body tone.
- **Motif under exploration:** a chameleon — tying into the theme of
  *habits and change* (chameleons change color). This supersedes the
  earlier ring/chain/flame explorations listed below.
- **Accent gradient:** a subtle shift from muted purple through dusty
  blue-grey to desaturated green, hinting at color-change without being
  literal. Used as a body-fill on the mark.

## Concepts

Preview PNGs are 512×512 rasters in [`previews/`](./previews), generated
from each SVG via `cairosvg`:

```bash
python3 -c "import cairosvg; [cairosvg.svg2png(url=f'{n}.svg', write_to=f'previews/{n}.png', output_width=512, output_height=512) for n in ['concept-1-pact-rings','concept-2-streak-flame','concept-3-h-bond','concept-4-daily-check-duo','concept-5-chameleon']]"
```

### Current direction

5. **`concept-5-chameleon.svg` — "Chameleon Face"** ([preview](./previews/concept-5-chameleon.png))
   Front-facing minimal chameleon head on deep faded purple. Two bulging
   turret eyes and a soft casque peak make the species readable. Body fill
   uses the color-shift gradient to reference the habits-and-change theme.
   Current working direction — still rough, expect iteration.

### Earlier explorations (teal-era, superseded)

These were drafted under the earlier teal palette (`#1C7F8A`) and the
"no pact without a partner" mantra. Kept for process history; not the
current direction.

1. **`concept-1-pact-rings.svg` — "The Pact"** ([preview](./previews/concept-1-pact-rings.png))
   Two interlocked chain-link rings on teal. Literal expression of the
   mandatory-partner mechanic.

2. **`concept-2-streak-flame.svg` — "Shared Streak"** ([preview](./previews/concept-2-streak-flame.png))
   Two-tone flame with a white inner core — streaks kept alive by two
   people.

3. **`concept-3-h-bond.svg` — "H-Bond"** ([preview](./previews/concept-3-h-bond.png))
   Stylised `H` whose crossbar is a chain-link. Chain geometry in the
   crossbar needs a rework.

4. **`concept-4-daily-check-duo.svg` — "Daily Check Duo"** ([preview](./previews/concept-4-daily-check-duo.png))
   Progress ring + checkmark with two partner dots linked at the base.
   Legible but does too much for a launcher icon.

## Productionization (once a direction is picked)

When a concept is approved, it graduates out of this folder:

1. Export the chosen SVG to `TherrMobile/main/assets/habits-logo.svg`
   (mirrors the `therr-logo.svg` convention).
2. Raster-export PNGs for:
   - `TherrMobile/assets/logo.png` + `@1.5x/@2x/@3x/@4x` and bootsplash set
   - `TherrMobile/ios/Therr/Images.xcassets/AppIcon.appiconset/` (20–1024 px)
   - `TherrMobile/android/app/src/main/res/mipmap-*/` + `playstore-icon.png`
3. Swap the in-app header logo reference (search for `therr-logo` in
   `TherrMobile/main/` and gate on `CURRENT_BRAND_VARIATION === HABITS`).
4. Update `TherrMobile/assets/manifest.json` background to match the
   new brand color so the bootsplash matches the mark.

See `docs/NICHE_APP_SETUP_STEPS.MD` → *Branding & Assets* for the full
setup checklist.
