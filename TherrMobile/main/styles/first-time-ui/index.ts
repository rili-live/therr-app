import { Platform, StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme, ITherrTheme } from '../themes';

const getTitleStyles = (theme: ITherrTheme): any => ({
    fontFamily: Platform.OS === 'ios' ? 'KohinoorBangla-Light' : 'sans-serif-condensed',
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
            paddingBottom: 20,
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
