import { Platform, StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { Theme } from '@react-navigation/native';
import DeviceInfo from 'react-native-device-info';
import { buttonMenuHeight } from './navigation/buttonMenu';
import { getTheme, ITherrTheme } from './themes';
import { therrFontFamily } from './font';


export const HEADER_HEIGHT_MARGIN = 80;
const IOS_STATUS_HEIGHT = 20;
const IOS_TOP_GAP = 28;
const ANDROID_TOP_GAP = 25;
const HEADER_EXTRA_HEIGHT = 4;
const HEADER_HEIGHT = 48 + HEADER_EXTRA_HEIGHT;
const HEADER_PADDING_BOTTOM = 20;

const sectionTitle: any = {
    fontFamily: therrFontFamily,
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

export const logoStyles = {
    elevation: 1,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
};

const getBodyStyles = (theme) => ({
    backgroundColor: theme.colors.primary,
    color: theme.colors.textWhite,
    marginTop: 0,
    top: 0,
});

const addMargins = (marginStyles) => {
    return marginStyles;
};

/**
 * These devices have a punchout camera so the header needs an offset
 * @returns boolean
 */
const hasCutoutCamera = (): boolean => {
    const model = DeviceInfo.getModel();

    if (model?.includes('Pixel 6') || model?.includes('Pixel 7') || model?.includes('Pixel 8') || model?.includes('Pixel 9')) {
        return true;
    }

    return false;
};

const getHeaderHeight = () => {
    const model = DeviceInfo.getModel();
    if (model === 'iPhone SE') {
        return IOS_STATUS_HEIGHT + HEADER_HEIGHT;
    }
    if (Platform.OS === 'ios') {
        return (IOS_STATUS_HEIGHT + IOS_TOP_GAP + HEADER_HEIGHT);
    }

    if (DeviceInfo.hasNotch() || hasCutoutCamera()) {
        return (HEADER_HEIGHT + HEADER_EXTRA_HEIGHT + ANDROID_TOP_GAP + 20);
    }

    return (HEADER_HEIGHT + HEADER_EXTRA_HEIGHT + 20);
};

const getHeaderStyles = (theme: ITherrTheme) => ({
    backgroundColor: getBodyStyles(theme).backgroundColor,
    borderBottomColor: theme.colorVariations.primary3LightFade,
    height: getHeaderHeight(),
    minHeight: getHeaderHeight(),
    borderBottomWidth: 0,
    elevation: 0,
    shadowColor: 'transparent',
});

const getSectionDescriptionStyles = (theme: ITherrTheme): any => ({
    fontFamily: therrFontFamily,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: '400',
    color: theme.colors.textGray,
});

const getAreaContainerButtonStyles = (): any => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
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
        areaContainer: {

        },
        areaContainerButton: {
            ...getAreaContainerButtonStyles(),
        },
        areaContainerButtonSelected: {
            ...getAreaContainerButtonStyles(),
            borderWidth: 2,
            borderColor: therrTheme.colors.primary3,
            paddingBottom: 8,
        },
        safeAreaView: {
            marginTop: Platform.OS === 'ios' ? 0 : 0,
            flex: 1,
            width: '100%',
            minWidth: '100%', // helps ensure view within bottomSheet is full width
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
            paddingBottom: 20,
        },
        bodyScrollTop: {
            backgroundColor: therrTheme.colors.primary,
            color: therrTheme.colors.textWhite,
            justifyContent: 'flex-start',
            display: 'flex',
            minHeight: '90%',
            paddingBottom: 20,
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
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            backgroundColor: therrTheme.colors.backgroundWhite,
        },
        logoIcon: {
            color: therrTheme.colors.accentLogo,
            marginLeft: 2,
        },
        logoIconDark: {
            ...logoStyles,
            color: therrTheme.colorVariations.primary2Darken,
            marginLeft: 2,
            height: 32,
            width: 32,
        },
        logoIconBlack: {
            ...logoStyles,
            color: therrTheme.colors.accentTextBlack,
            marginLeft: 2,
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
        sectionContainerBottomSheet: {
            display: 'flex',
            flexDirection: 'row',
            marginTop: 0,
            marginBottom: 0,
            paddingHorizontal: 12,
            paddingVertical: 4,
        },
        sectionContainerWide: {
            marginTop: 12,
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
        sectionTitleSmall: {
            ...sectionTitle,
            color: therrTheme.colors.textWhite,
            fontSize: 20,
        },
        sectionTitleSmallCenter: {
            ...sectionTitle,
            color: therrTheme.colors.textWhite,
            fontSize: 20,
            textAlign: 'center',
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
        sectionTitleBottomSheet: {
            ...sectionTitle,
            fontSize: 20,
            fontWeight: '400',
            color: therrTheme.colors.brandingBlack,
            marginBottom: 8,
            marginTop: 8,
        },
        sectionDescription: {
            ...getSectionDescriptionStyles(therrTheme),
        },
        sectionDescription16: {
            ...getSectionDescriptionStyles(therrTheme),
            fontSize: 16,
        },
        sectionDescriptionNote: {
            ...getSectionDescriptionStyles(therrTheme),
            textAlign: 'center',
            fontSize: 12,
            marginBottom: 20,
        },
        sectionLabel: {
            ...getSectionDescriptionStyles(therrTheme),
            fontSize: 14,
            marginBottom: 8,
            color: therrTheme.colors.accentTextWhite,
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
            borderBottomWidth: 1,
            borderBottomColor: therrTheme.colors.accentDivider,
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
            fontSize: 20,
            fontFamily: Platform.OS === 'ios' ? 'Lexend-Regular' : 'monospace',
            alignSelf: 'center',
            textAlign: 'center',
            justifyContent: 'center',
            flex: 1,
            letterSpacing: Platform.OS === 'ios' ? 1 : 2,
            lineHeight: HEADER_HEIGHT,
            overflow: 'hidden',
            fontWeight: 'bold',
        },
        headerTitleLogoText: {
            ...headerTitleStyles,
            marginBottom: (Platform.OS === 'ios' && Platform.isPad) ? HEADER_PADDING_BOTTOM : HEADER_PADDING_BOTTOM / 2,
            paddingBottom: 2,
        },
        headerSearchContainer: {
            ...headerTitleStyles,
            marginBottom: (Platform.OS === 'ios' && Platform.isPad) ? HEADER_PADDING_BOTTOM : HEADER_PADDING_BOTTOM / 2,
        },
        headerSearchInputContainer: {
            height: HEADER_HEIGHT - HEADER_PADDING_BOTTOM,
            margin: 0,
            padding: 0,
            borderRadius: 8,
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
        therrFont: {
            fontFamily: therrFontFamily,
        },
        footer: {
            color: therrTheme.colors.textWhite,
            fontSize: 12,
            fontWeight: '600',
            padding: 4,
            paddingRight: 12,
            textAlign: 'right',
        },
        tabviewContainer: {
            width: '100%',
            flex: 1,
        },
        carouselSpacingFooter: {
            height: buttonMenuHeight,
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
