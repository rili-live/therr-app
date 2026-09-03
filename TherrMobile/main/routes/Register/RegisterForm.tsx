import * as React from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import DatePicker from 'react-native-date-picker';
import { Button } from '../../components/BaseButton';
import { appleAuth, AppleButton } from '@invertase/react-native-apple-authentication';
import { PasswordRegex } from 'therr-js-utilities/constants';
import isValidSignupAge, { MINIMUM_SIGNUP_AGE } from 'therr-js-utilities/is-valid-signup-age';
import { showToast } from '../../utilities/toasts';
import { getInstallAcquisition } from '../../utilities/installReferrer';
import translator from '../../utilities/translator';
import { addMargins } from '../../styles';
import Alert from '../../components/Alert';
import RoundInput from '../../components/Input/Round';
import PasswordInput from '../../components/Input/PasswordInput';
import PasswordRequirements from '../../components/Input/PasswordRequirements';
import { ITherrThemeColors, ITherrThemeColorVariations, isDarkTheme } from '../../styles/themes';
import { ISSOUserDetails } from '../Login/LoginForm';
import TherrIcon from '../../components/TherrIcon';
import OrDivider from '../../components/Input/OrDivider';
import GoogleSignInButton from '../../components/LoginButtons/GoogleSignInButton';
import AppleSignInButton from '../../components/LoginButtons/AppleSignInButton';
import spacingStyles from '../../styles/layouts/spacing';
import { getLoginErrorCopy, getRegistrationErrorCopy } from '../../utilities/authErrors';

// Regular component props
interface IRegisterFormProps {
    alert?: string;
    onSuccess: Function;
    /** Omitted when the phone path isn't offered (e.g. arriving via a magic invite link). */
    onSwitchToPhoneSignup?: () => void;
    register: Function;
    login: Function;
    title?: string;
    toggleEULA: Function;
    userSettings: any;
    // Magic invite-link context (set when arriving via /invite/link/:token).
    inviteToken?: string;
    prefillEmail?: string;
    inviterName?: string;
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
    isBirthdatePickerOpen: boolean;
}

/**
 * RegisterForm
 */
export class RegisterFormComponent extends React.Component<
    IRegisterFormProps,
    IRegisterFormState
