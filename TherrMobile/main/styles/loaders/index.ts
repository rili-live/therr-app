import { StyleSheet, Platform } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme, ITherrTheme } from '../themes';

const containerStyles: any = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    padding: 8,
    zIndex: -1,
};

const getTextStyles = (theme: ITherrTheme) => ({
    fontFamily: Platform.OS === 'ios' ? 'Lexend-Regular' : 'Lexend-Regular',
    color: theme.colors.textBlack,
    marginVertical: 50,
    paddingHorizontal: 10,
    fontSize: 20,
    textAlign: 'center',
});

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        // container styles
        defaultContainer: {
            ...containerStyles,
        },
        claimASpace: {
            ...containerStyles,
            width: '100%',
            height: 200,
        },
        earthLoaderContainer: {
            ...containerStyles,
            marginHorizontal: '35%',
        },
        therrBlackRollingContainer: {
            ...containerStyles,
            marginHorizontal: '35%',
        },
        karaokeContainer: {
            ...containerStyles,
        },
        yellowCarContainer: {
            ...containerStyles,
        },

        // test styles
        defaultText: {
            ...getTextStyles(therrTheme),
            color: therrTheme.colors.brandingBlack,
        },
        therrBlackRollingText: {
            ...getTextStyles(therrTheme),
            color: therrTheme.colorVariations.textWhiteFade,
        },
        karaokeText: {
            ...getTextStyles(therrTheme),
        },
        yellowCarText: {
            ...getTextStyles(therrTheme),
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
