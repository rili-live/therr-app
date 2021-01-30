import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';
import { inputStyle, textInputStyle } from './base';

const submitButtonStyles: any = {
    paddingRight: 10,
    paddingLeft: 10,
};

export default StyleSheet.create({
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
    submitDeleteButton: {
        ...submitButtonStyles,
        backgroundColor: therrTheme.colors.beemoRed,
    },
    submitConfirmButton: {
        ...submitButtonStyles,
        backgroundColor: therrTheme.colors.beemoPurple,
        color: therrTheme.colors.beemoTextWhite,
    },
    submitCancelButton: {
        ...submitButtonStyles,
        backgroundColor: therrTheme.colors.beemoYellow,
        marginRight: 20,
    },
    submitButtonTitle: {
        color: therrTheme.colors.beemoTextBlack,
    },
    submitButtonTitleLight: {
        color: therrTheme.colors.beemoTextWhite,
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
    submitConfirmContainer: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
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
