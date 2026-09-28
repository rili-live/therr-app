import React from 'react';
import { GestureResponderEvent, View } from 'react-native';
import { Button } from '../../BaseButton';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../../../styles/themes';
import Alert from '../../Alert';
import UserImage from '../../UserContent/UserImage';
import { reportUserImageFailure, uploadProfilePicture } from '../../../utilities/userImage';

interface ICreateProfilePictureProps {
    user: any;
    errorMsg: string;
    isDisabled: boolean;
    requestUserUpdate: Function;
    onCropComplete: Function;
    onInputChange: Function;
    onContinue: ((event: GestureResponderEvent) => void) | undefined;
    translate: Function;
    theme: {
        colors: ITherrThemeColors;
        colorVariations: ITherrThemeColorVariations;
        styles: any;
    };
    themeAlerts: {
        colorVariations: ITherrThemeColorVariations;
        styles: any;
    };
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeSettingsForm: {
        styles: any;
    };
    userImageUri: string;
}

interface ICreateProfilePictureState {
}

class CreateProfilePicture extends React.Component<ICreateProfilePictureProps, ICreateProfilePictureState> {
    constructor(props) {
        super(props);

        this.state = {};
    }

    onDoneCropping = (croppedImageDetails) => {
        const { onCropComplete, requestUserUpdate, translate, user } = this.props;

        if (!croppedImageDetails.didCancel && !croppedImageDetails.errorCode) {
            onCropComplete(croppedImageDetails);

            uploadProfilePicture(croppedImageDetails).then((imageUploadResponse) => {
                requestUserUpdate(imageUploadResponse);
            }).catch((err) => {
                // Clear the preview so the screen does not show a photo that was never saved.
                onCropComplete({});
                reportUserImageFailure({ stage: 'upload', err, userId: user?.details?.id, translate });
            });
        }
    };

    render() {
        const {
            user,
            errorMsg,
            isDisabled,
            onContinue,
            translate,
            theme,
            themeAlerts,
            themeForms,
            themeSettingsForm,
            userImageUri,
        } = this.props;

        return (
            <View style={themeSettingsForm.styles.userContainer}>
                <Alert
                    containerStyles={themeSettingsForm.styles.alert}
                    isVisible={errorMsg}
                    message={errorMsg}
                    type="error"
                    themeAlerts={themeAlerts}
                />
                <UserImage
                    user={user}
                    onImageReady={this.onDoneCropping}
                    translate={translate}
                    theme={theme}
                    themeForms={themeForms}
                    userImageUri={userImageUri}
                />
                <View style={themeSettingsForm.styles.submitButtonContainer}>
                    <Button
                        buttonStyle={themeForms.styles.buttonPrimary}
                        disabledStyle={themeForms.styles.buttonDisabled}
                        titleStyle={themeForms.styles.buttonTitle}
                        disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                        title={translate(
                            'forms.createProfile.buttons.submit'
                        )}
                        onPress={onContinue}
                        raised={false}
                        disabled={isDisabled}
                    />
                </View>
            </View>
        );
    }
}

export default CreateProfilePicture;
