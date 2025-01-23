import Color from 'color';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../';

const colors: ITherrThemeColors = {
    // Main
    primary: '#ffffff',
    primary2: '#fcfeff',
    primary3: '#9748FF',
    primary4: '#104B52',
    primary5: '#17657D',
    secondary: '#E37107',
    ternary: '#ffffff',
    ternary2: '#ffc269',
    tertiary: '#104B52',

    // Text
    textBlack: '#fcfeff',
    textDark: '#363636',
    textGray: 'rgba(0,0,0,.58)',
    textDarkGray: '#728f94',
    textWhite: '#363636',
    selectionColor: '#E37107',

    // Branding - These colors should remain unchanged regardless of theme
    brandingWhite: '#fcfeff',
    brandingBlack: '#001226',
    brandingBlueGreen: '#1C7F8A',
    brandingMapYellow: '#ebc300',
    brandingOrange: '#DE6E07',
    brandingRed: '#FF3041',
    brandingLightBlue: '#d8f0f2',

    // Background
    backgroundCream: '#575d5d',
    backgroundWhite: '#ffffff',
    backgroundGray: '#f3f4f6',
    backgroundNeutral: '#E7E8E8',
    backgroundBlack: '#ffffff',
    inputBackgroundAndroid: 'rgba(0,0,0,.04)',
    inputBackgroundIOS: 'rgba(0,0,0,.04)',

    borderLight: 'gray',
    placeholderTextColor: '#78909b',
    placeholderTextColorAlt: 'rgba(0,0,0,.58)',

    hyperlink: '#0e01b3',
    controlButtons: '#1C7F8A',

    // Alerts
    alertError: '#AC3E59',

    // Accents - Alternate color scheme to add variety and reduce blandless
    accent1: '#ffffff',
    accent1Fade: '#97c5bb',
    accent2: '#104B52',
    accent3: '#218a35',
    accentAlt: '#449885',
    accentTextBlack: '#1C7F8A',
    accentTextWhite: '#001226',
    accentRed: '#fe0156',
    accentYellow: '#fed61e',
    accentBlue: '#17657D',
    accentPurple: '#0e01b3',
    accentTeal: '#2BC5D6',
    accentLime: '#26B379',
    accentDivider: '#4950571c',
    accentLogo: '#9748FF',

    // Socials
    facebook: '#4167b2',
    instagram: '#000000',
    twitter: '#1c9bef',
    tikTok: '#000000',
    youtube: 'red',

    map: {
        momentsCircleStroke: 'rgba(56,130,84,0.4)',
        momentsCircleFill: 'rgba(56,130,84,0.2)',
        momentsCircleFillActive: 'rgba(56,130,84,0.5)',
        undiscoveredMomentsCircleStroke: 'rgba(222,110,7,0.4)',
        undiscoveredMomentsCircleFill: 'rgba(222,110,7,0.2)',
        spacesCircleStroke: 'rgba(56,130,84,0.4)',
        spacesCircleFill: 'rgba(56,130,84,0.2)',
        spacesCircleFillActive: 'rgba(56,130,84,0.5)',
        undiscoveredSpacesCircleStroke: 'rgba(222,110,7,0.4)',
        undiscoveredSpacesCircleFill: 'rgba(222,110,7,0.2)',
        myMomentsCircleStroke: 'rgba(31,89,125,0.4)',
        myMomentsCircleFill: 'rgba(31,89,125,0.2)',
        myMomentsCircleFillActive: 'rgba(31,89,125,0.5)',
        mySpacesCircleStroke: 'rgba(31,89,125,0.4)',
        mySpacesCircleFill: 'rgba(31,89,125,0.2)',
        mySpacesCircleFillActive: 'rgba(31,89,125,0.5)',
        userCircleFill: 'rgba(31,89,125,0.25)',
    },
};

const colorVariations: ITherrThemeColorVariations = {
    primaryFade: new Color(colors.primary).fade(0.35).toString(),
    primaryFadeMore: new Color(colors.primary).fade(0.65).toString(),
    primary2Fade: new Color(colors.primary2).fade(0.35).toString(),
    primary2Darken: new Color(colors.primary2).darken(0.075).toString(),
    primary3Darken: new Color(colors.primary3).darken(0.075).toString(),
    primary3LightFade: new Color(colors.primary3).fade(0.15).toString(),
    primary3Fade: new Color(colors.primary3).fade(0.25).toString(),
    primary4Fade: new Color(colors.primary4).fade(0.5).toString(),
    backgroundCreamLighten: new Color(colors.backgroundCream).lighten(0.02).toString(),
    backgroundBlackFade: new Color(colors.backgroundBlack).fade(0.85).toString(),
    textBlackFade: new Color(colors.textBlack).fade(0.75).toString(),
    textWhiteLightFade: new Color(colors.textWhite).fade(0.25).toString(),
    textWhiteFade: new Color(colors.textWhite).fade(0.75).toString(),
    textGrayDarken: new Color(colors.textGray).darken(0.15).toString(),
    textGrayFade: new Color(colors.textGray).fade(0.35).toString(),
    accent1Fade: new Color(colors.accent1).fade(0.2).toString(),
    accent1LightFade: new Color(colors.accent1).fade(0.2).toString(),
    accent1HeavyFade: new Color(colors.accent1).fade(0.7).toString(),
    accentBlueLightFade: new Color(colors.accentBlue).fade(0.2).toString(),
    accentBlueHeavyFade: new Color(colors.accentBlue).fade(0.7).toString(),
    accentTextBlack: new Color(colors.accentTextBlack).lighten(0.25).toString(),
    accentTextWhiteFade: new Color(colors.accentTextWhite).fade(0.2).toString(),
    brandingOrangeLightFade: new Color(colors.brandingOrange).fade(0.2).toString(),
    brandingOrangeHeavyFade: new Color(colors.brandingOrange).fade(0.7).toString(),

    // Background
    backgroundNeutral: new Color(colors.backgroundNeutral).darken(0.1).toString(),
    backgroundNeutralLighter: new Color(colors.backgroundNeutral).lighten(0.05).toString(),
};

export {
    colors,
    colorVariations,
};
