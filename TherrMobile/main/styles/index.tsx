import { StyleSheet } from 'react-native';
import * as therrTheme from './themes/ocean';

export const theme = {
    dark: true,
    colors: {
        primary: therrTheme.colors.primary,
        background: therrTheme.colors.background,
        card: therrTheme.colors.card,
        text: therrTheme.colors.text,
        border: therrTheme.colors.border,
    },
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
        color: '#fcfeff',
    },
    sectionContainer: {
        marginTop: 16,
        marginBottom: 16,
        paddingHorizontal: 24,
    },
    sectionTitle: {
        marginBottom: 8,
        fontSize: 24,
        fontWeight: '600',
        color: '#fcfeff',
    },
    sectionDescription: {
        marginBottom: 10,
        fontSize: 18,
        fontWeight: '400',
        color: '#fcfeff',
    },
    highlight: {
        fontWeight: '700',
    },
    footer: {
        color: '#fcfeff',
        fontSize: 12,
        fontWeight: '600',
        padding: 4,
        paddingRight: 12,
        textAlign: 'right',
    },
});

export { loaderStyles };
