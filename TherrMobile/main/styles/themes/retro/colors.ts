import Color from 'color';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../';

const _brandFaded = new Color('#143b54').fade(0.25).toString();

const colors: ITherrThemeColors = {
    // Semantic aliases — retro keeps brand=teal, but its `brandDark` is the
    // distinct dark-blue retro accent (today's `primary3`). Surfaces are
    // retro's teal-tinted backgrounds. `accent` here is a warm teal because
    // retro doesn't use orange the way light/dark themes do.
    brand: '#1C7F8A',
    brandDark: '#143b54',
    brandFaded: _brandFaded,
    surface: '#1a6d76',
    surfaceAlt: '#155862',
    onSurface: '#fcfeff',
    onSurfaceMuted: 'rgba(255,255,255,.78)',
    onBrand: '#fcfeff',
    border: 'gray',
    accent: '#1E8A96',
    onAccent: '#fcfeff',

    // Legacy
    primary: '#3B2A4E',
    primary2: '#52406D',
    primary3: '#1E1530',
    primary4: '#6B4F8A',
    primary5: '#3B2A4E',
    secondary: '#7A5C9F',
    ternary: '#e0c845',
    ternary2: '#ffc269',
    tertiary: '#241832',

    // Text
    textBlack: '#D4C7E0',
    textDark: '#B9A8CC',
    textGray: 'rgba(255,255,255,.78)',
    textDarkGray: '#9583AE',
    textWhite: '#fcfeff',
    selectionColor: '#E37107',

    // Branding - These colors should remain unchanged regardless of theme
    brandingWhite: '#fcfeff',
    brandingBlack: '#1A0E26',
    brandingBlueGreen: '#3B2A4E',
    brandingMapYellow: '#ebc300',
    brandingOrange: '#DE6E07',
    brandingRed: '#ff3041',
    brandingLightBlue: '#E8DEF2',

    // Background
    backgroundCream: '#B3A5C3',
    backgroundWhite: '#2E2140',
    backgroundGray: '#271C36',
    backgroundNeutral: '#2A1E3A',
    backgroundBlack: '#000000',
    inputBackgroundAndroid: 'rgba(255,255,255,.15)',
    inputBackgroundIOS: 'rgba(255,255,255,.1)',

    borderLight: 'gray',
    placeholderTextColor: '#78909b',
    placeholderTextColorAlt: 'rgba(255,255,255,.58)',

    hyperlink: '#64B5F6',
    controlButtons: 'rgba(255, 255, 255, 0.92)',

    // Alerts
    alertError: '#AC3E59',
    alertSuccess: '#26B379',
    alertWarning: '#FDBD2E',
    alertInfo: '#22A5B4',

    // Accents - Alternate color scheme to add variety and reduce blandless
    accent1: '#52406D',
    accent1Fade: '#B9A8CC',
    accent2: '#E8DEF2',
    accent3: '#218a35',
    accentAlt: '#9583AE',
    accentTextBlack: '#1A0E26',
    accentTextWhite: '#fafafa',
    accentRed: '#fe0156',
    accentYellow: '#fed61e',
    accentBlue: '#52406D',
    accentPurple: '#9C7CF4',
    accentTeal: '#2BC5D6',
    accentLime: '#00f729',
    accentDivider: '#4950571c',
    accentLogo: '#fcfeff',

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
    primary3Disabled: new Color(colors.primary3).lighten(0.25).desaturate(0.1).toString(),
    primary4Fade: new Color(colors.primary4).fade(0.5).toString(),
    backgroundCreamLighten: new Color(colors.backgroundCream).lighten(0.02).toString(),
    backgroundBlackFade: new Color(colors.backgroundBlack).fade(0.85).toString(),
    textBlackFade: new Color(colors.textBlack).fade(0.75).toString(),
    textWhiteLightFade: new Color(colors.textWhite).fade(0.25).toString(),
    textWhiteFade: new Color(colors.textWhite).fade(0.75).toString(),
    textGrayDarken: new Color(colors.textGray).darken(0.15).toString(),
    textGrayFade: new Color(colors.textGray).fade(0.15).toString(),
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
