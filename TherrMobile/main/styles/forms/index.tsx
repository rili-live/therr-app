import { StyleSheet } from 'react-native';
import loginForm from './loginForm';
import settingsForm from './settingsForm';
import * as therrTheme from '../themes/ocean';

export default StyleSheet.create({
    input: {
        color: therrTheme.colors.textWhite,
    },
    button: {
        backgroundColor: '#1d5b69',
    },
});

export {
    loginForm,
    settingsForm,
};
