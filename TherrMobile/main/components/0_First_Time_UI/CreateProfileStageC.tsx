import React from 'react';
import { Dimensions, GestureResponderEvent, View } from 'react-native';
import { Button }  from 'react-native-elements';
import * as ImagePicker from 'react-native-image-picker';
import Alert from '../Alert';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../../styles/themes';
import UserImage from '../UserContent/UserImage';

const { width: viewportWidth } = Dimensions.get('window');

interface ICreateProfileStageCProps {
    errorMsg: string;
    isDisabled: boolean;
    onImageSelect: Function;
    onInputChange: Function;
    onSubmit: ((event: GestureResponderEvent) => void) | undefined;
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

interface ICreateProfileStageCState {
}

class CreateProfileStageC extends React.Component<ICreateProfileStageCProps, ICreateProfileStageCState> {
    constructor(props) {
        super(props);

        this.state = {};
    }

    handleImagePress = () => {
        const { onImageSelect } = this.props;

        ImagePicker.launchImageLibrary(
            {
                mediaType: 'photo',
                includeBase64: false,
                maxHeight: 4 * viewportWidth,
                maxWidth: 4 * viewportWidth,
                // selectionLimit: 1,
            },
            (cameraResponse) => onImageSelect(cameraResponse),
        );
    }

    render() {
        const {
            errorMsg,
            isDisabled,
            onSubmit,
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
                    onPress={this.handleImagePress}
                    theme={theme}
                    userImageUri={userImageUri}
                />
                <View style={themeSettingsForm.styles.submitButtonContainer}>
                    <Button
                        buttonStyle={themeForms.styles.button}
                        title={translate(
                            'forms.createProfile.buttons.submit'
                        )}
                        onPress={onSubmit}
                        raised={true}
                        disabled={isDisabled}
                    />
                </View>
            </View>
        );
    }
}

export default CreateProfileStageC;
