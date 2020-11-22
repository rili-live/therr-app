import { StyleSheet } from 'react-native';
import * as therrTheme from './themes/ocean';

export const theme = {
    dark: true,
    colors: {
        primary: therrTheme.colors.primary,
        background: therrTheme.colors.primary2,
        card: therrTheme.colors.primary,
        text: therrTheme.colors.textWhite,
        border: therrTheme.colors.primary3,
    },
};

const sectionTitle: any = {
    marginBottom: 8,
    fontSize: 24,
    fontWeight: '600',
};

const loaderStyles = StyleSheet.create({
    lottie: {
        width: 100,
        height: 100,
    },
});

export default StyleSheet.create({
    scrollView: {},
    body: {
        backgroundColor: '#1f597d',
        color: therrTheme.colors.textWhite,
    },
    logoIcon: {
        color: therrTheme.colors.textWhite,
        marginLeft: 2,
    },
    sectionContainer: {
        marginTop: 16,
        marginBottom: 16,
        paddingHorizontal: 24,
    },
    sectionContainerAlt: {
        marginTop: 4,
        marginBottom: 12,
        paddingHorizontal: 12,
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
    highlight: {
        fontWeight: '700',
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
