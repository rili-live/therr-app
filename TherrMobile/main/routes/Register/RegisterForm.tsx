import * as React from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { Button } from '../../components/BaseButton';
import { appleAuth, AppleButton } from '@invertase/react-native-apple-authentication';
import { PasswordRegex } from 'therr-js-utilities/constants';
import { showToast } from '../../utilities/toasts';
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
import AppleSignInButton from '../../components/LoginButtons/AppleSignInButton';
import spacingStyles from '../../styles/layouts/spacing';

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
            translator(props.userSettings?.locale || 'en-us', key, params);
    }

    isFormValid = () => {
        return this.state.inputs.password === this.state.inputs.repeatPassword;
    };

    isRegisterFormDisabled = () => {
        const { inputs, isSubmitting } = this.state;
        return !inputs.email || !inputs.password || !inputs.repeatPassword || !this.isFormValid() || isSubmitting;
    };

    onSubmit = () => {
        const { inputs, isSubmitting } = this.state;

        if (isSubmitting) {
            return;
        }

        if (!inputs.email) {
            showToast.error({
                text1: this.translate('alertTitles.registrationError'),
                text2: this.translate('forms.registerForm.missingEmail'),
            });
            return;
        }
        if (!inputs.password) {
            showToast.error({
                text1: this.translate('alertTitles.registrationError'),
                text2: this.translate('forms.registerForm.missingPassword'),
            });
            return;
        }
        if (!inputs.repeatPassword) {
            showToast.error({
                text1: this.translate('alertTitles.registrationError'),
                text2: this.translate('forms.registerForm.missingRepeatPassword'),
            });
            return;
        }
        if (!this.isFormValid()) {
            showToast.error({
                text1: this.translate('alertTitles.registrationError'),
                text2: this.translate('forms.registerForm.errorMessages.repeatPassword'),
            });
            return;
        }
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

    onSSOLoginError = (err) => {
        this.setState({
            isSubmitting: false,
        });

        if (err?.message?.includes('The user canceled the sign in request')) {
            return;
        } else if (err?.message?.includes('com.apple.AuthenticationServices.AuthorizationError')) {
            showToast.error({
                text1: this.translate('alertTitles.errorWithAppleSSO'),
                text2: this.translate('alertMessages.errorWithAppleSSO'),
            });
        } else if (err?.message?.includes('RNGoogleSignInError')) {
            showToast.error({
                text1: this.translate('alertTitles.errorWithGoogleSSO'),
                text2: this.translate('alertMessages.errorWithGoogleSSO'),
            });
        } else {
            showToast.error({
                text1: this.translate('alertTitles.backendErrorMessage'),
                text2: this.translate('alertMessages.backendErrorMessage'),
            });
        }
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
                    containerStyle={{ marginBottom: 14 }}
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
                    containerStyle={{ marginBottom: 14 }}
                />
                <Text style={[theme.styles.sectionDescription, { fontSize: 12, textAlign: 'center', marginBottom: 10 }]}>
                    {this.translate('forms.registerForm.subtitles.inviteCodeHint')}
                </Text>
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
                    containerStyle={{ marginBottom: 14 }}
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
                        disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                        disabledStyle={themeForms.styles.buttonDisabled}
                        title={this.translate(
                            'forms.registerForm.buttons.register'
                        )}
                        onPress={this.onSubmit}
                        disabled={this.state.isSubmitting}
                        loading={this.state.isSubmitting}
                    />
                    <OrDivider
                        translate={this.translate}
                        themeForms={themeForms}
                        containerStyle={spacingStyles.marginVertXLg}
                    />
                    <View style={themeAuthForm.styles.submitButtonContainer}>
                        <GoogleSignInButton
                            disabled={this.state.isSubmitting}
                            buttonTitle={this.translate('forms.loginForm.sso.googleButtonTitleContinue')}
                            onLoginError={this.onSSOLoginError}
                            onLoginSuccess={this.onSSOLoginSuccess}
                            themeForms={themeForms}
                        />
                    </View>
                    {
                        Platform.OS === 'ios' && appleAuth.isSupported &&
                        <View style={themeAuthForm.styles.submitButtonContainer}>
                            <AppleSignInButton
                                disabled={this.state.isSubmitting}
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
