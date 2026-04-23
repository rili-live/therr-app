import Color from 'color';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../';

const colors: ITherrThemeColors = {
    // Main
    primary: '#121212',
    primary2: '#1E1E1E',
    primary3: '#3B2A4E',
    primary4: '#6B4F8A',
    primary5: '#52406D',
    secondary: '#E37107',
    ternary: '#E0E0E0',
    ternary2: '#ffc269',
    tertiary: '#241832',

    // Text
    textBlack: '#E0E0E0',
    textDark: '#B0B0B0',
    textGray: 'rgba(255,255,255,.70)',
    textDarkGray: '#90B0B6',
    textWhite: '#F5F5F5',
    selectionColor: '#E37107',

    // Branding - These colors should remain unchanged regardless of theme
    brandingWhite: '#fcfeff',
    brandingBlack: '#1A0E26',
    brandingBlueGreen: '#3B2A4E',
    brandingMapYellow: '#ebc300',
    brandingOrange: '#DE6E07',
    brandingRed: '#FF3041',
    brandingLightBlue: '#E8DEF2',

    // Background
    backgroundCream: '#9E9E9E',
    backgroundWhite: '#1E1E1E',
    backgroundGray: '#2A2A2A',
    backgroundNeutral: '#333333',
    backgroundBlack: '#000000',
    inputBackgroundAndroid: 'rgba(255,255,255,.08)',
    inputBackgroundIOS: 'rgba(255,255,255,.06)',

    borderLight: '#404040',
    placeholderTextColor: '#78909b',
    placeholderTextColorAlt: 'rgba(255,255,255,.60)',

    hyperlink: '#B9A8CC',
    controlButtons: '#3B2A4E',

    // Alerts
    alertError: '#CF6679',

    // Accents - Alternate color scheme to add variety and reduce blandness
    accent1: '#2A2A2A',
    accent1Fade: '#B9A8CC',
    accent2: '#6B4F8A',
    accent3: '#218a35',
    accentAlt: '#7A5C9F',
    accentTextBlack: '#B9A8CC',
    accentTextWhite: '#F5F5F5',
    accentRed: '#fe0156',
    accentYellow: '#fed61e',
    accentBlue: '#52406D',
    accentPurple: '#BB86FC',
    accentTeal: '#2BC5D6',
    accentLime: '#26B379',
    accentDivider: 'rgba(255,255,255,0.12)',
    accentLogo: '#7A5C9F',

    // Socials
    facebook: '#4167b2',
    instagram: '#E1306C',
    twitter: '#1c9bef',
    tikTok: '#ffffff',
    youtube: '#FF0000',

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
    primary3Disabled: new Color(colors.primary3).lighten(0.25).desaturate(0.1).toString(),
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
