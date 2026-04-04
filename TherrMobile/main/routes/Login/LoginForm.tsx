import * as React from 'react';
import { Platform, View } from 'react-native';
import { Button } from '../../components/BaseButton';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { appleAuth, AppleButton } from '@invertase/react-native-apple-authentication';
import { showToast } from '../../utilities/toasts';
import translator from '../../services/translator';
import { addMargins } from '../../styles';
import spacingStyles from '../../styles/layouts/spacing';
import Alert from '../../components/Alert';
import RoundInput from '../../components/Input/Round';
import AppleSignInButton from '../../components/LoginButtons/AppleSignInButton';
import GoogleSignInButton from '../../components/LoginButtons/GoogleSignInButton';
import { ITherrThemeColors } from '../../styles/themes';
import OrDivider from '../../components/Input/OrDivider';
import TherrIcon from '../../components/TherrIcon';

export interface ISSOUserDetails {
    isSSO: boolean;
    idToken: string;
    nonce?: string;
    ssoProvider: string;
    ssoPlatform?: string;
    userFirstName?: string;
    userLastName?: string;
    userPhoneNumber?: string;
    userEmail: string;
}

// Regular component props
interface ILoginFormProps {
    alert?: string;
    login: Function;
    navigation: any;
    userMessage?: string;
    userSettings: any;
    themeAlerts: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeAuthForm: {
        styles: any;
    };
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
    title?: string;
}

interface ILoginFormState {
    inputs: any;
    isSubmitting: boolean;
    prevLoginError: string;
}

/**
 * LoginForm
 */
export class LoginFormComponent extends React.Component<
    ILoginFormProps,
    ILoginFormState
