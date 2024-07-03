import React from 'react';
import { GestureResponderEvent, View } from 'react-native';
import { Button } from 'react-native-elements';
import RNFB from 'react-native-blob-util';
import { FilePaths } from 'therr-js-utilities/constants';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../../../styles/themes';
import Alert from '../../Alert';
import UserImage from '../../UserContent/UserImage';
import { signImageUrl } from '../../../utilities/content';

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
        const { onCropComplete } = this.props;

        if (!croppedImageDetails.didCancel && !croppedImageDetails.errorCode) {
            const { requestUserUpdate } = this.props;
            onCropComplete(croppedImageDetails);

            this.signAndUploadImage(croppedImageDetails).then((imageUploadResponse) => {
                requestUserUpdate(imageUploadResponse);
            }).catch((err) => {
                console.log(err);
            });
        }
    };

    signAndUploadImage = (croppedImageDetails) => {
        const filePathSplit = croppedImageDetails?.path?.split('.');
        const fileExtension = `${filePathSplit?.[filePathSplit.length - 1]}` || 'jpeg';
        return signImageUrl(true, {
            action: 'write',
            filename: `${FilePaths.PROFILE_PICTURE}.${fileExtension}`,
        }).then((response) => {
            const signedUrl = response?.data?.url && response?.data?.url[0];

            const localFileCroppedPath = `${croppedImageDetails?.path}`;

            // Upload to Google Cloud
            // TODO: Abstract and add nudity filter sightengine.com
            return RNFB.fetch(
                'PUT',
                signedUrl,
                {
                    'Content-Type': croppedImageDetails.mime,
                    'Content-Length': croppedImageDetails.size.toString(),
                    'Content-Disposition': 'inline',
                },
                RNFB.wrap(localFileCroppedPath),
            ).then(() => response?.data);
        });
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
                    theme={theme}
                    themeForms={themeForms}
                    userImageUri={userImageUri}
                />
                <View style={themeSettingsForm.styles.submitButtonContainer}>
                    <Button
                        buttonStyle={themeForms.styles.button}
                        title={translate(
                            'forms.createProfile.buttons.submit'
                        )}
                        onPress={onContinue}
                        raised={true}
                        disabled={isDisabled}
                    />
                </View>
            </View>
        );
    }
}

export default CreateProfilePicture;
