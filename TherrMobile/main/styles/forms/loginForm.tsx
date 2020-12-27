import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

export default StyleSheet.create({
    loginContainer: {
        backgroundColor: 'transparent',
        borderRadius: 16,
        marginTop: '4%',
        marginBottom: '4%',
        maxWidth: '100%',
        minWidth: '98%',
        padding: 24,
    },
    button: {
        backgroundColor: therrTheme.colors.primary3,
    },
    buttonLink: {
        color: therrTheme.colors.primary3,
    },
    submitButtonContainer: {
        marginTop: 18,
        marginBottom: 20,
    },
    moreLinksContainer: {
        marginTop: 18,
        marginBottom: 20,
    },
});
