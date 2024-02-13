import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        buttons: {
            backgroundColor: 'transparent',
            height: 50,
        },
        buttonsActive: {
            backgroundColor: 'transparent',
            height: 50,
        },
        buttonsTitle: {
            backgroundColor: 'transparent',
            color: therrTheme.colors.secondary,
            paddingRight: 10,
            paddingLeft: 10,
        },
        buttonsTitleActive: {
            backgroundColor: 'transparent',
            color: therrTheme.colors.secondary,
            paddingRight: 10,
            paddingLeft: 10,
        },
        iconStyle: {
            color: therrTheme.colors.secondary,
            // position: 'absolute',
            // left: 20
        },
        containerHeader: {
            backgroundColor: therrTheme.colors.brandingWhite,
            width: '100%',
            borderBottomColor: therrTheme.colors.accentDivider,
            borderBottomWidth: 1,
            marginTop: 0,
            marginBottom: 0,
            paddingTop: 10,
            paddingHorizontal: 20,
        },
        container: {
            width: '100%',
            marginTop: 20,
            marginBottom: 4,
            padding: 20,
            paddingVertical: 4,
            flex: 1,
        },
        categoriesContainer: {
            marginTop: 20,
            marginBottom: -10,
        },
        bodyEdit: {
            backgroundColor: therrTheme.colors.accent1,
            padding: 0,
            flex: 1,
            marginTop: -30, // Helps cover theme background color
            paddingTop: 30, // Helps cover theme background color
            marginBottom: -30, // Helps cover theme background color
            paddingBottom: 30, // Helps cover theme background color
        },
        bodyEditScroll: {
            color: therrTheme.colors.textWhite,
            justifyContent: 'center',
            backgroundColor: therrTheme.colors.accent1,
            paddingBottom: 100,
        },
        bodyView: {
            backgroundColor: therrTheme.colors.accent1,
            padding: 0,
            height: '100%',
            marginTop: -30, // Helps cover theme background color
            paddingTop: 30, // Helps cover theme background color
            marginBottom: -30, // Helps cover theme background color
            paddingBottom: 30, // Helps cover theme background color
        },
        bodyViewScroll: {
            backgroundColor: therrTheme.colors.accent1,
            paddingBottom: 110,
        },
        footer: {
            display: 'flex',
            flexDirection: 'row',
            height: 80,
            flex: 1,
            paddingHorizontal: 30,
            position: 'absolute',
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'flex-end',
            width: '100%',
            backgroundColor: therrTheme.colors.primary,
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