> {
    private translate: (key: string, params?: any) => string;

    constructor(props: IRegisterFormProps) {
        super(props);

        this.state = {
            inputs: {
                email: props.prefillEmail || '',
            },
            passwordErrorMessage: '',
            prevRegisterError: '',
            isSubmitting: false,
            isPasswordEntryDirty: false,
            isBirthdatePickerOpen: false,
        };

        // Read from `this.props` so labels re-translate when the pre-login locale changes.
        this.translate = (key: string, params: any) =>
            translator(this.props.userSettings?.locale || 'en-us', key, params);
    }

    componentDidUpdate(prevProps: IRegisterFormProps) {
        // The invite email resolves asynchronously in the parent; seed the field
        // once it arrives, without clobbering anything the user has typed.
        if (prevProps.prefillEmail !== this.props.prefillEmail
            && this.props.prefillEmail
            && !this.state.inputs.email) {
            this.onInputChange('email', this.props.prefillEmail);
        }
    }

    isFormValid = () => {
        return this.state.inputs.password === this.state.inputs.repeatPassword;
    };

    isRegisterFormDisabled = () => {
        const { inputs, isSubmitting } = this.state;
        return !inputs.email
            || !inputs.password
            || !inputs.repeatPassword
            || !inputs.settingsBirthdate
            || !isValidSignupAge(inputs.settingsBirthdate)
            || !this.isFormValid()
            || isSubmitting;
    };

    /**
     * Both halves of an error, every time: an inline alert that stays put, plus a toast for
     * the cases where the alert is scrolled off screen. The form used to show only one or the
     * other depending on which check failed.
     */
    showRegisterError = (message: string, title = this.translate('alertTitles.registrationError')) => {
        this.setState({ prevRegisterError: message });
        showToast.error({
            text1: title,
            text2: message,
        });
    };

    getMaxBirthdate = () => new Date();

    getDefaultBirthdate = () => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - MINIMUM_SIGNUP_AGE);
        return d;
    };

    onBirthdateConfirm = (date: Date) => {
        this.setState({ isBirthdatePickerOpen: false });

        if (!isValidSignupAge(date)) {
            this.showRegisterError(
                this.translate('forms.registerForm.errorMessages.birthdateTooYoung', { minAge: `${MINIMUM_SIGNUP_AGE}` }),
            );
            return;
        }

        this.onInputChange('settingsBirthdate', date.toISOString());
    };

    onBirthdateCancel = () => {
        this.setState({ isBirthdatePickerOpen: false });
    };

    onSubmit = () => {
        const { inputs, isSubmitting } = this.state;

        if (isSubmitting) {
            return;
        }

        if (!inputs.email) {
            this.showRegisterError(this.translate('forms.registerForm.missingEmail'));
            return;
        }
        if (!inputs.password) {
            this.showRegisterError(this.translate('forms.registerForm.missingPassword'));
            return;
        }
        if (!inputs.repeatPassword) {
            this.showRegisterError(this.translate('forms.registerForm.missingRepeatPassword'));
            return;
        }
        if (!this.isFormValid()) {
            this.showRegisterError(this.translate('forms.registerForm.errorMessages.repeatPassword'));
            return;
        }
        if (!PasswordRegex.test(inputs.password)) {
            this.showRegisterError(this.translate('forms.registerForm.errorMessages.passwordInsecure'));
            return;
        }
        if (!inputs.settingsBirthdate || !isValidSignupAge(inputs.settingsBirthdate)) {
            this.showRegisterError(
                this.translate('forms.registerForm.errorMessages.birthdateTooYoung', { minAge: `${MINIMUM_SIGNUP_AGE}` }),
            );
            return;
        }

        const creds: any = {
            ...inputs,
            // Persist the language chosen on the pre-login switcher to the new account so the
            // user's verification email and first session match their selected locale.
            settingsLocale: this.props.userSettings?.locale || 'en-us',
        };
        delete creds.repeatPassword;
        if (this.props.inviteToken) {
            creds.inviteToken = this.props.inviteToken;
        }

        this.setState({
            isSubmitting: true,
            prevRegisterError: '',
        });

        // Where this install came from, if Play told us. Advisory telemetry: it
        // resolves null on every failure path, the server sanitizes it and drops
        // anything malformed, and it must never delay or block the signup —
        // hence the catch. After the first launch the read is a cached
        // AsyncStorage hit, not a service binding.
        getInstallAcquisition().catch(() => null).then((userAcquisition) => this.props
            .register({ ...creds, userAcquisition: userAcquisition || undefined })
            .then(() => {
                this.props.onSuccess();
            })
            .catch((error: any) => {
                const { title, message } = getRegistrationErrorCopy(error, this.translate);

                this.setState({ isSubmitting: false });
                this.showRegisterError(message, title);
            }));
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
            prevRegisterError: '',
        });
        this.props
            .login(loginArgs, {
                googleSSOIdToken: ssoUserDetails?.idToken,
            })
            // Same mapping the sign-in screen uses. This used to be a hand-rolled copy that had
            // already drifted from it: no toast, and no branch at all for a rejection that was
            // neither 4xx nor 5xx, which left SSO failures here completely silent.
            .catch((error: any) => {
                const { title, message } = getLoginErrorCopy(error, this.translate);

                this.setState({ isSubmitting: false });
                this.showRegisterError(message, title);
            });
    };

    onSSOLoginError = (err) => {
        this.setState({
            isSubmitting: false,
        });

        if (err?.message?.includes('The user canceled the sign in request')) {
            // The user's own choice, not an error to report back.
            return;
        } else if (err?.message?.includes('com.apple.AuthenticationServices.AuthorizationError')) {
            this.showRegisterError(
                this.translate('alertMessages.errorWithAppleSSO'),
                this.translate('alertTitles.errorWithAppleSSO'),
            );
        } else if (err?.message?.includes('RNGoogleSignInError')) {
            this.showRegisterError(
                this.translate('alertMessages.errorWithGoogleSSO'),
                this.translate('alertTitles.errorWithGoogleSSO'),
            );
        } else {
            this.showRegisterError(
                this.translate('alertMessages.backendErrorMessage'),
                this.translate('alertTitles.backendErrorMessage'),
            );
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
                {
                    this.props.inviterName
                        ? (
                            <Text style={[theme.styles.sectionDescription, { textAlign: 'center', marginBottom: 16 }]}>
                                {this.translate('forms.registerForm.subtitles.invitedBy', { inviterName: this.props.inviterName })}
                            </Text>
                        )
                        : null
                }
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
                <PasswordInput
                    variant="round"
                    placeholder={this.translate(
                        'forms.registerForm.labels.password'
                    )}
                    value={this.state.inputs.password}
                    onChangeText={(text) =>
                        this.onInputChange('password', text)
                    }
                    translate={this.translate}
                    iconColor={themeAlerts.colors.placeholderTextColorAlt}
                    themeForms={themeForms}
                    containerStyle={{ marginBottom: 14 }}
                    testID="register-password"
                />
                <PasswordInput
                    variant="round"
                    placeholder={this.translate(
                        'forms.registerForm.labels.repeatPassword'

                    )}
                    value={this.state.inputs.repeatPassword}
                    onChangeText={(text) =>
                        this.onInputChange('repeatPassword', text)
                    }
                    errorMessage={passwordErrorMessage}
                    onSubmitEditing={this.onSubmit}
                    translate={this.translate}
                    iconColor={themeAlerts.colors.placeholderTextColorAlt}
                    themeForms={themeForms}
                    containerStyle={{ marginBottom: 14 }}
                    testID="register-repeat-password"
                />
                <Pressable onPress={() => this.setState({ isBirthdatePickerOpen: true })}>
                    <View pointerEvents="none">
                        <RoundInput
                            editable={false}
                            placeholder={this.translate(
                                'forms.registerForm.labels.birthdate'
                            )}
                            value={
                                this.state.inputs.settingsBirthdate
                                    ? new Date(this.state.inputs.settingsBirthdate)
                                        .toLocaleDateString(this.props.userSettings?.locale || 'en-us')
                                    : ''
                            }
                            rightIcon={
                                <TherrIcon
                                    name="calendar"
                                    size={24}
                                    color={themeAlerts.colors.placeholderTextColorAlt}
                                />
                            }
                            themeForms={themeForms}
                        />
                    </View>
                </Pressable>
                <Text style={[theme.styles.sectionDescription, { fontSize: 12, textAlign: 'center', marginTop: 6, marginBottom: 16 }]}>
                    {this.translate('forms.registerForm.subtitles.birthdateHint', { minAge: `${MINIMUM_SIGNUP_AGE}` })}
                </Text>
                <DatePicker
                    modal
                    mode="date"
                    open={this.state.isBirthdatePickerOpen}
                    date={
                        this.state.inputs.settingsBirthdate
                            ? new Date(this.state.inputs.settingsBirthdate)
                            : this.getDefaultBirthdate()
                    }
                    maximumDate={this.getMaxBirthdate()}
                    onConfirm={this.onBirthdateConfirm}
                    onCancel={this.onBirthdateCancel}
                    theme={isDarkTheme(this.props.userSettings?.mobileThemeName) ? 'dark' : 'light'}
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
                    {
                        this.props.onSwitchToPhoneSignup
                            ? (
                                <View style={themeForms.styles.moreLinksContainer}>
                                    <Button
                                        type="clear"
                                        titleStyle={themeForms.styles.buttonLink}
                                        title={this.translate('forms.phoneSignupForm.buttons.usePhoneInstead')}
                                        onPress={this.props.onSwitchToPhoneSignup}
                                    />
                                </View>
                            )
                            : null
                    }
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
