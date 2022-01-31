import { IMobileThemeName } from 'therr-react/types';
import defaultTheme from './retro'; // Change this path to set the default theme
import retroTheme from './retro'; // Change this path to set the default theme


export const getTheme = (name?: IMobileThemeName) => {
    switch (name) {
        case 'retro':
            return retroTheme;
        default:
            return defaultTheme;
    }
};

export interface ITherrThemeColors {
    // Main
    primary: string;
    primary2: string;
    primary3: string;
    primary4: string;
    secondary: string;
    secondaryFaded: string;
    ternary: string;
    ternary2: string;
    tertiary: string;

    // Text
    textBlack: string;
    textGray: string;
    textDarkGray: string;
    textWhite: string;

    // Branding
    brandingMapYellow: string;
    brandingOrange: string;
    brandingLightBlue: string;

    // Background
    backgroundCream: string;
    backgroundWhite: string;
    backgroundGray: string;
    backgroundNeutral: string;

    borderLight: string;
    placeholderTextColor: string;

    hyperlink: string,

    // Alerts
    alertError: string,

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

    map: {
        momentsCircleFill: string;
        momentsCircleFillActive: string;
        spacesCircleFill: string;
        spacesCircleFillActive: string;
        myMomentsCircleFill: string;
        myMomentsCircleFillActive: string;
        mySpacesCircleFill: string;
        mySpacesCircleFillActive: string;
        userCircleFill: string;
    };
}

export interface ITherrThemeColorVariations {
    primaryFade: string;
    primaryFadeMore: string;
    primary2Fade: string;
    primary2Darken: string;
    primary3LightFade: string;
    primary3Fade: string;
    backgroundCreamLighten: string;
    textBlackFade: string;
    textWhiteFade: string;
    textGrayDarken: string;
    accent1Fade: string;
    accent1LightFade: string;
    accent1HeavyFade: string;
    accentBlueLightFade: string;
    accentBlueHeavyFade: string;
    accentTextBlack: string;
    accentTextWhiteFade: string;

    // Background
    backgroundNeutral: string;
    backgroundNeutralLighter: string;
}

export interface ITherrTheme {
    colors: ITherrThemeColors;
    colorVariations: ITherrThemeColorVariations;
}

export default defaultTheme;
