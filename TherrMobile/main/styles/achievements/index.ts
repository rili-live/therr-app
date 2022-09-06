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
            flexDirection: 'row',
            padding: 16,
            backgroundColor: therrTheme.colors.backgroundWhite,
            borderRadius: 8,
            marginBottom: 16,
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
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
};
