import { StyleSheet } from 'react-native';
import editMomentForm from './editMomentForm';
import loginForm from './loginForm';
import settingsForm from './settingsForm';
import * as therrTheme from '../themes/ocean';

const textInputStyle: any = {
    marginLeft: 10,
    marginRight: 10,
    marginBottom: 20,
    fontSize: 19,
    borderColor: therrTheme.colors.borderLight,
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
};

export default StyleSheet.create({
    input: {
        color: therrTheme.colors.textWhite,
    },
    inputAlt: {
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
