import { StyleSheet } from 'react-native';
import { buttonMenuHeight } from './navigation/buttonMenu';
import * as therrTheme from './themes';

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
    fontWeight: '600',
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
    shadowColor: 'transparent',
    borderBottomColor: therrTheme.colors.primary,
};

const loaderStyles = StyleSheet.create({
    lottie: {
        width: 100,
        height: 100,
    },
});

export default StyleSheet.create({
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
    highlight: {
        fontWeight: '700',
    },
    link: {
        color: therrTheme.colors.hyperlink,
    },
    overlay: {
        height: '100%',
        width: '100%',
        padding: 0,
        margin: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
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
