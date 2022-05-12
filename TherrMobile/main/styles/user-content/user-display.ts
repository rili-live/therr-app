import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        // Main
        container: {
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
        },
        profileInfoContainer: {
            display: 'flex',
            flexDirection: 'row',
            marginTop: 21,
        },
        profileImageContainer: {
            marginHorizontal: 17,
        },
        profileSummaryContainer: {
            flex: 1,
            paddingRight: 14,
        },
        profileFullName: {
            fontSize: 20,
            fontWeight: '600',
            marginBottom: 8,
        },
        profileBio: {
            fontSize: 14,
            fontWeight: '400',
        },

        // Action Menu
        actionsContainer: {
            display: 'flex',
            flexDirection: 'row',
            marginTop: 15,
        },
        actionMenuContainer: {
            width: '100%',
            marginTop: 10,
        },
        actionMenuItemContainer: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
        },
        actionMenuItemIcon: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 50,
            width: 50,
            marginHorizontal: 4,
        },
        actionMenuItemText: {
            color: therrTheme.colorVariations.accentTextWhiteFade,
            fontSize: 16,
            flex: 1,
            paddingRight: 10,
        },
        separator: {
            width: '94%',
            marginHorizontal: '3%',
            height: 2,
            backgroundColor: therrTheme.colorVariations.accent1Fade,
        },

        // Profile Picture
        profileImage: {
            width: 100,
            height: 100,
            borderRadius: 50,
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
