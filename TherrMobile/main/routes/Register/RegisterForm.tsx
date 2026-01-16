import * as React from 'react';
import { Linking, Platform, View } from 'react-native';
import { Button, Text } from 'react-native-elements';
import { PasswordRegex } from 'therr-js-utilities/constants';
import translator from '../../services/translator';
import { addMargins } from '../../styles';
import Alert from '../../components/Alert';
import RoundInput from '../../components/Input/Round';
import PasswordRequirements from '../../components/Input/PasswordRequirements';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../../styles/themes';
import { ISSOUserDetails } from '../Login/LoginForm';
import TherrIcon from '../../components/TherrIcon';
import OrDivider from '../../components/Input/OrDivider';
import GoogleSignInButton from '../../components/LoginButtons/GoogleSignInButton';

// Regular component props
interface IRegisterFormProps {
    alert?: string;
    onSuccess: Function;
    register: Function;
    login: Function;
    title?: string;
    toggleEULA: Function;
    userSettings: any;
    theme: {
        styles: any;
    };
    themeAlerts: {
        colors: ITherrThemeColors;
        colorVariations: ITherrThemeColorVariations;
        styles: any;
    };
    themeAuthForm: {
        styles: any;
    };
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

interface IRegisterFormState {
    inputs: any;
    passwordErrorMessage: string;
    prevRegisterError: string;
    isSubmitting: boolean;
    isPasswordEntryDirty: boolean;
}

/**
 * RegisterForm
 */
export class RegisterFormComponent extends React.Component<
    IRegisterFormProps,
    IRegisterFormState
> {
    private translate: Function;

    constructor(props: IRegisterFormProps) {
        super(props);

        this.state = {
            inputs: {},
            passwordErrorMessage: '',
            prevRegisterError: '',
            isSubmitting: false,
            isPasswordEntryDirty: false,
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    isRegisterFormDisabled = () => {
        const { isSubmitting } = this.state;
        return isSubmitting || !this.state.inputs.email ||
            !this.state.inputs.password ||
            !this.isFormValid();
    };

    isFormValid = () => {
        return this.state.inputs.password === this.state.inputs.repeatPassword;
    };

    onSubmit = () => {
        const { inputs } = this.state;

        if (!this.isRegisterFormDisabled()) {
            if (!PasswordRegex.test(inputs.password)) {
                this.setState({
                    prevRegisterError: this.translate(
                        'forms.registerForm.errorMessages.passwordInsecure'
                    ),
                });
                return;
            }

            const creds = {
                ...inputs,
            };
            delete creds.repeatPassword;

            this.setState({
                isSubmitting: true,
            });

            this.props
                .register(creds)
                .then(() => {
                    this.props.onSuccess();
                })
                .catch((error: any) => {
                    if (
                        error.statusCode === 400
                    ) {
                        this.setState({
                            prevRegisterError: `${error.message}${
                                error.parameters
                                    ? ' error (' + error.parameters.toString() + ')'
                                    : ''
                            }`,
                        });
                    } else {
                        this.setState({
                            prevRegisterError: this.translate(
                                'forms.registerForm.backendErrorMessage'
                            ),
                        });
                    }
                    this.setState({
                        isSubmitting: false,
                    });
                });
        }
    };

    onInputChange = (name: string, value: string) => {
        const { inputs } = this.state;
        let passwordErrorMessage = '';

        const newInputChanges = {
            [name]: value,
        };

        if (name === 'repeatPassword') {
            if (inputs.password !== newInputChanges.repeatPassword) {
                passwordErrorMessage = this.translate('forms.registerForm.errorMessages.repeatPassword');
            }
        }

        if (name === 'password') {
            this.setState({
                isPasswordEntryDirty: true,
            });
        }

        if (name === 'password' && inputs.repeatPassword) {
            if (inputs.repeatPassword !== newInputChanges.password) {
                passwordErrorMessage = this.translate('forms.registerForm.errorMessages.repeatPassword');
            }
        }

        this.setState({
            inputs: {
                ...inputs,
                ...newInputChanges,
            },
            prevRegisterError: '',
            passwordErrorMessage,
        });
    };

    onSubmitLogin = (ssoUserDetails?: ISSOUserDetails) => {
        const { password, rememberMe, userName } = this.state.inputs;

        let loginArgs: any = {
            userName: userName?.toLowerCase().trim(),
            password,
            rememberMe,
        };

        if (ssoUserDetails) {
            loginArgs = {
                rememberMe,
                ...ssoUserDetails,
            };
        }

        this.setState({
            isSubmitting: true,
        });
        this.props
            .login(loginArgs, {
                googleSSOIdToken: ssoUserDetails?.idToken,
            })
            .catch((error: any) => {
                if (
                    error.statusCode === 400 ||
                    error.statusCode === 401 ||
                    error.statusCode === 404
                ) {
                    this.setState({
                        prevRegisterError: this.translate(
                            'forms.loginForm.invalidUsernamePassword'
                        ),
                    });
                } else if (error.statusCode >= 500) {
                    this.setState({
                        prevRegisterError: this.translate(
                            'forms.loginForm.backendErrorMessage'
                        ),
                    });
                }
                this.setState({
                    isSubmitting: false,
                });
            });
    };

    onSSOLoginError = () => {
        this.setState({
            isSubmitting: false,
        });
    };

    onSSOLoginSuccess = (idToken, user, additionalUserInfo, provider = 'google') => {
        if (user.emailVerified) {
            const firstName = additionalUserInfo?.given_name || (user.displayName?.split[0]);
            const lastName = additionalUserInfo?.family_name || (user.displayName?.split[1]);
            const nonce = additionalUserInfo?.profile?.nonce;
            this.onSubmitLogin({
                isSSO: true,
                idToken,
                nonce,
                ssoProvider: provider,
                ssoPlatform: Platform.OS,
                userPhoneNumber: user.phoneNumber,
                userFirstName: firstName,
                userLastName: lastName,
                userEmail: user.email,
            });
        } else {
            // TODO: RMOBILE-26: Add UI alert message
            console.log('SSO email is not verified!');
        }
    };

    openPrivacyPolicy = () => {
        Linking.openURL('https://www.therr.app/privacy-policy.html');
    };

    public render() {
        const {
            isPasswordEntryDirty,
            passwordErrorMessage,
            prevRegisterError,
        } = this.state;
        const { theme, themeAlerts, themeForms, themeAuthForm, toggleEULA } = this.props;
        const marginBottom25 = { marginBottom: 25 };

        return (
            <>
                <RoundInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={this.translate(
                        'forms.registerForm.labels.email'
                    )}
                    value={this.state.inputs.email}
                    onChangeText={(text) =>
                        this.onInputChange('email', text)
                    }
                    rightIcon={
                        <TherrIcon
                            name="mail"
                            size={24}
                            color={themeAlerts.colors.placeholderTextColorAlt}
                        />
                    }
                    themeForms={themeForms}
                />
                <RoundInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={this.translate(
                        'forms.registerForm.labels.inviteCode'

                    )}
                    value={this.state.inputs.inviteCode}
                    onChangeText={(text) =>
                        this.onInputChange('inviteCode', text)
                    }
                    rightIcon={
                        <TherrIcon
                            name="gift"
                            size={26}
                            color={themeAlerts.colors.placeholderTextColorAlt}
                        />
                    }
                    themeForms={themeForms}
                />
                {
                    isPasswordEntryDirty &&
                        <PasswordRequirements translate={this.translate} password={this.state.inputs.password} themeForms={themeForms} />
                }
                {/* TODO: RMOBILE-26: Centralize password requirements */}
                <RoundInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={this.translate(
                        'forms.registerForm.labels.password'
                    )}
                    value={this.state.inputs.password}
                    onChangeText={(text) =>
                        this.onInputChange('password', text)
                    }
                    secureTextEntry={true}
                    rightIcon={
                        <TherrIcon
                            name="key"
                            size={26}
                            color={themeAlerts.colors.placeholderTextColorAlt}
                        />
                    }
                    themeForms={themeForms}
                />
                <RoundInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={this.translate(
                        'forms.registerForm.labels.repeatPassword'

                    )}
                    value={this.state.inputs.repeatPassword}
                    onChangeText={(text) =>
                        this.onInputChange('repeatPassword', text)
                    }
                    errorMessage={passwordErrorMessage}
                    secureTextEntry={true}
                    onSubmitEditing={this.onSubmit}
                    rightIcon={
                        <TherrIcon
                            name="secure"
                            size={26}
                            color={themeAlerts.colors.placeholderTextColorAlt}
                        />
                    }
                    themeForms={themeForms}
                />
                <Alert
                    containerStyles={addMargins({
                        marginBottom: 24,
                    })}
                    isVisible={!!prevRegisterError}
                    message={prevRegisterError}
                    type={'error'}
                    themeAlerts={themeAlerts}
                />
                <Text style={[theme.styles.sectionDescription, marginBottom25]}>
                    {this.translate('forms.registerForm.subtitles.disclaimer')}
                    <Text
                        style={themeForms.styles.buttonLink}
                        onPress={() => toggleEULA()}>{this.translate('forms.registerForm.buttons.eula')}</Text>
                    {this.translate('forms.registerForm.subtitles.and')}
                    <Text
                        style={themeForms.styles.buttonLink}
                        onPress={() => this.openPrivacyPolicy()}>{this.translate('forms.registerForm.buttons.privacyPolicy')}</Text>
                </Text>
                <View style={themeAuthForm.styles.registerButtonContainer}>
                    <Button
                        buttonStyle={themeForms.styles.buttonPrimary}
                        titleStyle={themeForms.styles.buttonTitle}
                        // disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                        title={this.translate(
                            'forms.registerForm.buttons.register'
                        )}
                        onPress={this.onSubmit}
                        disabled={this.isRegisterFormDisabled()}
                    />
                    <OrDivider
                        translate={this.translate}
                        themeForms={themeForms}
                        containerStyle={spacingStyles.marginVertXLg}
                    />
                    <View style={themeAuthForm.styles.submitButtonContainer}>
                        <GoogleSignInButton
                            disabled={isSubmitting}
                            buttonTitle={this.translate('forms.loginForm.sso.googleButtonTitleContinue')}
                            onLoginError={this.onSSOLoginError}
                            onLoginSuccess={this.onSSOLoginSuccess}
                            themeForms={themeForms}
                        />
                    </View>
                    {
                        Platform.OS === 'ios' && appleAuth.isSupported &&
                        appleAuth.isSupported &&
                        <View style={themeAuthForm.styles.submitButtonContainer}>
                            <AppleSignInButton
                                disabled={isSubmitting}
                                buttonTitle={this.translate('forms.loginForm.sso.appleButtonTitle')}
                                onLoginError={this.onSSOLoginError}
                                onLoginSuccess={this.onSSOLoginSuccess}
                                themeForms={themeForms}
                                type={AppleButton.Type.CONTINUE}
                            />
                        </View>
                    }
                </View>
            </>
        );
    }
}

export default RegisterFormComponent;
