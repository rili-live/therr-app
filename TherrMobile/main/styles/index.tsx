import { StyleSheet } from 'react-native';

export const theme = {
    dark: true,
    colors: {
        primary: '#1b4a69',
        background: '#1f597d',
        card: '#1b4a69',
        text: '#fcfeff',
        border: '#143b54',
    },
};

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
