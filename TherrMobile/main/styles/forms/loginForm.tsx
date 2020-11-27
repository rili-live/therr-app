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
        paddingTop: 16,
    },
    button: {
        backgroundColor: therrTheme.colors.primary3,
    },
    submitButtonContainer: {
        marginBottom: 20,
    },
});
