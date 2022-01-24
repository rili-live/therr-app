import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';
import { containerStyles } from './base';

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        inputsContainer: {
            marginTop: 10,
        },
        loginContainer: {
            backgroundColor: 'transparent',
            borderRadius: 16,
            marginTop: '4%',
            marginBottom: '4%',
            maxWidth: '100%',
            minWidth: '98%',
            padding: 24,
            height: '100%',
        },
        button: {
            backgroundColor: therrTheme.colors.primary3,
            display: 'flex',
            alignItems: 'center',
        },
        buttonLink: {
            color: therrTheme.colors.primary3,
        },
        submitButtonContainer: {
            ...containerStyles,
        },
        registerButtonContainer: {
            ...containerStyles,
            paddingBottom: '15%',
        },
        moreLinksContainer: {
            ...containerStyles,
            marginTop: 6,
            marginBottom: 50,
        },
        forgotPassowrdInputsContainer: {
            marginTop: 10,
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
