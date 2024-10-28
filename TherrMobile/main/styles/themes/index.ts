import { IMobileThemeName } from 'therr-react/types';
import defaultTheme from './light'; // Change this path to set the default theme
import lightTheme from './light';
import retroTheme from './retro';


export const getTheme = (name?: IMobileThemeName) => {
    switch (name) {
        case 'light':
            return lightTheme;
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
