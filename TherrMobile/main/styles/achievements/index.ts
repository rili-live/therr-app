import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';

const getProgressBarStyles = (): any => ({
    position: 'absolute',
    height: 18,
    borderRadius: 4,
});

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        achievementTile: {
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: 16,
            backgroundColor: therrTheme.colors.backgroundWhite,
            borderRadius: 8,
            marginBottom: 16,
        },
        achievementTileContainer: {
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            paddingBottom: 8,
        },
        cardImageContainer: {
            width: '30%',
            paddingRight: 16,
        },
        cardImage: {
            resizeMode: 'contain',
            height: 112,
        },
        progressBarBackground: {
            ...getProgressBarStyles(),
            backgroundColor: therrTheme.colors.backgroundNeutral,
            width: '100%',
        },
        progressBar: {
            ...getProgressBarStyles(),
            backgroundColor: therrTheme.colors.primary3,
        },
        completedContainer: {
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 4,
        },
        claimButton: {
            width: '100%',
            backgroundColor: therrTheme.colors.accent3,
            paddingVertical: 6,
            borderRadius: 3,
        },
        claimText: {
            fontWeight: '500',
            color: therrTheme.colors.brandingWhite,
            textAlign: 'center',
        },
        completeText: {
            fontWeight: '500',
            color: therrTheme.colors.accent3,
            textAlign: 'center',
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
