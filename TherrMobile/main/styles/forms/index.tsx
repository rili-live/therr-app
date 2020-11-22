import { StyleSheet } from 'react-native';
import editMomentForm from './editMomentForm';
import loginForm from './loginForm';
import settingsForm from './settingsForm';
import * as therrTheme from '../themes/ocean';
import { inputStyle, textInputStyle } from './base';

export default StyleSheet.create({
    input: {
        ...inputStyle,
        color: therrTheme.colors.textWhite,
    },
    inputAlt: {
        ...inputStyle,
        color: therrTheme.colors.textBlack,
    },
    textInput: {
        ...textInputStyle,
        color: therrTheme.colors.textWhite,
    },
    textInputAlt: {
        ...textInputStyle,
        color: therrTheme.colors.textBlack,
    },
    button: {
        backgroundColor: '#1d5b69',
    },
});

export {
    editMomentForm,
    loginForm,
    settingsForm,
};
