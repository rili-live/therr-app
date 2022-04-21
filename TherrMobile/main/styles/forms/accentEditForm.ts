import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';

const submitButtonStyles: any = {
    paddingRight: 10,
    paddingLeft: 10,
};

const buttonContainerStyles: any = {
    marginBottom: 20,
    marginTop: 20,
};

const backButtonDimension = 42;

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
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
            backgroundColor: therrTheme.colors.accent1,
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
            backgroundColor: therrTheme.colors.accentTeal,
        },
        submitDeleteButton: {
            ...submitButtonStyles,
            backgroundColor: therrTheme.colors.accentRed,
        },
        submitConfirmButton: {
            ...submitButtonStyles,
            backgroundColor: therrTheme.colors.accentPurple,
            color: therrTheme.colors.accentTextWhite,
        },
        submitCancelButton: {
            ...submitButtonStyles,
            backgroundColor: therrTheme.colors.accentYellow,
        },
        submitCancelButtonContainer: {
            ...buttonContainerStyles,
            marginRight: 20,
        },
        submitButtonTitle: {
            color: therrTheme.colors.brandingBlack,
        },
        submitButtonTitleLight: {
            color: therrTheme.colors.brandingWhite,
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

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
};
