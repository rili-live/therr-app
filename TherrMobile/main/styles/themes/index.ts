import { IMobileThemeName } from 'therr-react/types';
import { BrandVariations } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../../config/brandConfig';
import defaultTheme from './light'; // Change this path to set the default theme
import lightTheme from './light';
import darkTheme from './dark';
import retroTheme from './retro';
import { getPaperTheme } from './paper';


export const isDarkTheme = (name?: IMobileThemeName) => name !== 'light';

const baseThemeFor = (name?: IMobileThemeName) => {
    switch (name) {
        case 'light':
            return lightTheme;
        case 'dark':
            return darkTheme;
        case 'retro':
            return retroTheme;
        default:
            return defaultTheme;
    }
};

// ---------------------------------------------------------------------------
// Per-brand theme overrides
// ---------------------------------------------------------------------------
//
// HOW THIS WORKS
// --------------
// `general` ships with empty entries below — every niche app inherits the
// canonical Therr palette. Each `niche/<TAG>-general` branch can edit ITS
// OWN entry to give that brand a distinct look without touching screens or
// components. A change here flows to every screen that reads from
// `getTheme()` / `getPaperTheme()` (which is all of them — no consumer
// imports the raw light/dark/retro themes directly).
//
// HOW TO OVERRIDE FROM A NICHE BRANCH
// -----------------------------------
//   1. Switch to your niche branch:    git checkout niche/HABITS-general
//   2. Edit the entry below for your variant. Override only the slots you
//      want to differ from the base palette — everything you leave out
//      inherits.
//   3. If your override changes a SOURCE color that colorVariations is
//      derived from (primary*, accent1, accentBlue, accentTextBlack/White,
//      backgroundCream/Black/Neutral, brandingOrange, textBlack/Gray/White),
//      also extend `brandColorVariationOverrides` so the derived fades match.
//   4. Mirror the same overrides in `brandPaperColorOverrides` in `./paper.ts`
//      for any token Paper components consume (primary, secondary, surface,
//      etc.).
//
// `getTheme()` resolves brand from `CURRENT_BRAND_VARIATION` when no brand
// is passed, so existing call sites remain unchanged.
const brandColorOverrides: Partial<
    Record<BrandVariations, Partial<ITherrThemeColors>>
> = {
    [BrandVariations.THERR]: {},
    [BrandVariations.TEEM]: {},
    [BrandVariations.HABITS]: {},
    [BrandVariations.OTAKU]: {},
    [BrandVariations.PARALLELS]: {},
    [BrandVariations.APPY_SOCIAL]: {},
    [BrandVariations.DASHBOARD_THERR]: {},
};

const brandColorVariationOverrides: Partial<
    Record<BrandVariations, Partial<ITherrThemeColorVariations>>
> = {
    [BrandVariations.THERR]: {},
    [BrandVariations.TEEM]: {},
    [BrandVariations.HABITS]: {},
    [BrandVariations.OTAKU]: {},
    [BrandVariations.PARALLELS]: {},
    [BrandVariations.APPY_SOCIAL]: {},
    [BrandVariations.DASHBOARD_THERR]: {},
};

const isEmpty = (obj: object | undefined) => !obj || Object.keys(obj).length === 0;

export const getTheme = (
    name?: IMobileThemeName,
    brand?: BrandVariations,
): ITherrTheme => {
    const baseTheme = baseThemeFor(name);
    const resolvedBrand = brand ?? CURRENT_BRAND_VARIATION;
    const colorOverride = brandColorOverrides[resolvedBrand];
    const variationOverride = brandColorVariationOverrides[resolvedBrand];

    // Fast path — when this brand has no overrides, return the cached base
    // theme by reference. Preserves referential equality for memoization
    // (React.memo, useMemo deps) and avoids per-call object allocation.
    if (isEmpty(colorOverride) && isEmpty(variationOverride)) {
        return baseTheme;
    }

    return {
        colors: { ...baseTheme.colors, ...(colorOverride ?? {}) },
        colorVariations: { ...baseTheme.colorVariations, ...(variationOverride ?? {}) },
    };
};

export { getPaperTheme };

export interface ITherrThemeColors {
    // -----------------------------------------------------------------------
    // Semantic aliases (preferred for new code)
    // -----------------------------------------------------------------------
    // MD3-aligned naming layered on top of the legacy `primary*` / `accent*` /
    // `background*` palette. Reach for these in new code instead of guessing
    // between `primary` (which means "background" in light/dark themes but
    // "brand teal" in retro!) and `primary3` (which is the actual brand teal
    // in light/dark but a complementary dark-blue in retro).
    //
    // Mapping table:
    //   brand           → light/dark `primary3`,    retro `primary`     (always #1C7F8A)
    //   brandDark       → light `primary4` (dark teal),
    //                     dark `primary4` (bright teal — stronger on dark bg),
    //                     retro `primary3` (dark blue — complementary)
    //   brandFaded      → `colorVariations.primary3Fade`
    //   surface         → `backgroundWhite` (the dominant content surface)
    //   surfaceAlt      → `backgroundGray`  (inset / sub-surface tint)
    //   onSurface       → `textDark` (light) / `textWhite` (dark/retro)
    //   onSurfaceMuted  → `textGray`
    //   onBrand         → `brandingWhite` — text on brand-colored fills
    //   border          → `borderLight`
    //   accent          → `secondary` (orange in light/dark, teal in retro)
    //   onAccent        → `brandingWhite`

