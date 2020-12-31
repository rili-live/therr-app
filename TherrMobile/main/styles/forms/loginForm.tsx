import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';
import { containerStyles } from './base';

export default StyleSheet.create({
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
    },
});
