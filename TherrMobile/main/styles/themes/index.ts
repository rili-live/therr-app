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
    // Main
    primary: string;
    primary2: string;
    primary3: string;
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
