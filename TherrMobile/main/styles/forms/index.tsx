import { StyleSheet } from 'react-native';
import editMomentForm from './editMomentForm';
import forgotPasswordForm from './forgotPasswordForm';
import loginForm from './loginForm';
import phoneInput from './phoneInput';
import settingsForm from './settingsForm';
import * as therrTheme from '../themes';
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
    picker: {
        height: 50,
        width: '100%',
        color: therrTheme.colors.textWhite,
    },
    phoneInput: {
        ...inputStyle,
        color: therrTheme.colors.textWhite,
        flex: 1,
        padding: 0,
        paddingBottom: 20,
        marginRight: 10,
    },
    phoneInputText: {
        color: therrTheme.colors.textWhite,
        fontSize: 19,
        padding: 10,
        borderBottomColor: '#78909b',
        borderBottomWidth: 1,
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
        backgroundColor: therrTheme.colors.primary3,
    },
    buttonDisabled: {
        backgroundColor: therrTheme.colors.primary3Faded,
    },
    buttonTitleDisabled: {
        color: therrTheme.colors.textGray,
    },
});

export {
    editMomentForm,
    forgotPasswordForm,
    loginForm,
    phoneInput,
    settingsForm,
};
