import Color from 'color';
import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme, ITherrTheme } from '../themes';

const containerStyle: any = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 7,
    paddingLeft: 35,
    borderRadius: 0,
};

const getIconStyle = (theme: ITherrTheme): any => ({
    color: theme.colors.textWhite,
    position: 'absolute',
    left: 10,
});

const messageStyle: any = {
    textAlign: 'center',
    fontSize: 16,
};

// Alert container backgrounds use a softened tint of the alert color so the
// banner reads as a wash, not a saturated block. Dark themes get more opacity
// so the tint is visible against a dark surface.
const tint = (hex: string, opacity: number) => new Color(hex).alpha(opacity).toString();

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const isDark = themeName !== 'light';
    const containerBgOpacity = isDark ? 0.2 : 0.12;

    const styles = StyleSheet.create({
        containerSuccess: {
            ...containerStyle,
            backgroundColor: tint(therrTheme.colors.alertSuccess, containerBgOpacity),
        },
        containerError: {
            ...containerStyle,
            backgroundColor: tint(therrTheme.colors.alertError, containerBgOpacity),
        },
        error: {
            ...messageStyle,
            color: therrTheme.colors.alertError,
        },
        success: {
            ...messageStyle,
            color: therrTheme.colors.alertSuccess,
        },
        iconError: {
            ...getIconStyle(therrTheme),
            color: therrTheme.colors.alertError,
        },
        iconSuccess: {
            ...getIconStyle(therrTheme),
            color: therrTheme.colors.alertSuccess,
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
