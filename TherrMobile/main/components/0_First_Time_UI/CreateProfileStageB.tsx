import React from 'react';
import { View } from 'react-native';
import { Button }  from 'react-native-elements';
import { ApiService } from 'therr-react/services';
import { ErrorCodes } from 'therr-js-utilities/constants';
import Toast from 'react-native-toast-message';
import analytics from '@react-native-firebase/analytics';
import Alert from '../Alert';
import SquareInput from '../Input/Square';
import PhoneNumberInput from '../Input/PhoneNumberInput';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../../styles/themes';
import TherrIcon from '../../components/TherrIcon';

interface ICreateProfileStageBProps {
    user: any;
    errorMsg: string;
    isFormDisabled: boolean | undefined;
    onInputChange: Function;
    onSubmit: (() => void) | undefined;
    translate: Function;
    theme: {
        colors: ITherrThemeColors;
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
}

interface ICreateProfileStageBState {
    isVerifying: boolean;
    isSubmitting: boolean;
    phoneNumber: string;
    verificationCode: string;
}

class CreateProfileStageB extends React.Component<ICreateProfileStageBProps, ICreateProfileStageBState> {
    constructor(props) {
        super(props);

        this.state = {
            isVerifying: false,
            isSubmitting: false,
            phoneNumber: '',
            verificationCode: '',
        };
    }

    onCodeInputChange = (value: string) => {
        this.setState({
            verificationCode: value,
        });
    };

    onPhoneInputChange = (value: string, isValid: boolean) => {
        const { onInputChange } = this.props;

        this.setState({
            phoneNumber: value,
        });
        onInputChange('phoneNumber', value, isValid);
    };

    onSubmitVerifyPhone = () => {
        const { phoneNumber } = this.state;
        const { translate, user } = this.props;
        this.setState({
            isSubmitting: true,
        });
        ApiService.verifyPhone(phoneNumber)
            .then(() => {
                analytics().logEvent('phone_verify_success', {
                    userId: user?.details?.id,
                    phoneNumber,
                    platform: 'mobile',
                }).catch((err) => console.log(err));
                this.setState({
                    isVerifying: true,
                });
                Toast.show({
                    type: 'success',
                    text1: translate('alertTitles.codeSent'),
                    text2: translate('alertMessages.codeSent'),
                    visibilityTime: 2000,
                });
            })
            .catch((error) => {
                if (error?.errorCode === ErrorCodes.USER_EXISTS) {
                    analytics().logEvent('phone_verify_error_already_exists', {
                        userId: user?.details?.id,
                        phoneNumber,
                    }).catch((err) => console.log(err));
                    Toast.show({
                        type: 'errorBig',
                        text1: translate('alertTitles.phoneNumberAlreadyInUse'),
                        text2: translate('alertMessages.phoneNumberAlreadyInUse'),
                    });
                } else if (error?.errorCode === ErrorCodes.INVALID_REGION) {
                    Toast.show({
                        type: 'errorBig',
                        text1: translate('alertTitles.invalidRegionCode'),
                        text2: translate('alertMessages.invalidRegionCode'),
                    });
                } else {
                    analytics().logEvent('phone_verify_error', {
                        userId: user?.details?.id,
                        phoneNumber,
                    }).catch((err) => console.log(err));
                    Toast.show({
                        type: 'errorBig',
                        text1: translate('alertTitles.backendErrorMessage'),
                        text2: translate('alertMessages.backendErrorMessage'),
                    });
                }
            })
            .finally(() => {
                this.setState({
                    isSubmitting: false,
                });
            });
    };

