import React from 'react';
import { GestureResponderEvent, View } from 'react-native';
import { Button }  from 'react-native-elements';
import Alert from '../Alert';
import formStyles, { settingsForm as settingsFormStyles } from '../../styles/forms';
import PhoneNumberInput from '../Input/PhoneNumberInput';

interface ICreateProfileStageBProps {
    errorMsg: string;
    isFormDisabled: boolean | undefined;
    onInputChange: Function;
    onSubmit: ((event: GestureResponderEvent) => void) | undefined;
    translate: Function;
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
        } = this.props;

        return (
            <View style={settingsFormStyles.userContainer}>
                <Alert
                    containerStyles={settingsFormStyles.alert}
                    isVisible={errorMsg}
                    message={errorMsg}
                    type="error"
                />
                <PhoneNumberInput
                    onChangeText={this.onPhoneInputChange}
                    onSubmit={onSubmit}
                    placeholder={translate('forms.settings.labels.phoneNumber')}
                    translate={translate}
                />
                <View style={settingsFormStyles.submitButtonContainer}>
                    <Button
                        buttonStyle={formStyles.button}
                        title={translate(
                            'forms.createProfile.buttons.verifyNow'
                        )}
                        onPress={onSubmit}
                        disabled={isFormDisabled}
                        raised={true}
                    />
                </View>
                <View style={settingsFormStyles.submitButtonContainer}>
                    <Button
                        buttonStyle={formStyles.buttonWarning}
                        titleStyle={formStyles.buttonWarningTitle}
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
