import { Platform, StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme, ITherrTheme } from '../themes';

const getTitleStyles = (theme: ITherrTheme): any => ({
    fontFamily: Platform.OS === 'ios' ? 'Lexend-Regular' : 'Lexend-Regular',
    color: theme.colors.textWhite,
    fontSize: 28,
    marginTop: 6,
    marginBottom: 18,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 2,
});

const createProfileGraphicStyles: any = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    padding: 8,
    zIndex: -1,
};

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        title: {
            ...getTitleStyles(therrTheme),
        },
        titleWithSpacing: {
            ...getTitleStyles(therrTheme),
            fontWeight: '800',
            fontFamily: Platform.OS === 'ios' ? 'Lexend-Regular' : 'Lexend-Regular',
            paddingBottom: 20,
            textAlign: 'left',
            letterSpacing: 1,
        },
        titleWithNoSpacing: {
            ...getTitleStyles(therrTheme),
            fontWeight: '800',
            fontFamily: Platform.OS === 'ios' ? 'Lexend-Regular' : 'Lexend-Regular',
            paddingBottom: 0,
            marginBottom: 7,
            textAlign: 'left',
            letterSpacing: 1,
        },
        subtitle: {
            fontSize: 18,
            fontWeight: '600',
            fontFamily: Platform.OS === 'ios' ? 'Lexend-Regular' : 'Lexend-Regular',
            color: therrTheme.colors.textGray,
            paddingBottom: 20,
            marginBottom: 20,
            textAlign: 'left',
            letterSpacing: 1,
        },
        formAGraphic: {
            ...createProfileGraphicStyles,
        },
        formBGraphic: {
            ...createProfileGraphicStyles,
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
