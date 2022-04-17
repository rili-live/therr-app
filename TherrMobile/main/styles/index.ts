import { Platform, StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { Theme } from '@react-navigation/native';
import { buttonMenuHeight } from './navigation/buttonMenu';
import { getTheme, ITherrTheme } from './themes';


const HEADER_HEIGHT_MARGIN = 80;
const IOS_STATUS_HEIGHT = 20;
const IOS_TOP_GAP = 28;
const HEADER_EXTRA_HEIGHT = 4;
const HEADER_HEIGHT = 48 + HEADER_EXTRA_HEIGHT;
const HEADER_PADDING_BOTTOM = 20;

const sectionTitle: any = {
    fontFamily: Platform.OS === 'ios' ? 'Lexend-Regular' : 'Lexend-Regular',
    marginBottom: 8,
    fontSize: 24,
    fontWeight: '500',
};

const overlayStyles: any = {
    top: 0,
    left: 0,
    paddingTop: Platform.OS === 'ios' ? IOS_STATUS_HEIGHT + IOS_TOP_GAP : 0,
    height: '100%',
    width: '100%',
    padding: 0,
    margin: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
};

const headerTitleStyles: any = {
    flex: 1,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
    flexDirection: 'column',
    height: HEADER_HEIGHT,
};

const loaderStyles = StyleSheet.create({
    lottie: {
        width: 100,
        height: 100,
    },
});

const getBodyStyles = (theme) => ({
    backgroundColor: theme.colors.primary,
    color: theme.colors.textWhite,
    marginTop: 0,
    top: 0,
});

const addMargins = (marginStyles) => {
    return marginStyles;
};

const getHeaderStyles = (theme: ITherrTheme) => ({
    backgroundColor: getBodyStyles(theme).backgroundColor,
    borderBottomColor: theme.colorVariations.primary3LightFade,
    height: Platform.OS === 'ios'
        ? (IOS_STATUS_HEIGHT + IOS_TOP_GAP + HEADER_HEIGHT)
        : (HEADER_HEIGHT + HEADER_EXTRA_HEIGHT + 20),
    minHeight: Platform.OS === 'ios'
        ? (IOS_STATUS_HEIGHT + IOS_TOP_GAP + HEADER_HEIGHT)
        : (HEADER_HEIGHT + HEADER_EXTRA_HEIGHT + 20),
    borderBottomWidth: 0,
    elevation: 0,
    shadowColor: 'transparent',
});

const getSectionDescriptionStyles = (theme: ITherrTheme): any => ({
    fontFamily: Platform.OS === 'ios' ? 'Lexend-Regular' : 'Lexend-Regular',
    marginBottom: 10,
    fontSize: 18,
    fontWeight: '400',
    color: theme.colors.textGray,
});

const buildNavTheme = (theme: ITherrTheme): Theme => {
    return ({
        dark: true,
        colors: {
            primary: theme.colors.primary,
            background: theme.colors.primary,
            card: theme.colors.primary,
            text: theme.colors.textWhite,
            border: theme.colors.primary3,
            notification: theme.colors.primary3,
        },
    });
};

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        safeAreaView: {
            marginTop: Platform.OS === 'ios' ? 0 : 0,
            flex: 1,
        },
        scrollView: {
            marginBottom: buttonMenuHeight,
        },
        scrollViewFull: {
            marginBottom: 0,
        },
        body: {
            ...getBodyStyles(therrTheme),
        },
        bodyShift: {
            ...getBodyStyles(therrTheme),
            marginTop: HEADER_HEIGHT_MARGIN,
        },
        bodyFlex: {
            ...getBodyStyles(therrTheme),
            marginBottom: 0,
            padding: 20,
        },
        bodyScroll: {
            backgroundColor: therrTheme.colors.primary,
            color: therrTheme.colors.textWhite,
            justifyContent: 'center',
            display: 'flex',
            minHeight: '90%',
        },
        bodyScrollSmall: {
            backgroundColor: therrTheme.colors.primary,
            color: therrTheme.colors.textWhite,
            justifyContent: 'center',
            display: 'flex',
            minHeight: '70%',
        },
        displayNone: { display: 'none' },
        imageContainer: {
            flex: 1,
            justifyContent: 'space-around',
            height: 150,
            width: 150,
            borderRadius: 75,
        },
        listItemCard: {
            backgroundColor: therrTheme.colors.backgroundGray,
        },
        logoIcon: {
            color: therrTheme.colors.textWhite,
            marginLeft: 2,
        },
        logoIconDark: {
            color: therrTheme.colorVariations.primary2Darken,
            marginLeft: 2,
            elevation: 1,
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 5,
            height: 32,
            width: 32,
        },
        logoIconBlack: {
            color: therrTheme.colors.accentTextBlack,
            marginLeft: 2,
            elevation: 1,
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 5,
            height: 32,
            width: 32,
        },
        sectionContainer: {
            marginTop: 18,
            marginBottom: 8,
            paddingHorizontal: 15,
        },
        sectionContainerAlt: {
            marginTop: 4,
            marginBottom: 12,
            paddingHorizontal: 12,
        },
        sectionContainerWide: {
            marginTop: 18,
            marginBottom: 8,
            paddingHorizontal: 0,
        },
        sectionForm: {
            color: therrTheme.colors.textWhite,
            backgroundColor: 'transparent',
            marginTop: 0,
        },
        sectionTitle: {
            ...sectionTitle,
            color: therrTheme.colors.textWhite,
        },
        sectionTitleCenter: {
            ...sectionTitle,
            color: therrTheme.colors.textWhite,
            textAlign: 'center',
        },
        sectionTitleAlt: {
            ...sectionTitle,
            color: therrTheme.colors.textBlack,
        },
        sectionDescription: {
            ...getSectionDescriptionStyles(therrTheme),
        },
        sectionDescriptionNote: {
            ...getSectionDescriptionStyles(therrTheme),
            textAlign: 'center',
            fontSize: 12,
            marginBottom: 20,
        },
        sectionDescriptionCentered: {
            ...getSectionDescriptionStyles(therrTheme),
            textAlign: 'center',
            fontSize: 16,
        },
        sectionQuote: {
            display: 'flex',
            flexWrap: 'wrap',
            fontStyle: 'italic',
            marginBottom: 18,
            fontSize: 16,
            fontWeight: '400',
            color: therrTheme.colors.textWhite,
            textAlign: 'center',
            opacity: 0.85,
        },
        spacer: {
            marginTop: '16%',
            marginBottom: '16%',
        },
        headerStyle: {
            ...getHeaderStyles(therrTheme),
            // borderBottomWidth: 2,
        },
        headerStyleNoShadow: {
            ...getHeaderStyles(therrTheme),
            // shadowColor: 'transparent',
        },
        headerStyleAccent: {
            ...getHeaderStyles(therrTheme),
            backgroundColor: therrTheme.colors.accent1,
            // borderBottomWidth: 2,
            borderBottomColor: therrTheme.colors.accentDivider,
        },
        headerTitleStyle: {
            fontSize: 18,
            fontFamily: Platform.OS === 'ios' ? 'Lexend-Regular' : 'monospace',
            alignSelf: 'center',
            textAlign: 'center',
            justifyContent: 'center',
            flex: 1,
            letterSpacing: Platform.OS === 'ios' ? 2 : 3,
            lineHeight: HEADER_HEIGHT,
            overflow: 'hidden',
            fontWeight: 'bold',
        },
        headerTitleLogoText: {
            ...headerTitleStyles,
            marginBottom: (Platform.OS === 'ios' && Platform.isPad) ? HEADER_PADDING_BOTTOM : HEADER_PADDING_BOTTOM / 2,
        },
        headerSearchContainer: {
            ...headerTitleStyles,
            marginBottom: (Platform.OS === 'ios' && Platform.isPad) ? HEADER_PADDING_BOTTOM : HEADER_PADDING_BOTTOM / 2,
        },
        headerSearchInputContainer: {
            height: HEADER_HEIGHT - HEADER_PADDING_BOTTOM,
            margin: 0,
            padding: 0,
        },
        highlight: {
            fontWeight: '700',
        },
        link: {
            color: therrTheme.colors.hyperlink,
        },
        overlay: {
            ...overlayStyles,
        },
        overlayInvisible: {
            ...overlayStyles,
            height: 0,
            width: 0,
        },
        stretch: {
            flex: 1,
        },
        textCenter: {
            textAlign: 'center',
        },
        footer: {
            color: therrTheme.colors.textWhite,
            fontSize: 12,
            fontWeight: '600',
            padding: 4,
            paddingRight: 12,
            textAlign: 'right',
        },
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
    buildNavTheme,
    addMargins,

    loaderStyles,

    IOS_STATUS_HEIGHT,
    IOS_TOP_GAP,
    HEADER_EXTRA_HEIGHT,
    HEADER_HEIGHT,
    HEADER_PADDING_BOTTOM,
};