> {
    private translate: Function;

    constructor(props: ILoginFormProps) {
        super(props);

        this.state = {
            inputs: {},
            isSubmitting: false,
            prevLoginError: '',
        };

        this.translate = (key: string, params: any) =>
            translator(props.userSettings?.locale || 'en-us', key, params);
    }

    isLoginFormDisabled = () => {
        const { inputs, isSubmitting } = this.state;
        return !inputs.userName || !inputs.password || isSubmitting;
    };

    isLoginButtonLoading() {
        return this.state.isSubmitting;
    }

    onSSOLoginError = (err) => {
        this.setState({
            isSubmitting: false,
        });

        if (err?.message?.includes('The user canceled the sign in request')) {
            // Google SSO User Canceled
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
        // TODO: Handle bad Google SSO key
    };

    onSSOLoginSuccess = (idToken, user, additionalUserInfo, provider = 'google') => {
        if (user.emailVerified) {
            const firstName = additionalUserInfo?.given_name || (user.displayName?.split[0]);
            const lastName = additionalUserInfo?.family_name || (user.displayName?.split[1]);
            const nonce = additionalUserInfo?.profile?.nonce;
            this.onSubmit({
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

    onSubmit = (ssoUserDetails?: ISSOUserDetails) => {
        const { password, rememberMe, userName } = this.state.inputs;

        if (!ssoUserDetails) {
            if (!userName) {
                showToast.error({
                    text1: this.translate('alertTitles.loginError'),
                    text2: this.translate('forms.loginForm.missingEmail'),
                });
                return;
            }
            if (!password) {
                showToast.error({
                    text1: this.translate('alertTitles.loginError'),
                    text2: this.translate('forms.loginForm.missingPassword'),
                });
                return;
            }
        }

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
                    const msg = this.translate(
                        'forms.loginForm.invalidUsernamePassword'
                    );
                    this.setState({ prevLoginError: msg });
                    showToast.error({
                        text1: this.translate('alertTitles.loginError'),
                        text2: msg,
                    });
                } else if (error.statusCode >= 500) {
                    const msg = this.translate(
                        'forms.loginForm.backendErrorMessage'
                    );
                    this.setState({ prevLoginError: msg });
                    showToast.error({
                        text1: this.translate('alertTitles.backendErrorMessage'),
                        text2: msg,
                    });
                }
                this.setState({
                    isSubmitting: false,
                });
            });
    };

    onInputChange = (name: string, value: string) => {
        const newInputChanges = {
            [name]: value,
        };

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            prevLoginError: '',
        });
    };

    public render() {
        const { isSubmitting } = this.state;
        const {
            navigation,
            themeAlerts,
            themeAuthForm,
            themeForms,
            userMessage,
        } = this.props;

        return (
            <>
                <Alert
                    containerStyles={addMargins({
                        marginBottom: 24,
                    })}
                    isVisible={!!userMessage}
                    message={userMessage}
                    type={'success'}
                    themeAlerts={themeAlerts}
                />
                <RoundInput
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    placeholder={this.translate(
                        'forms.loginForm.labels.userName'
                    )}
                    value={this.state.inputs.userName}
                    onChangeText={(text) =>
                        this.onInputChange('userName', text)
                    }
                    rightIcon={
                        <MaterialIcon
                            name="person"
                            size={24}
                            color={themeAlerts.colors.placeholderTextColorAlt}
                        />
                    }
                    themeForms={themeForms}
                    containerStyle={{ marginBottom: 14 }}
                    testID="login-username"
                    inputStyle={{ fontSize: 17 }}
                />
                <RoundInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    placeholder={this.translate(
                        'forms.loginForm.labels.password'
                    )}
                    value={this.state.inputs.password}
                    onChangeText={(text) =>
                        this.onInputChange('password', text)
                    }
                    onSubmitEditing={() => this.onSubmit()}
                    secureTextEntry={true}
                    rightIcon={
                        <TherrIcon
                            name="key"
                            size={24}
                            color={themeAlerts.colors.placeholderTextColorAlt}
                        />
                    }
                    themeForms={themeForms}
                    testID="login-password"
                    inputStyle={{ fontSize: 17 }}
                />
                <View style={themeAuthForm.styles.submitButtonContainer}>
                    <Button
                        buttonStyle={[themeForms.styles.buttonPrimary, { paddingHorizontal: 20 }]}
                        titleStyle={themeForms.styles.buttonTitle}
                        disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                        disabledStyle={themeForms.styles.buttonDisabled}
                        title={this.translate(
                            'forms.loginForm.buttons.login'
                        )}
                        onPress={() => this.onSubmit()}
                        disabled={this.isLoginButtonLoading()}
                        loading={isSubmitting}
                        icon={
                            <FontAwesomeIcon
                                name="sign-in-alt"
                                size={18}
                                style={themeForms.styles.buttonIcon}
                            />
                        }
                        iconRight
                    />
                </View>
                <OrDivider
                    translate={this.translate}
                    themeForms={themeForms}
                    containerStyle={{ marginBottom: 20 }}
                />
                <View style={themeAuthForm.styles.submitButtonContainer}>
                    <GoogleSignInButton
                        disabled={isSubmitting}
                        buttonTitle={this.translate('forms.loginForm.sso.googleButtonTitleSignIn')}
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
                            type={AppleButton.Type.SIGN_IN}
                        />
                    </View>
                }
                <View style={[themeForms.styles.moreLinksContainer, spacingStyles.marginBotMd]}>
                    <Button
                        type="clear"
                        titleStyle={themeForms.styles.buttonLink}
                        title={this.translate(
                            'forms.loginForm.buttons.signUp'
                        )}
                        onPress={() => navigation.navigate('Register')}
                    />
                </View>
                <View style={[themeForms.styles.moreLinksContainer, spacingStyles.marginBotMd, spacingStyles.marginTopMd]}>
                    <Button
                        type="clear"
                        titleStyle={themeForms.styles.buttonLink}
                        title={this.translate(
                            'forms.loginForm.buttons.forgotPassword'
                        )}
                        onPress={() => navigation.navigate('ForgotPassword')}
                    />
                </View>
            </>
        );
    }
}

export default LoginFormComponent;