    /** Brand teal — the canonical primary brand color across all themes. */
    brand: string;
    /**
     * Stronger / more saturated brand variant for emphasis. In dark themes
     * this is brighter (better contrast on dark bg); in light themes it's
     * darker. The name is "brand at its most prominent for this theme".
     */
    brandDark: string;
    /** Faded brand teal for hover/disabled states and decorative tints. */
    brandFaded: string;
    /** Primary content surface (screen background, card surface). */
    surface: string;
    /** Secondary surface used for inset/grouped content. */
    surfaceAlt: string;
    /** Default text color rendered on `surface`. */
    onSurface: string;
    /** Muted/secondary text color on `surface`. */
    onSurfaceMuted: string;
    /** Foreground color used on top of `brand`-colored fills. */
    onBrand: string;
    /** Default divider / hairline border color. */
    border: string;
    /** Secondary accent for non-brand emphasis (orange in light/dark). */
    accent: string;
    /** Foreground color used on top of `accent`-colored fills. */
    onAccent: string;

    // -----------------------------------------------------------------------
    // Legacy palette (retained for ~53 style files; new code: prefer aliases)
    // -----------------------------------------------------------------------
    /** @deprecated Means BACKGROUND in light/dark, brand teal in retro. Use `surface` (background) or `brand` (teal) instead. */
    primary: string;
    primary2: string;
    /** @deprecated The actual brand teal in light/dark, dark-blue in retro. Use `brand` instead for cross-theme consistency. */
    primary3: string;
    /** @deprecated Use `brandDark` (semantic alias mapping to today's primary4 per theme). */
    primary4: string;
    primary5: string;
    secondary: string;
    ternary: string;
    ternary2: string;
    tertiary: string;

    // Text
    textBlack: string;
    textDark: string;
    textGray: string;
    textDarkGray: string;
    textWhite: string;
    selectionColor: string;

    // Branding - These colors should remain unchanged regardless of theme
    brandingWhite: string;
    brandingBlack: string;
    brandingBlueGreen: string;
    brandingMapYellow: string;
    brandingOrange: string;
    brandingRed: string;
    brandingLightBlue: string;

    // Background
    backgroundCream: string;
    backgroundWhite: string;
    backgroundGray: string;
    backgroundNeutral: string;
    backgroundBlack: string;
    inputBackgroundAndroid: string;
    inputBackgroundIOS: string;

    borderLight: string;
    placeholderTextColor: string;
    placeholderTextColorAlt: string;

    hyperlink: string,
    controlButtons: string;

    // Alerts
    alertError: string,
    alertSuccess: string,
    alertWarning: string,
    alertInfo: string,

    // Accents - Alternate color scheme to add variety and reduce blandless
    accent1: string;
    accent1Fade: string;
    accent2: string;
    accent3: string;
    accentAlt: string;
    accentTextBlack: string;
    accentTextWhite: string;
    accentRed: string;
    accentYellow: string;
    accentBlue: string;
    accentPurple: string;
    accentTeal: string;
    accentLime: string;
    accentDivider: string;
    accentLogo: string;

    // Socials
    facebook: string;
    instagram: string;
    twitter: string;
    tikTok: string;
    youtube: string;

    map: {
        momentsCircleFill: string;
        momentsCircleFillActive: string;
        undiscoveredMomentsCircleFill: string;
        spacesCircleFill: string;
        spacesCircleFillActive: string;
        undiscoveredSpacesCircleFill: string;
        myMomentsCircleFill: string;
        myMomentsCircleFillActive: string;
        mySpacesCircleFill: string;
        mySpacesCircleFillActive: string;
        userCircleFill: string;
        momentsCircleStroke: string;
        undiscoveredMomentsCircleStroke: string;
        spacesCircleStroke: string;
        undiscoveredSpacesCircleStroke: string;
        myMomentsCircleStroke: string;
        mySpacesCircleStroke: string;
    };
}

export interface ITherrThemeColorVariations {
    primaryFade: string;
    primaryFadeMore: string;
    primary2Fade: string;
    primary2Darken: string;
    primary3Darken: string;
    primary3LightFade: string;
    primary3Fade: string;
    primary3Disabled: string;
    primary4Fade: string;
    backgroundCreamLighten: string;
    backgroundBlackFade: string;
    textBlackFade: string;
    textWhiteFade: string;
    textWhiteLightFade: string;
    textGrayDarken: string;
    textGrayFade: string;
    accent1Fade: string;
    accent1LightFade: string;
    accent1HeavyFade: string;
    accentBlueLightFade: string;
    accentBlueHeavyFade: string;
    accentTextBlack: string;
    accentTextWhiteFade: string;
    brandingOrangeLightFade: string;
    brandingOrangeHeavyFade: string;

    // Background
    backgroundNeutral: string;
    backgroundNeutralLighter: string;
}

export interface ITherrTheme {
    colors: ITherrThemeColors;
    colorVariations: ITherrThemeColorVariations;
}

export default defaultTheme;
