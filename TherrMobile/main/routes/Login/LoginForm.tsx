import * as React from 'react';
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Button } from '../../components/BaseButton';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { appleAuth, AppleButton } from '@invertase/react-native-apple-authentication';
import { ApiService } from 'therr-react/services';
import { ErrorCodes } from 'therr-js-utilities/constants';
import { showToast } from '../../utilities/toasts';
import translator from '../../utilities/translator';
import { addMargins } from '../../styles';
import spacingStyles, { space } from '../../styles/layouts/spacing';
import { fontSizes } from '../../styles/text';
import Alert from '../../components/Alert';
import RoundInput from '../../components/Input/Round';
import VerificationCodeInput from '../../components/Input/VerificationCodeInput';
import AppleSignInButton from '../../components/LoginButtons/AppleSignInButton';
import GoogleSignInButton from '../../components/LoginButtons/GoogleSignInButton';
import AccountPickerModal, { IPickableAccount } from '../../components/Modals/AccountPickerModal';
import { ITherrThemeColors } from '../../styles/themes';
import OrDivider from '../../components/Input/OrDivider';
import TherrIcon from '../../components/TherrIcon';
import { isLikelyPhoneNumber, toDialableNumber } from '../../utilities/authIdentifier';
import {
    forgetProfile,
    getRememberedProfiles,
    rememberCurrentUser,
    IRememberedProfile,
} from '../../utilities/rememberedProfiles';

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

/**
 * Which step of the passwordless flow is on screen. `password` is the default and covers
 * email/username sign-in; the two `code` states are only reachable from a phone number.
 */
type LoginMode = 'password' | 'awaitingCode' | 'selectingAccount';

// Regular component props
interface ILoginFormProps {
    alert?: string;
    login: Function;
    loginWithPhone: Function;
    selectPhoneLoginAccount: Function;
    navigation: any;
    /**
     * Identifier to seed the field with, ahead of any remembered profile. Set by the sign-up
     * screens so a brand-new account — which has no remembered profile yet, having never
     * signed in — doesn't land on an empty form.
     */
    prefillIdentifier?: string;
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
    mode: LoginMode;
    verificationCode: string;
    hasCodeError: boolean;
    /** Phone number the code was actually texted to, echoed back by the server. */
    codeSentToPhoneNumber: string;
    rememberedProfiles: IRememberedProfile[];
    isProfileSwitcherVisible: boolean;
    /** Accounts to choose between when one phone number has several. */
    selectableAccounts: IPickableAccount[];
    phoneVerificationToken: string;
    activeProfileId: string;
}

/**
 * LoginForm
 *
 * One identifier field drives two flows. Typing an email or username keeps the classic
 * password form; typing something that looks like a phone number swaps the password field for
 * "text me a code", because a phone-first user very likely has no password at all (see the
 * passwordless sign-up flow). The switch is reversible — `usePasswordInstead` is always one
 * tap away for people who registered by phone but later set a password.
 */
export class LoginFormComponent extends React.Component<
    ILoginFormProps,
    ILoginFormState
