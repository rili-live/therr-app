import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

const submitButtonStyles: any = {
    paddingRight: 10,
    paddingLeft: 10,
};

const buttonContainerStyles: any = {
    marginBottom: 20,
    marginTop: 20,
};

const backButtonDimension = 42;

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
    backButton: {
        // borderRadius: 50,
        backgroundColor: therrTheme.colors.beemo1,
        height: backButtonDimension,
        width: backButtonDimension,
    },
    backButtonContainer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        left: 20,
        bottom: 20,
        elevation: 3,
        borderRadius: backButtonDimension / 2,
    },
    backButtonContainerFixed: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
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
    },
    submitCancelButtonContainer: {
        ...buttonContainerStyles,
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
        ...buttonContainerStyles,
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
});
