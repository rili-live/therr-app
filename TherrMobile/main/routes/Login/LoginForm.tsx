import * as React from 'react';
import { Platform, View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import translator from '../../services/translator';
import { addMargins } from '../../styles';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildAuthFormStyles } from '../../styles/forms/authenticationForms';
import { buildStyles as buildAlertStyles } from '../../styles/alerts';
import Alert from '../../components/Alert';
import RoundInput from '../../components/Input/Round';
import AppleSignInButton from '../../components/LoginButtons/AppleSignInButton';
import GoogleSignInButton from '../../components/LoginButtons/GoogleSignInButton';

interface ISSOUserDetails {
    isSSO: boolean;
    idToken: string;
    nonce?: string;
    ssoProvider: string;
    userFirstName?: string;
    userLastName?: string;
    userEmail: string;
}

// Regular component props
interface ILoginFormProps {
    alert?: string;
    login: Function;
    navigation: any;
    userMessage?: string;
    userSettings: any;
    title?: string;
}

interface ILoginFormState {
    inputs: any;
    prevLoginError: string;
    isSubmitting: boolean;
}

/**
 * LoginForm
 */
export class LoginFormComponent extends React.Component<
    ILoginFormProps,
    ILoginFormState
> {
    private translate: Function;
    private themeAlerts = buildAlertStyles();
    private themeAuthForm = buildAuthFormStyles();
    private themeForms = buildFormStyles();

    constructor(props: ILoginFormProps) {
        super(props);

        this.state = {
            inputs: {},
            prevLoginError: '',
            isSubmitting: false,
        };

        this.themeAlerts = buildAlertStyles(props.userSettings.mobileThemeName);
        this.themeAuthForm = buildAuthFormStyles(props.userSettings.mobileThemeName);
        this.themeForms = buildFormStyles(props.userSettings.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    isLoginFormDisabled() {
        return (
            !this.state.inputs.userName ||
            !this.state.inputs.password ||
            this.state.isSubmitting
        );
    }

    onSSOLoginError = () => {
        this.setState({
            isSubmitting: false,
        });
    }

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
                userFirstName: firstName,
                userLastName: lastName,
                userEmail: user.email,
            });
        } else {
            // TODO: RMOBILE-26: Add UI alert message
            console.log('SSO email is not verified!');
        }
    }

    onSubmit = (ssoUserDetails?: ISSOUserDetails) => {
        const { password, rememberMe, userName } = this.state.inputs;

        let loginArgs: any = {
            userName: userName?.toLowerCase(),
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
                        prevLoginError: this.translate(
                            'forms.loginForm.invalidUsernamePassword'
                        ),
                    });
                } else if (error.statusCode >= 500) {
                    this.setState({
                        prevLoginError: this.translate(
                            'forms.loginForm.backendErrorMessage'
                        ),
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

    public render(): JSX.Element | null {
        const { isSubmitting, prevLoginError } = this.state;
        const { navigation, userMessage } = this.props;

        return (
            <>
                <Alert
                    containerStyles={addMargins({
                        marginBottom: 24,
                    })}
                    isVisible={!!userMessage}
                    message={userMessage}
                    type={'success'}
                    themeAlerts={this.themeAlerts}
                />
                <RoundInput
                    autoCapitalize="none"
                    autoCompleteType="email"
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
                            color={this.themeAlerts.colors.primary3}
                        />
                    }
                    themeForms={this.themeForms}
                />
                <RoundInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoCompleteType="password"
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
                        <MaterialIcon
                            name="vpn-key"
                            size={24}
                            color={this.themeAlerts.colors.primary3}
                        />
                    }
                    themeForms={this.themeForms}
                />
                <View style={this.themeAuthForm.styles.submitButtonContainer}>
                    <Button
                        buttonStyle={this.themeAuthForm.styles.button}
                        disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                        disabledStyle={this.themeForms.styles.buttonDisabled}
                        title={this.translate(
                            'forms.loginForm.buttons.login'
                        )}
                        onPress={() => this.onSubmit()}
                        loading={isSubmitting}
                        raised={true}
                        icon={
                            <FontAwesomeIcon
                                name="sign-in-alt"
                                size={18}
                                style={this.themeForms.styles.buttonIcon}
                            />
                        }
                        iconRight
                    />
                </View>
                {
                    // Temporarily disable SSO for Apple compliance until we have made phoneNumber optional
                    Platform.OS !== 'ios' &&
                    <>
                        <View style={this.themeAuthForm.styles.submitButtonContainer}>
                            <GoogleSignInButton
                                disabled={isSubmitting}
                                buttonTitle={this.translate('forms.loginForm.sso.googleButtonTitle')}
                                onLoginError={this.onSSOLoginError}
                                onLoginSuccess={this.onSSOLoginSuccess}
                            />
                        </View>
                        {
                            // Platform.OS === 'ios' && appleAuth.isSupported &&
                            appleAuth.isSupported &&
                            <View style={this.themeAuthForm.styles.submitButtonContainer}>
                                <AppleSignInButton
                                    disabled={isSubmitting}
                                    buttonTitle={this.translate('forms.loginForm.sso.appleButtonTitle')}
                                    onLoginError={this.onSSOLoginError}
                                    onLoginSuccess={this.onSSOLoginSuccess}
                                />
                            </View>
                        }
                    </>
                }
                <Alert
                    containerStyles={addMargins({
                        marginBottom: 24,
                    })}
                    isVisible={!!prevLoginError}
                    message={prevLoginError}
                    type={'error'}
                    themeAlerts={this.themeAlerts}
                />
                <View style={this.themeAuthForm.styles.moreLinksContainer}>
                    <Button
                        type="clear"
                        titleStyle={this.themeAuthForm.styles.buttonLink}
                        title={this.translate(
                            'forms.loginForm.buttons.signUp'
                        )}
                        onPress={() => navigation.navigate('Register')}
                    />
                    <Button
                        type="clear"
                        titleStyle={this.themeAuthForm.styles.buttonLink}
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
