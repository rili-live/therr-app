import Color from 'color';

const colors = {
    primary: '#1d6f79',
    primary2: '#387a82',
    primary2Faded: '#438a92',
    primary3: '#143b54',
    primary3Faded: '#355469',

    secondary: '#388254',
    secondaryFaded: '#4e8e67',
    ternary: '#e0c845',
    ternary2: '#ffc269',
    textBlack: '#363636',
    textGray: '#bfc7d5',
    textDarkGray: '#728f94',
    textWhite: '#fcfeff',
    brandingMapYellow: '#ebc300',
    brandingOrange: '#f9ad2a',
    brandingLightBlue: '#d8f0f2',

    backgroundWhite: '#ffffff',
    backgroundGray: '#f6fbff',
    borderLight: 'gray',
    placeholderTextColor: '#78909b',

    hyperlink: '#0e01b3',

    beemo1: '#5cb19e',
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
    beemoTeal: '#00def3',
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
    primary2Darken: new Color(colors.primary2).darken(0.075).toString(),
    primary3Fade: new Color(colors.primary3).fade(0.25).toString(),
    textBlackFade: new Color(colors.textBlack).fade(0.75).toString(),
    beemoBlueLightFade: new Color(colors.beemoBlue).fade(0.2).toString(),
    beemoBlueHeavyFade: new Color(colors.beemoBlue).fade(0.7).toString(),
    beemoTextBlack: new Color(colors.beemoTextBlack).lighten(0.25).toString(),
    beemoTextWhiteFade: new Color(colors.beemoTextWhite).fade(0.1).toString(),
};

export default colors;

export {
    colorVariations,
};