    onSubmitCode = () => {
        const { onSubmit, translate, user } = this.props;
        const { verificationCode } = this.state;
        this.setState({
            isSubmitting: true,
        });
        ApiService.validateCode(verificationCode)
            .then(() => {
                analytics().logEvent('phone_verify_code_success', {
                    userId: user?.details?.id,
                    platform: 'mobile',
                }).catch((err) => console.log(err));
                onSubmit && onSubmit();
                Toast.show({
                    type: 'success',
                    text1: translate('alertTitles.phoneVerifiedSuccess'),
                    visibilityTime: 2000,
                });
            })
            .catch((error) => {
                if (
                    error.statusCode === 400
                ) {
                    Toast.show({
                        type: 'errorBig',
                        text1: translate('alertTitles.invalidCode'),
                        text2: translate('alertMessages.invalidCode'),
                    });
                } else {
                    Toast.show({
                        type: 'errorBig',
                        text1: translate('alertTitles.backendErrorMessage'),
                        text2: translate('alertMessages.backendErrorMessage'),
                    });
                }
            })
            .finally(() => {
                this.setState({
                    isSubmitting: false,
                });
            });
    };

    render() {
        const {
            errorMsg,
            isFormDisabled,
            onSubmit,
            translate,
            theme,
            themeAlerts,
            themeForms,
            themeSettingsForm,
        } = this.props;
        const { isSubmitting, isVerifying, verificationCode } = this.state;

        // TODO: Replace alert with toast
        return (
            <View style={themeSettingsForm.styles.userContainer}>
                <Alert
                    containerStyles={themeSettingsForm.styles.alert}
                    isVisible={errorMsg}
                    message={errorMsg}
                    type="error"
                    themeAlerts={themeAlerts}
                />
                {
                    !isVerifying &&
                    <>
                        <PhoneNumberInput
                            onChangeText={this.onPhoneInputChange}
                            onSubmit={onSubmit}
                            placeholder={translate('forms.settings.labels.phoneNumber')}
                            translate={translate}
                            theme={theme}
                            themeForms={themeForms}
                        />
                        <View style={themeSettingsForm.styles.submitButtonContainer}>
                            <Button
                                buttonStyle={themeForms.styles.button}
                                title={translate(
                                    'forms.createProfile.buttons.verifyNow'
                                )}
                                onPress={this.onSubmitVerifyPhone}
                                disabled={isFormDisabled || isSubmitting}
                                raised={true}
                            />
                        </View>
                        {/* <View style={themeSettingsForm.styles.submitButtonContainer}>
                            <Button
                                buttonStyle={themeForms.styles.buttonWarning}
                                titleStyle={themeForms.styles.buttonWarningTitle}
                                title={translate(
                                    'forms.createProfile.buttons.verifyLater'
                                )}
                                onPress={onSubmit}
                                disabled={isFormDisabled || isSubmitting}
                                raised={true}
                            />
                        </View> */}
                    </>
                }
                {
                    isVerifying &&
                    <>
                        <View style={themeSettingsForm.styles.submitButtonContainer}>
                            <SquareInput
                                placeholder={translate(
                                    'forms.settings.labels.code'
                                )}
                                value={verificationCode}
                                onChangeText={(text) =>
                                    this.onCodeInputChange(text)
                                }
                                rightIcon={
                                    <TherrIcon
                                        name="secure"
                                        size={26}
                                        color={themeAlerts.colorVariations.primary3Fade}
                                    />
                                }
                                themeForms={themeForms}
                                maxLength={6}
                            />
                            <Button
                                buttonStyle={themeForms.styles.button}
                                title={translate(
                                    'forms.createProfile.buttons.submitCode'
                                )}
                                onPress={this.onSubmitCode}
                                disabled={isFormDisabled || isSubmitting}
                                raised={true}
                            />
                            <Button
                                type="clear"
                                containerStyle={{ marginTop: 10 }}
                                titleStyle={themeForms.styles.buttonLink}
                                title={translate(
                                    'forms.createProfile.buttons.resendCode'
                                )}
                                onPress={this.onSubmitVerifyPhone}
                            />
                        </View>
                    </>
                }
            </View>
        );
    }
}

export default CreateProfileStageB;
