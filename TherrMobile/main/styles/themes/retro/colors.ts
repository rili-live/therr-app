import Color from 'color';

const colors = {
    // Main
    primary: '#1C7F8A',
    primary2: '#20919E',
    primary3: '#143b54',
    secondary: '#388254',
    secondaryFaded: '#4e8e67',
    ternary: '#e0c845',
    ternary2: '#ffc269',
    tertiary: '#104B52',

    // Text
    textBlack: '#363636',
    textGray: '#bfc7d5',
    textDarkGray: '#728f94',
    textWhite: '#fcfeff',

    // Branding
    brandingMapYellow: '#ebc300',
    brandingOrange: '#f9ad2a',
    brandingLightBlue: '#d8f0f2',

    // Background
    backgroundCream: '#fefbf0',
    backgroundWhite: '#ffffff',
    backgroundGray: '#f3f4f6',
    backgroundNeutral: '#e7eaed',

    borderLight: 'gray',
    placeholderTextColor: '#78909b',

    hyperlink: '#0e01b3',

    // Alerts
    alertError: '#AC3E59',

    // Beemo
    beemo1: '#1E8A96',
    beemo1Fade: '#97c5bb',
    beemo2: '#cbffdc',
    beemo3: '#218a35',
    beemoAlt: '#449885',
    beemoTextBlack: '#001226',
    beemoTextWhite: '#fafafa',
    beemoRed: '#fe0156',
    beemoYellow: '#fed61e',
    beemoBlue: '#17657D',
    beemoPurple: '#0e01b3',
    beemoTeal: '#2BC5D6',
    beemoLime: '#00f729',
    beemoDivider: '#4950571c',

    map: {
        momentsCircleFill: 'rgba(56,130,84,0.2)',
        momentsCircleFillActive: 'rgba(56,130,84,0.5)',
        myMomentsCircleFill: 'rgba(31,89,125,0.2)',
        myMomentsCircleFillActive: 'rgba(31,89,125,0.5)',
        userCircleFill: 'rgba(31,89,125,0.25)',
    },
};

const colorVariations = {
    primaryFade: new Color(colors.primary).fade(0.35).toString(),
    primaryFadeMore: new Color(colors.primary).fade(0.65).toString(),
    primary2Fade: new Color(colors.primary2).fade(0.35).toString(),
    primary2Darken: new Color(colors.primary2).darken(0.075).toString(),
    primary3LightFade: new Color(colors.primary3).fade(0.15).toString(),
    primary3Fade: new Color(colors.primary3).fade(0.25).toString(),
    textBlackFade: new Color(colors.textBlack).fade(0.75).toString(),
    textWhiteFade: new Color(colors.textWhite).fade(0.75).toString(),
    beemo1Fade: new Color(colors.beemo1).fade(0.2).toString(),
    beemoBlueLightFade: new Color(colors.beemoBlue).fade(0.2).toString(),
    beemoBlueHeavyFade: new Color(colors.beemoBlue).fade(0.7).toString(),
    beemoTextBlack: new Color(colors.beemoTextBlack).lighten(0.25).toString(),
    beemoTextWhiteFade: new Color(colors.beemoTextWhite).fade(0.1).toString(),

    // Background
    backgroundNeutral: new Color(colors.backgroundNeutral).darken(0.1).toString(),
    backgroundNeutralLighter: new Color(colors.backgroundNeutral).lighten(0.05).toString(),
};

export default colors;

export {
    colorVariations,
};
