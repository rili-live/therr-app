import { Platform, StyleSheet } from 'react-native';
import { buttonMenuHeight } from './navigation/buttonMenu';
import * as therrTheme from './themes';

export const IOS_STATUS_HEIGHT = 20;
export const IOS_TOP_GAP = 28;
export const HEADER_EXTRA_HEIGHT = 4;
export const HEADER_HEIGHT = 48 + HEADER_EXTRA_HEIGHT;

export const theme = {
    dark: true,
    colors: {
        primary: therrTheme.colors.primary,
        background: therrTheme.colors.primary2,
        card: therrTheme.colors.primary,
        text: therrTheme.colors.textWhite,
        border: therrTheme.colors.primary3,
        notification: therrTheme.colors.primary3,
    },
};

const HEADER_HEIGHT_MARGIN = 80;

const sectionTitle: any = {
    marginBottom: 8,
    fontSize: 24,
    fontWeight: '500',
};

const bodyStyle: any = {
    backgroundColor: therrTheme.colors.primary2,
    color: therrTheme.colors.textWhite,
    marginTop: 0,
};

const headerStyles: any = {
    backgroundColor: bodyStyle.backgroundColor,
    shadowOpacity: 0,
    elevation: 0,
    borderBottomColor: therrTheme.colors.primary,
    height: Platform.OS === 'ios'
        ? (IOS_STATUS_HEIGHT + IOS_TOP_GAP + HEADER_HEIGHT)
        : (HEADER_HEIGHT + HEADER_EXTRA_HEIGHT + 20),
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

const loaderStyles = StyleSheet.create({
    lottie: {
        width: 100,
        height: 100,
    },
});

export default StyleSheet.create({
    safeAreaView: {
        marginTop: Platform.OS === 'ios' ? IOS_STATUS_HEIGHT : 10,
        flex: 1,
    },
    scrollView: {
        marginBottom: buttonMenuHeight,
    },
    body: {
        ...bodyStyle,
    },
    bodyShift: {
        ...bodyStyle,
        marginTop: HEADER_HEIGHT_MARGIN,
    },
    bodyFlex: {
        ...bodyStyle,
        marginBottom: 0,
        padding: 20,
    },
    bodyScroll: {
        backgroundColor: therrTheme.colors.primary2,
        color: therrTheme.colors.textWhite,
        justifyContent: 'center',
        display: 'flex',
        minHeight: '90%',
    },
    bodyScrollSmall: {
        backgroundColor: therrTheme.colors.primary2,
        color: therrTheme.colors.textWhite,
        justifyContent: 'center',
        display: 'flex',
        minHeight: '70%',
    },
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
        color: therrTheme.colors.secondary,
        marginLeft: 2,
        elevation: 1,
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 5,
        height: 32,
        width: 32,
    },
    logoIconBlack: {
        color: therrTheme.colors.beemoTextBlack,
        marginLeft: 2,
        elevation: 1,
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 5,
        height: 32,
        width: 32,
    },
    sectionContainer: {
        marginTop: 8,
        marginBottom: 8,
        paddingHorizontal: 24,
    },
    sectionContainerAlt: {
        marginTop: 4,
        marginBottom: 12,
        paddingHorizontal: 12,
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
    sectionTitleAlt: {
        ...sectionTitle,
        color: therrTheme.colors.textBlack,
    },
    sectionDescription: {
        marginBottom: 10,
        fontSize: 18,
        fontWeight: '400',
        color: therrTheme.colors.textWhite,
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
        ...headerStyles,
        borderBottomWidth: 1,
    },
    headerStyleAlt: {
        ...headerStyles,
    },
    headerStyleBeemo: {
        ...headerStyles,
        backgroundColor: therrTheme.colors.beemo1,
        borderBottomWidth: 2,
        borderBottomColor: '#4950571c',
    },
    headerTitleStyle: {
        fontSize: 18,
        alignSelf: 'center',
        textAlign: 'center',
        justifyContent: 'center',
        flex: 1,
        letterSpacing: 5,
        lineHeight: HEADER_HEIGHT,
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
    footer: {
        color: therrTheme.colors.textWhite,
        fontSize: 12,
        fontWeight: '600',
        padding: 4,
        paddingRight: 12,
        textAlign: 'right',
    },
});

export { loaderStyles };
