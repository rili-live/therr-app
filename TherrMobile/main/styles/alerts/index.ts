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

    const styles = StyleSheet.create({
        containerSuccess: {
            ...containerStyle,
            backgroundColor: 'rgba(242, 251, 246, .75)',
        },
        containerError: {
            ...containerStyle,
            backgroundColor: 'rgba(251, 243, 242, .75)',
        },
        error: {
            ...messageStyle,
            color: '#780e0e',
        },
        success: {
            ...messageStyle,
            color: '#008C3D',
        },
        iconError: {
            ...getIconStyle(therrTheme),
            color: '#AA0042',
        },
        iconSuccess: {
            ...getIconStyle(therrTheme),
            color: '#008C3D',
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
