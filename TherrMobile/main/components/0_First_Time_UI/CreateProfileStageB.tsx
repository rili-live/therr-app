import React from 'react';
import { GestureResponderEvent, View } from 'react-native';
import { Button }  from 'react-native-elements';
import Alert from '../Alert';
import PhoneNumberInput from '../Input/PhoneNumberInput';
import { ITherrThemeColorVariations } from '../../styles/themes';

interface ICreateProfileStageBProps {
    errorMsg: string;
    isFormDisabled: boolean | undefined;
    onInputChange: Function;
    onSubmit: ((event: GestureResponderEvent) => void) | undefined;
    translate: Function;
    themeAlerts: {
        colorVariations: ITherrThemeColorVariations;
        styles: any;
    };
    themeForms: {
        styles: any;
    };
    themeSettingsForm: {
        styles: any;
    };
}

interface ICreateProfileStageBState {}

class CreateProfileStageB extends React.Component<ICreateProfileStageBProps, ICreateProfileStageBState> {
    constructor(props) {
        super(props);

        this.state = {};
    }

    onPhoneInputChange = (value: string, isValid: boolean) => {
        const { onInputChange } = this.props;

        onInputChange('phoneNumber', value, isValid);
    }

    render() {
        const {
            errorMsg,
            isFormDisabled,
            onSubmit,
            translate,
            themeAlerts,
            themeForms,
            themeSettingsForm,
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
                <PhoneNumberInput
                    onChangeText={this.onPhoneInputChange}
                    onSubmit={onSubmit}
                    placeholder={translate('forms.settings.labels.phoneNumber')}
                    translate={translate}
                />
                <View style={themeSettingsForm.styles.submitButtonContainer}>
                    <Button
                        buttonStyle={themeForms.styles.button}
                        title={translate(
                            'forms.createProfile.buttons.verifyNow'
                        )}
                        onPress={onSubmit}
                        disabled={isFormDisabled}
                        raised={true}
                    />
                </View>
                <View style={themeSettingsForm.styles.submitButtonContainer}>
                    <Button
                        buttonStyle={themeForms.styles.buttonWarning}
                        titleStyle={themeForms.styles.buttonWarningTitle}
                        title={translate(
                            'forms.createProfile.buttons.verifyLater'
                        )}
                        onPress={onSubmit}
                        disabled={isFormDisabled}
                        raised={true}
                    />
                </View>
            </View>
        );
    }
}

export default CreateProfileStageB;
