import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';

const container: any = {
    backgroundColor: 'transparent',
    borderRadius: 16,
    marginTop: 0,
    maxWidth: '100%',
    minWidth: '98%',
    padding: 24,
    paddingTop: 4,
};

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        userContainer: {
            ...container,
            marginBottom: 4,
            paddingBottom: 4,
        },
        settingsContainer: {
            ...container,
            marginBottom: 4,
            paddingBottom: 4,
        },
        passwordContainer: {
            ...container,
            marginBottom: '4%',
            paddingBottom: 58,
        },
        button: {
            backgroundColor: therrTheme.colors.primary3,
        },
        submitButtonContainer: {
            marginBottom: 20,
            marginTop: 20,
        },
        alert: {
            marginBottom: 24,
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
