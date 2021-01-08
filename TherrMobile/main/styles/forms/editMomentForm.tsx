import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';
import { inputStyle, textInputStyle } from './base';

const submitButtonStyles: any = {
    paddingRight: 10,
    paddingLeft: 10,
};

export default StyleSheet.create({
    momentContainer: {
        width: '100%',
        marginTop: 0,
        marginBottom: 4,
        padding: 20,
        paddingBottom: 4,
        paddingTop: 4,
        flex: 1,
    },
    button: {
        backgroundColor: therrTheme.colors.primary3,
    },
    previewContainer: {
        paddingHorizontal: 30,
    },
    preview: {

    },
    previewHeader: {
        fontSize: 14,
        paddingBottom: 6,
    },
    submitButton: {
        ...submitButtonStyles,
        backgroundColor: therrTheme.colors.beemoTeal,
    },
    submitButtonTitle: {
        color: therrTheme.colors.textBlack,
    },
    submitDisabledButtonTitle: {
    },
    submitButtonDisabled: {
        ...submitButtonStyles,
    },
    submitButtonContainer: {
        marginBottom: 20,
        marginTop: 20,
    },
    submitButtonIcon: {
        marginRight: 10,
    },
    textInputAlt: {
        ...textInputStyle,
        backgroundColor: therrTheme.colors.beemo2,
        color: therrTheme.colors.beemoTextBlack,
        borderColor: therrTheme.colors.beemoTextBlack,
        borderWidth: 1,
    },
    inputAlt: {
        ...inputStyle,
        backgroundColor: therrTheme.colors.beemo2,
        color: therrTheme.colors.beemoTextBlack,
        borderColor: therrTheme.colors.beemoTextBlack,
        borderWidth: 1,
    },
});