> {
    private translate: Function;

    constructor(props: ILoginFormProps) {
        super(props);

        this.state = {
            inputs: props.prefillIdentifier ? { userName: props.prefillIdentifier } : {},
            isSubmitting: false,
            prevLoginError: '',
            mode: 'password',
            verificationCode: '',
            hasCodeError: false,
            codeSentToPhoneNumber: '',
            rememberedProfiles: [],
            isProfileSwitcherVisible: false,
            selectableAccounts: [],
            phoneVerificationToken: '',
            activeProfileId: '',
        };

        // Read from `this.props` so labels re-translate when the pre-login locale changes.
        this.translate = (key: string, params?: any) =>
            translator(this.props.userSettings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        this.loadRememberedProfiles();
    }

    /**
     * Login sits below Register in the native stack and is never unmounted, so a phone-first
     * sign-up that navigates back here with a number to pre-fill arrives as a prop change —
     * the constructor does not run a second time. Without this the number is silently dropped
     * and the user has to retype the one they just verified.
     */
    componentDidUpdate(prevProps: ILoginFormProps) {
        const { prefillIdentifier } = this.props;

        if (prefillIdentifier && prefillIdentifier !== prevProps.prefillIdentifier) {
            this.setState((prevState) => ({
                // `mode` back to the identifier step: `isPhoneModeActive` derives the SMS
                // affordance from the identifier itself, so a phone number lands one tap
                // from a code without any extra state.
                inputs: { ...prevState.inputs, userName: prefillIdentifier, password: '' },
                activeProfileId: '',
                mode: 'password',
                prevLoginError: '',
            }));
        }
    }

    /**
     * Pre-fills the identifier with the account last used on this device. Only seeds the field
     * when it is still empty so a returning render never clobbers typing in progress.
     */
    loadRememberedProfiles = () => getRememberedProfiles()
        .then((rememberedProfiles) => {
            const mostRecent = rememberedProfiles[0];

            // First run on a device: nothing to pre-fill and nothing to switch between, so
            // skip the re-render entirely rather than storing an empty list over an empty one.
            if (!mostRecent) {
                return;
            }

            this.setState((prevState) => ({
                rememberedProfiles,
                activeProfileId: mostRecent && !prevState.inputs.userName ? mostRecent.id : prevState.activeProfileId,
                inputs: (mostRecent && !prevState.inputs.userName)
                    ? { ...prevState.inputs, userName: mostRecent.identifier }
                    : prevState.inputs,
            }));
        })
        .catch(() => { /* a missing cache just means no pre-fill */ });

    isPhoneModeActive = () => isLikelyPhoneNumber(this.state.inputs.userName);

    /**
     * Whether the primary action is unavailable. Mode-aware: in SMS mode there is no password
     * to check, so an identifier alone is enough to request a code.
     */
    isLoginFormDisabled = () => {
        const { inputs, isSubmitting } = this.state;

        if (isSubmitting) {
            return true;
        }

        if (this.isPhoneModeActive()) {
            return !inputs.userName;
        }

        return !inputs.userName || !inputs.password;
    };

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

    /** Shared error mapping for every sign-in path so the messaging never diverges. */
    onLoginError = (error: any) => {
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
            .then(() => rememberCurrentUser(ssoUserDetails ? ssoUserDetails.userEmail : userName))
            .catch(this.onLoginError);
    };

    // PASSWORDLESS SIGN-IN

    /**
     * Requests an SMS code. The response is deliberately the same whether or not an account
     * exists for the number, so we always advance to the code step — a wrong number simply
     * fails at the next step instead of telling a stranger which numbers are registered.
     */
    onRequestVerificationCode = () => {
        const phoneNumber = toDialableNumber(this.state.inputs.userName);

        if (!isLikelyPhoneNumber(phoneNumber)) {
            showToast.error({
                text1: this.translate('alertTitles.loginError'),
                text2: this.translate('forms.loginForm.invalidPhoneNumber'),
            });
            return;
        }

        this.setState({
            isSubmitting: true,
            prevLoginError: '',
        });

        ApiService.startPhoneLogin(phoneNumber)
            .then(() => {
                this.setState({
                    mode: 'awaitingCode',
                    codeSentToPhoneNumber: phoneNumber,
                    verificationCode: '',
                    hasCodeError: false,
                });
                showToast.success({
                    text1: this.translate('alertTitles.codeSent'),
                    text2: this.translate('alertMessages.codeSent'),
                });
            })
            .catch((error: any) => {
                if (error?.errorCode === ErrorCodes.INVALID_REGION) {
                    showToast.error({
                        text1: this.translate('alertTitles.invalidRegionCode'),
                        text2: this.translate('alertMessages.invalidRegionCode'),
                    });
                } else if (error?.statusCode === 429) {
                    showToast.error({
                        text1: this.translate('alertTitles.tooManyAttempts'),
                        text2: this.translate('alertMessages.tooManyAttempts'),
                    });
                } else {
                    showToast.error({
                        text1: this.translate('alertTitles.backendErrorMessage'),
                        text2: this.translate('alertMessages.backendErrorMessage'),
                    });
                }
            })
            .finally(() => this.setState({ isSubmitting: false }));
    };

    onSubmitVerificationCode = () => {
        const { codeSentToPhoneNumber, verificationCode } = this.state;

        if (verificationCode.length !== 6) {
            return;
        }

        this.setState({
            isSubmitting: true,
            hasCodeError: false,
        });

        this.props
            .loginWithPhone({
                phoneNumber: codeSentToPhoneNumber,
                verificationCode,
                rememberMe: this.state.inputs.rememberMe,
            })
            .then((result: any) => {
                // One phone number, several accounts (personal / creator / business). We are
                // not signed in yet — the user has to say which one they meant.
                if (result?.requiresAccountSelection) {
                    this.setState({
                        mode: 'selectingAccount',
                        selectableAccounts: result.accounts || [],
                        phoneVerificationToken: result.phoneVerificationToken,
                        isSubmitting: false,
                    });
                    return undefined;
                }

                return rememberCurrentUser(codeSentToPhoneNumber);
            })
            .catch((error: any) => {
                // A rejected code is the common case here, so call it out precisely rather
                // than falling through to the generic credential message.
                if (error?.statusCode === 400) {
                    this.setState({
                        hasCodeError: true,
                        verificationCode: '',
                        isSubmitting: false,
                        prevLoginError: this.translate('forms.loginForm.invalidCode'),
                    });
                    showToast.error({
                        text1: this.translate('alertTitles.invalidCode'),
                        text2: this.translate('alertMessages.invalidCode'),
                    });
                    return;
                }

                this.onLoginError(error);
            });
    };

    onSelectPhoneAccount = (account: IPickableAccount) => {
        this.setState({ isSubmitting: true });

        this.props
            .selectPhoneLoginAccount({
                phoneVerificationToken: this.state.phoneVerificationToken,
                userId: account.id,
                rememberMe: this.state.inputs.rememberMe,
            })
            .then(() => rememberCurrentUser(this.state.codeSentToPhoneNumber))
            .catch(this.onLoginError);
    };

    /** Abandons the SMS flow and returns to the identifier + password form. */
    onUsePasswordInstead = () => {
        this.setState({
            mode: 'password',
            verificationCode: '',
            hasCodeError: false,
            prevLoginError: '',
        });
    };

    // REMEMBERED PROFILES

    toggleProfileSwitcher = () => {
        this.setState((prevState) => ({
            isProfileSwitcherVisible: !prevState.isProfileSwitcherVisible,
        }));
    };

    onSelectRememberedProfile = (account: IPickableAccount) => {
        this.setState((prevState) => ({
            inputs: {
                ...prevState.inputs,
                userName: account.identifier || '',
                // Never carry one account's password over to another.
                password: '',
            },
            activeProfileId: account.id,
            isProfileSwitcherVisible: false,
            mode: 'password',
            prevLoginError: '',
        }));
    };

    onForgetRememberedProfile = (account: IPickableAccount) => {
        forgetProfile(account.id).then((rememberedProfiles) => {
            this.setState((prevState) => {
                const wasActive = prevState.activeProfileId === account.id;

                return {
                    rememberedProfiles,
                    isProfileSwitcherVisible: rememberedProfiles.length > 0,
                    activeProfileId: wasActive ? '' : prevState.activeProfileId,
                    inputs: wasActive
                        ? { ...prevState.inputs, userName: '', password: '' }
                        : prevState.inputs,
                };
            });
        });
    };

    onUseAnotherAccount = () => {
        this.setState((prevState) => ({
            inputs: { ...prevState.inputs, userName: '', password: '' },
            activeProfileId: '',
            isProfileSwitcherVisible: false,
            mode: 'password',
            prevLoginError: '',
        }));
    };

    onInputChange = (name: string, value: string) => {
        const isIdentifierChange = name === 'userName';

        this.setState((prevState) => ({
            inputs: {
                ...prevState.inputs,
                [name]: value,
            },
            prevLoginError: '',
            // Editing the identifier detaches it from the remembered profile it came from and
            // invalidates any code already in flight.
            activeProfileId: isIdentifierChange ? '' : prevState.activeProfileId,
            mode: isIdentifierChange ? 'password' : prevState.mode,
        }));
    };

    /**
     * The SMS step: six-digit entry, resend, and an escape hatch back to the password form.
     */
    renderVerificationCodeStep() {
        const { themeAuthForm, themeForms } = this.props;
        const {
            codeSentToPhoneNumber,
            hasCodeError,
            isSubmitting,
            verificationCode,
        } = this.state;

        return (
            <>
                <Text style={[localStyles.codeHeading, { color: themeForms.colors.onSurface }]}>
                    {this.translate('forms.loginForm.labels.enterCode')}
                </Text>
                <Text style={[localStyles.codeSubheading, { color: themeForms.colors.onSurfaceMuted }]}>
                    {this.translate('forms.loginForm.subtitles.codeSentTo', { phoneNumber: codeSentToPhoneNumber })}
                </Text>
                <VerificationCodeInput
                    value={verificationCode}
                    onChangeText={(value) => this.setState({ verificationCode: value, hasCodeError: false })}
                    onComplete={() => this.onSubmitVerificationCode()}
                    disabled={isSubmitting}
                    hasError={hasCodeError}
                    themeForms={themeForms}
                />
                <View style={[themeAuthForm.styles.submitButtonContainer, spacingStyles.marginTopMd]}>
                    <Button
                        variant="primary"
                        size="lg"
                        shape="rounded"
                        disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                        disabledStyle={themeForms.styles.buttonDisabled}
                        title={this.translate('forms.loginForm.buttons.verifyAndSignIn')}
                        onPress={() => this.onSubmitVerificationCode()}
                        disabled={isSubmitting || verificationCode.length !== 6}
                        loading={isSubmitting}
                    />
                </View>
                <View style={themeForms.styles.moreLinksContainer}>
                    <Button
                        type="clear"
                        titleStyle={themeForms.styles.buttonLink}
                        title={this.translate('forms.loginForm.buttons.resendCode')}
                        onPress={this.onRequestVerificationCode}
                        disabled={isSubmitting}
                    />
                </View>
                <View style={themeForms.styles.moreLinksContainer}>
                    <Button
                        type="clear"
                        titleStyle={themeForms.styles.buttonLink}
                        title={this.translate('forms.loginForm.buttons.usePasswordInstead')}
                        onPress={this.onUsePasswordInstead}
                        disabled={isSubmitting}
                    />
                </View>
            </>
        );
    }

    /**
     * The default step: identifier (with the remembered-profile chevron) plus either a
     * password field or the "text me a code" button, depending on what was typed.
     */
    renderIdentifierStep() {
        const { isSubmitting, rememberedProfiles } = this.state;
        const { themeAlerts, themeAuthForm, themeForms } = this.props;
        const isPhoneMode = this.isPhoneModeActive();
        const hasRememberedProfiles = rememberedProfiles.length > 0;

        return (
            <>
                <RoundInput
                    autoCapitalize="none"
                    autoComplete={isPhoneMode ? 'tel' : 'email'}
                    autoCorrect={false}
                    keyboardType={isPhoneMode ? 'phone-pad' : 'default'}
                    placeholder={this.translate(
                        'forms.loginForm.labels.userName'
                    )}
                    value={this.state.inputs.userName}
                    onChangeText={(text) =>
                        this.onInputChange('userName', text)
                    }
                    rightIcon={
                        hasRememberedProfiles
                            ? (
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={this.translate('forms.loginForm.labels.switchAccount')}
                                    hitSlop={12}
                                    onPress={this.toggleProfileSwitcher}
                                    testID="login-profile-switcher"
                                >
                                    <MaterialIcon
                                        name="expand-more"
                                        size={26}
                                        color={themeAlerts.colors.placeholderTextColorAlt}
                                    />
                                </Pressable>
                            )
                            : (
                                <MaterialIcon
                                    name={isPhoneMode ? 'smartphone' : 'person'}
                                    size={24}
                                    color={themeAlerts.colors.placeholderTextColorAlt}
                                />
                            )
                    }
                    themeForms={themeForms}
                    containerStyle={{ marginBottom: 14 }}
                    testID="login-username"
                    inputStyle={{ fontSize: 17 }}
                />
                {
                    isPhoneMode
                        ? (
                            <>
                                <Text style={[localStyles.phoneHint, { color: themeForms.colors.onSurfaceMuted }]}>
                                    {this.translate('forms.loginForm.subtitles.phoneSignInHint')}
                                </Text>
                                <View style={themeAuthForm.styles.submitButtonContainer}>
                                    <Button
                                        variant="primary"
                                        size="lg"
                                        shape="rounded"
                                        disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                                        disabledStyle={themeForms.styles.buttonDisabled}
                                        title={this.translate('forms.loginForm.buttons.sendCode')}
                                        onPress={this.onRequestVerificationCode}
                                        disabled={this.isLoginFormDisabled()}
                                        loading={isSubmitting}
                                        icon={
                                            <MaterialIcon
                                                name="sms"
                                                size={18}
                                                style={themeForms.styles.buttonIcon}
                                            />
                                        }
                                        iconRight
                                    />
                                </View>
                            </>
                        )
                        : (
                            <>
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
                                        variant="primary"
                                        size="lg"
                                        shape="rounded"
                                        disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                                        disabledStyle={themeForms.styles.buttonDisabled}
                                        title={this.translate(
                                            'forms.loginForm.buttons.login'
                                        )}
                                        onPress={() => this.onSubmit()}
                                        disabled={this.isLoginFormDisabled()}
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
                            </>
                        )
                }
            </>
        );
    }

    public render() {
        const { isSubmitting, mode, rememberedProfiles, selectableAccounts } = this.state;
        const {
            navigation,
            themeAlerts,
            themeAuthForm,
            themeForms,
            userMessage,
        } = this.props;
        const isCodeStep = mode === 'awaitingCode';

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
                {isCodeStep ? this.renderVerificationCodeStep() : this.renderIdentifierStep()}
                {
                    // SSO and the sign-up/forgot-password links are noise mid-code-entry:
                    // the user is three taps from being signed in and needs no alternatives.
                    isCodeStep
                        ? null
                        : (
                            <>
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
                        )
                }
                {
                    // Mounted only while open. BaseModal renders through a react-native-paper
                    // `Portal`, which attaches to the Provider as soon as it mounts — keeping
                    // two of them permanently mounted costs teardown work on every render and
                    // makes the form unrenderable outside a PaperProvider.
                    this.state.isProfileSwitcherVisible
                        ? (
                            <AccountPickerModal
                                isVisible
                                accounts={rememberedProfiles}
                                selectedAccountId={this.state.activeProfileId}
                                headerText={this.translate('modals.accountPicker.switchHeader')}
                                onSelect={this.onSelectRememberedProfile}
                                onClose={this.toggleProfileSwitcher}
                                onForget={this.onForgetRememberedProfile}
                                onUseAnotherAccount={this.onUseAnotherAccount}
                                translate={this.translate}
                            />
                        )
                        : null
                }
                {
                    mode === 'selectingAccount'
                        ? (
                            <AccountPickerModal
                                isVisible
                                accounts={selectableAccounts}
                                headerText={this.translate('modals.accountPicker.chooseHeader')}
                                onSelect={this.onSelectPhoneAccount}
                                onClose={this.onUsePasswordInstead}
                                translate={this.translate}
                            />
                        )
                        : null
                }
            </>
        );
    }
}

const localStyles = StyleSheet.create({
    codeHeading: {
        fontSize: fontSizes.xl,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: space.xs,
    },
    codeSubheading: {
        fontSize: fontSizes.sm,
        textAlign: 'center',
        marginBottom: space.lg,
    },
    phoneHint: {
        fontSize: fontSizes.sm,
        textAlign: 'center',
        marginBottom: space.md,
    },
});

export default LoginFormComponent;
