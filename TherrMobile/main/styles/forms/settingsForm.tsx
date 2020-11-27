import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

export default StyleSheet.create({
    userContainer: {
        backgroundColor: 'transparent',
        borderRadius: 16,
        marginTop: 0,
        marginBottom: 4,
        maxWidth: '100%',
        minWidth: '98%',
        padding: 24,
        paddingBottom: 4,
        paddingTop: 4,
    },
    passwordContainer: {
        backgroundColor: 'transparent',
        borderRadius: 16,
        marginTop: 0,
        marginBottom: '4%',
        maxWidth: '100%',
        minWidth: '98%',
        padding: 24,
        paddingBottom: 58,
        paddingTop: 4,
    },
    button: {
        backgroundColor: therrTheme.colors.primary3,
    },
    submitButtonContainer: {
        marginBottom: 20,
        marginTop: 20,
    },
});
