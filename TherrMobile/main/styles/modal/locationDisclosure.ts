import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        overlay: {
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
        },
        container: {
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            width: '90%',
            padding: 10,
            backgroundColor: therrTheme.colors.backgroundGray,
            elevation: 5,
            borderRadius: 12,
        },
        header: {
            fontSize: 20,
            fontWeight: '800',
            paddingBottom: 8,
        },
        text: {
            paddingBottom: 5,
        },
        textEmphasis: {
            fontWeight: '700',
            paddingBottom: 10,
        },
        textLink: {
            color: therrTheme.colors.primary3,
            textDecorationLine: 'underline',
            paddingTop: 8,
        },
        // The dialog container centers its children, which would shrink the scroll area
        // to the width of its longest line; the explicit full width keeps the disclosure
        // text left-aligned and justified against the dialog edges.
        scrollArea: {
            width: '100%',
            paddingHorizontal: 16,
        },
        scrollContent: {
            paddingVertical: 4,
        },
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
};
