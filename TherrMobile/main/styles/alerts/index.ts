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

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const isDark = themeName !== 'light';
    const styles = StyleSheet.create({
        containerSuccess: {
            ...containerStyle,
            backgroundColor: isDark ? 'rgba(0, 140, 61, .2)' : 'rgba(242, 251, 246, .75)',
        },
        containerError: {
            ...containerStyle,
            backgroundColor: isDark ? 'rgba(170, 0, 66, .2)' : 'rgba(251, 243, 242, .75)',
        },
        error: {
            ...messageStyle,
            color: isDark ? '#ff6b6b' : '#780e0e',
        },
        success: {
            ...messageStyle,
            color: isDark ? '#4cdf82' : '#008C3D',
        },
        iconError: {
            ...getIconStyle(therrTheme),
            color: isDark ? '#ff6b6b' : '#AA0042',
        },
        iconSuccess: {
            ...getIconStyle(therrTheme),
            color: isDark ? '#4cdf82' : '#008C3D',
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
