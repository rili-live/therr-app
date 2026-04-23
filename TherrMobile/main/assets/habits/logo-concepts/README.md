# Friends With Habits — App Icon Concepts

Four SVG app-icon drafts for the `niche/HABITS-general` variant. Each is a
1024×1024 rounded-square mark so it can drop straight into the iOS AppIcon
1024 slot and be rasterised down for Android `mipmap-*`/`playstore-icon.png`.

Brand palette used (see `TherrMobile/main/styles/themes/*/colors.ts`):

| Role      | Hex       |
|-----------|-----------|
| Primary   | `#1C7F8A` (brandingBlueGreen) |
| Accent    | `#E37107` / `#DE6E07` (brandingOrange) |
| Highlight | `#22A5B4` (dark-theme primary4) |
| Off-white | `#FCFEFF` (brandingWhite) |
| Deep navy | `#001226` (brandingBlack) |

## The concepts

Preview PNGs live in [`previews/`](./previews) — 512×512 rasters generated
from the SVGs via `cairosvg`. Regenerate them after edits with:

```bash
python3 -c "import cairosvg; [cairosvg.svg2png(url=f'{n}.svg', write_to=f'previews/{n}.png', output_width=512, output_height=512) for n in ['concept-1-pact-rings','concept-2-streak-flame','concept-3-h-bond','concept-4-daily-check-duo']]"
```

1. **`concept-1-pact-rings.svg` — "The Pact"** ([preview](./previews/concept-1-pact-rings.png))
   Two interlocked chain-link rings (white + orange) on the teal brand
   background. Most literal expression of the core mantra *"No pact without
   a partner."* Reads clearly at small sizes.

2. **`concept-2-streak-flame.svg` — "Shared Streak"** ([preview](./previews/concept-2-streak-flame.png))
   A two-tone flame (teal + orange halves) with a white inner core. Speaks
   to the streak mechanic and the fact that the streak only stays lit
   because two people feed it. Darker background gives it strong visual
   contrast on a home screen.

3. **`concept-3-h-bond.svg` — "H-Bond"** ([preview](./previews/concept-3-h-bond.png))
   Typographic — a stylised `H` whose crossbar is a chain-link. Doubles as
   the letter *H* for *Habits* and a *bond* between two strokes. Feels the
   most "product / brand mark" of the four.

4. **`concept-4-daily-check-duo.svg` — "Daily Check Duo"** ([preview](./previews/concept-4-daily-check-duo.png))
   Progress ring + checkmark (today's habit done) with two partner dots
   linked at the base. Most literal / illustrative; very legible at tiny
   sizes but less distinctive as a mark.

## Next steps once a concept is picked

1. Copy the chosen SVG to `TherrMobile/main/assets/habits-logo.svg` (mirrors
   the existing `therr-logo.svg` convention).
2. Raster-export PNGs for:
   - `TherrMobile/assets/logo.png` + `@1.5x/@2x/@3x/@4x` and bootsplash set
   - `TherrMobile/ios/Therr/Images.xcassets/AppIcon.appiconset/` (20–1024 px)
   - `TherrMobile/android/app/src/main/res/mipmap-*/` + `playstore-icon.png`
3. Swap the in-app header logo reference (search for `therr-logo` in
   `TherrMobile/main/` and gate on `CURRENT_BRAND_VARIATION === HABITS`).
4. Update `TherrMobile/assets/manifest.json` background to stay on the
   teal `#1C7F8A` so the bootsplash matches the new mark.

See `docs/NICHE_APP_SETUP_STEPS.MD` → *Branding & Assets* for the full
setup checklist.
