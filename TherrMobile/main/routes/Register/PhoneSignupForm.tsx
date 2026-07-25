import * as React from 'react';
import {
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import { ApiService } from 'therr-react/services';
import { ErrorCodes, PasswordRegex } from 'therr-js-utilities/constants';
import isValidSignupAge, { MINIMUM_SIGNUP_AGE } from 'therr-js-utilities/is-valid-signup-age';
import { Button } from '../../components/BaseButton';
import { showToast } from '../../utilities/toasts';
import translator from '../../utilities/translator';
import RoundInput from '../../components/Input/Round';
import PhoneNumberInput from '../../components/Input/PhoneNumberInput';
import VerificationCodeInput from '../../components/Input/VerificationCodeInput';
import PasswordRequirements from '../../components/Input/PasswordRequirements';
import TherrIcon from '../../components/TherrIcon';
import Alert from '../../components/Alert';
import { addMargins } from '../../styles';
import spacingStyles, { space } from '../../styles/layouts/spacing';
import { fontSizes } from '../../styles/text';
import { ITherrThemeColors, ITherrThemeColorVariations, isDarkTheme } from '../../styles/themes';

/**
 * Three steps, in order. The account row is not created until `details` is submitted, so an
 * abandoned sign-up leaves nothing behind — only a spent SMS code and an expired token.
 */
type PhoneSignupStep = 'phone' | 'code' | 'details';

interface IPhoneSignupFormProps {
    register: Function;
    onSuccess: (args: { email: string; phoneNumber: string }) => void;
    onSwitchToEmailSignup: () => void;
    onSwitchToSignIn: () => void;
    toggleEULA: Function;
    userSettings: any;
    theme: {
        colors: ITherrThemeColors;
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

interface IPhoneSignupFormState {
    step: PhoneSignupStep;
    phoneNumber: string;
    isPhoneNumberValid: boolean;
    verificationCode: string;
    hasCodeError: boolean;
    /** Signed proof of phone ownership; expires ~20 minutes after the code is accepted. */
    phoneVerificationToken: string;
    email: string;
    password: string;
    settingsBirthdate: string;
    isBirthdatePickerOpen: boolean;
    isPasswordEntryDirty: boolean;
    isSubmitting: boolean;
    errorMessage: string;
}

/**
 * Phone-first sign-up: verify the handset, then collect an email.
 *
 * Deliberately inverted from the classic form. The first screen asks for one thing the user
 * already knows by heart, and the code they get back does double duty — it proves the number
 * and doubles as their sign-in method from then on, so a password is genuinely optional. The
 * email step still exists (accounts need a recoverable address and it is how we reach people)
 * but it now happens *after* the user is invested, not before.
 */
export class PhoneSignupFormComponent extends React.Component<
    IPhoneSignupFormProps,
    IPhoneSignupFormState
> {
    private translate: Function;

    constructor(props: IPhoneSignupFormProps) {
        super(props);

        this.state = {
            step: 'phone',
            phoneNumber: '',
            isPhoneNumberValid: false,
            verificationCode: '',
            hasCodeError: false,
            phoneVerificationToken: '',
            email: '',
            password: '',
            settingsBirthdate: '',
            isBirthdatePickerOpen: false,
            isPasswordEntryDirty: false,
            isSubmitting: false,
            errorMessage: '',
        };

        // Read from `this.props` so labels re-translate when the pre-login locale changes.
        this.translate = (key: string, params?: any) =>
            translator(this.props.userSettings?.locale || 'en-us', key, params);
    }

    getDefaultBirthdate = () => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - MINIMUM_SIGNUP_AGE);
        return d;
    };

    onPhoneInputChange = (value: string, isValid: boolean) => {
        this.setState({
            phoneNumber: value,
            isPhoneNumberValid: isValid,
            errorMessage: '',
        });
    };

    onRequestCode = () => {
        const { phoneNumber } = this.state;

        this.setState({ isSubmitting: true, errorMessage: '' });

        ApiService.startPhoneRegistration(phoneNumber)
            .then(() => {
                this.setState({
                    step: 'code',
                    verificationCode: '',
                    hasCodeError: false,
                });
                showToast.success({
                    text1: this.translate('alertTitles.codeSent'),
                    text2: this.translate('alertMessages.codeSent'),
                });
            })
            .catch((error: any) => {
                // Unlike sign-in, this endpoint does tell us the number is taken — surface it
                // and point at sign-in rather than leaving the user stuck on a dead form.
                if (error?.errorCode === ErrorCodes.USER_EXISTS) {
                    this.setState({
                        errorMessage: this.translate('forms.phoneSignupForm.errorMessages.accountExists'),
                    });
                    showToast.error({
                        text1: this.translate('alertTitles.phoneNumberAlreadyInUse'),
                        text2: this.translate('alertMessages.phoneNumberAlreadyInUse'),
                    });
                } else if (error?.errorCode === ErrorCodes.INVALID_REGION) {
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

    onSubmitCode = () => {
        const { phoneNumber, verificationCode } = this.state;

        if (verificationCode.length !== 6) {
            return;
        }

        this.setState({ isSubmitting: true, hasCodeError: false });

        ApiService.verifyPhoneRegistration({ phoneNumber, verificationCode })
            .then((response: any) => {
                this.setState({
                    step: 'details',
                    phoneVerificationToken: response?.data?.phoneVerificationToken || '',
                });
            })
            .catch((error: any) => {
                if (error?.statusCode === 400) {
                    this.setState({ hasCodeError: true, verificationCode: '' });
                    showToast.error({
                        text1: this.translate('alertTitles.invalidCode'),
                        text2: this.translate('alertMessages.invalidCode'),
                    });
                    return;
                }
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    text2: this.translate('alertMessages.backendErrorMessage'),
                });
            })
            .finally(() => this.setState({ isSubmitting: false }));
    };

    onBirthdateConfirm = (date: Date) => {
        this.setState({ isBirthdatePickerOpen: false });

        if (!isValidSignupAge(date)) {
            showToast.error({
                text1: this.translate('alertTitles.registrationError'),
                text2: this.translate('forms.registerForm.errorMessages.birthdateTooYoung', { minAge: `${MINIMUM_SIGNUP_AGE}` }),
            });
            return;
        }

        this.setState({ settingsBirthdate: date.toISOString() });
    };

    isDetailsStepDisabled = () => {
        const { email, isSubmitting, settingsBirthdate } = this.state;

        return !email || !settingsBirthdate || !isValidSignupAge(settingsBirthdate) || isSubmitting;
    };

    onSubmitDetails = () => {
        const {
            email,
            password,
            phoneNumber,
            phoneVerificationToken,
            settingsBirthdate,
        } = this.state;

        if (!email) {
            showToast.error({
                text1: this.translate('alertTitles.registrationError'),
                text2: this.translate('forms.registerForm.missingEmail'),
            });
            return;
        }
        // Password is optional here — but if one was typed it still has to be a real one.
        if (password && !PasswordRegex.test(password)) {
            this.setState({
                errorMessage: this.translate('forms.registerForm.errorMessages.passwordInsecure'),
            });
            return;
        }
        if (!settingsBirthdate || !isValidSignupAge(settingsBirthdate)) {
            showToast.error({
                text1: this.translate('alertTitles.registrationError'),
                text2: this.translate('forms.registerForm.errorMessages.birthdateTooYoung', { minAge: `${MINIMUM_SIGNUP_AGE}` }),
            });
            return;
        }

        this.setState({ isSubmitting: true, errorMessage: '' });

        this.props
            .register({
                email: email.trim(),
                password: password || undefined,
                phoneNumber,
                phoneVerificationToken,
                settingsBirthdate,
                settingsLocale: this.props.userSettings?.locale || 'en-us',
            })
            .then(() => this.props.onSuccess({ email: email.trim(), phoneNumber }))
            .catch((error: any) => {
                this.setState({
                    isSubmitting: false,
                    errorMessage: error?.statusCode === 400
                        ? `${error.message}`
                        : this.translate('forms.registerForm.backendErrorMessage'),
                });
            });
    };

    openPrivacyPolicy = () => {
        Linking.openURL('https://www.therr.app/privacy-policy.html');
    };

    renderPhoneStep() {
        const { theme, themeAuthForm, themeForms } = this.props;
        const { isPhoneNumberValid, isSubmitting } = this.state;

        return (
            <>
                <Text style={[localStyles.stepHeading, { color: themeForms.colors.onSurface }]}>
                    {this.translate('forms.phoneSignupForm.labels.enterPhone')}
                </Text>
                <Text style={[localStyles.stepSubheading, { color: themeForms.colors.onSurfaceMuted }]}>
                    {this.translate('forms.phoneSignupForm.subtitles.enterPhone')}
                </Text>
                <PhoneNumberInput
                    onChangeText={this.onPhoneInputChange}
                    onSubmit={this.onRequestCode}
                    placeholder={this.translate('forms.settings.labels.phoneNumber')}
                    translate={this.translate}
                    theme={theme}
                    themeForms={themeForms}
                />
                <View style={[themeAuthForm.styles.submitButtonContainer, spacingStyles.marginTopLg]}>
                    <Button
                        variant="primary"
                        size="lg"
                        shape="rounded"
                        disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                        disabledStyle={themeForms.styles.buttonDisabled}
                        title={this.translate('forms.phoneSignupForm.buttons.sendCode')}
                        onPress={this.onRequestCode}
                        disabled={!isPhoneNumberValid || isSubmitting}
                        loading={isSubmitting}
                    />
                </View>
            </>
        );
    }

    renderCodeStep() {
        const { themeAuthForm, themeForms } = this.props;
        const {
            hasCodeError,
            isSubmitting,
            phoneNumber,
            verificationCode,
        } = this.state;

        return (
            <>
                <Text style={[localStyles.stepHeading, { color: themeForms.colors.onSurface }]}>
                    {this.translate('forms.phoneSignupForm.labels.enterCode')}
                </Text>
                <Text style={[localStyles.stepSubheading, { color: themeForms.colors.onSurfaceMuted }]}>
                    {this.translate('forms.loginForm.subtitles.codeSentTo', { phoneNumber })}
                </Text>
                <VerificationCodeInput
                    value={verificationCode}
                    onChangeText={(value) => this.setState({ verificationCode: value, hasCodeError: false })}
                    onComplete={this.onSubmitCode}
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
                        title={this.translate('forms.phoneSignupForm.buttons.verify')}
                        onPress={this.onSubmitCode}
                        disabled={isSubmitting || verificationCode.length !== 6}
                        loading={isSubmitting}
                    />
                </View>
                <View style={themeForms.styles.moreLinksContainer}>
                    <Button
                        type="clear"
                        titleStyle={themeForms.styles.buttonLink}
                        title={this.translate('forms.loginForm.buttons.resendCode')}
                        onPress={this.onRequestCode}
                        disabled={isSubmitting}
                    />
                </View>
                <View style={themeForms.styles.moreLinksContainer}>
                    <Button
                        type="clear"
                        titleStyle={themeForms.styles.buttonLink}
                        title={this.translate('forms.phoneSignupForm.buttons.changeNumber')}
                        onPress={() => this.setState({ step: 'phone', verificationCode: '', hasCodeError: false })}
                        disabled={isSubmitting}
                    />
                </View>
            </>
        );
    }

    renderDetailsStep() {
        const { theme, themeAlerts, themeAuthForm, themeForms, toggleEULA } = this.props;
        const {
            email,
            isBirthdatePickerOpen,
            isPasswordEntryDirty,
            isSubmitting,
            password,
            settingsBirthdate,
        } = this.state;

        return (
            <>
                <Text style={[localStyles.stepHeading, { color: themeForms.colors.onSurface }]}>
                    {this.translate('forms.phoneSignupForm.labels.enterEmail')}
                </Text>
                <Text style={[localStyles.stepSubheading, { color: themeForms.colors.onSurfaceMuted }]}>
                    {this.translate('forms.phoneSignupForm.subtitles.enterEmail')}
                </Text>
                <RoundInput
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder={this.translate('forms.registerForm.labels.email')}
                    value={email}
                    onChangeText={(text) => this.setState({ email: text, errorMessage: '' })}
                    rightIcon={
                        <TherrIcon
                            name="mail"
                            size={24}
                            color={themeAlerts.colors.placeholderTextColorAlt}
                        />
                    }
                    themeForms={themeForms}
                    containerStyle={{ marginBottom: 14 }}
                    testID="phone-signup-email"
                />
                <Pressable onPress={() => this.setState({ isBirthdatePickerOpen: true })}>
                    <View pointerEvents="none">
                        <RoundInput
                            editable={false}
                            placeholder={this.translate('forms.registerForm.labels.birthdate')}
                            value={
                                settingsBirthdate
                                    ? new Date(settingsBirthdate)
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
                <Text style={[theme.styles.sectionDescription, localStyles.hint]}>
                    {this.translate('forms.registerForm.subtitles.birthdateHint', { minAge: `${MINIMUM_SIGNUP_AGE}` })}
                </Text>
                <DatePicker
                    modal
                    mode="date"
                    open={isBirthdatePickerOpen}
                    date={settingsBirthdate ? new Date(settingsBirthdate) : this.getDefaultBirthdate()}
                    maximumDate={new Date()}
                    onConfirm={this.onBirthdateConfirm}
                    onCancel={() => this.setState({ isBirthdatePickerOpen: false })}
                    theme={isDarkTheme(this.props.userSettings?.mobileThemeName) ? 'dark' : 'light'}
                />
                {
                    isPasswordEntryDirty &&
                        <PasswordRequirements translate={this.translate} password={password} themeForms={themeForms} />
                }
                <RoundInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={this.translate('forms.phoneSignupForm.labels.optionalPassword')}
                    value={password}
                    onChangeText={(text) => this.setState({
                        password: text,
                        isPasswordEntryDirty: true,
                        errorMessage: '',
                    })}
                    secureTextEntry={true}
                    rightIcon={
                        <TherrIcon
                            name="key"
                            size={24}
                            color={themeAlerts.colors.placeholderTextColorAlt}
                        />
                    }
                    themeForms={themeForms}
                    containerStyle={{ marginBottom: 6 }}
                    testID="phone-signup-password"
                />
                <Text style={[theme.styles.sectionDescription, localStyles.hint]}>
                    {this.translate('forms.phoneSignupForm.subtitles.optionalPassword')}
                </Text>
                <Text style={[theme.styles.sectionDescription, localStyles.disclaimer]}>
                    {this.translate('forms.registerForm.subtitles.disclaimer')}
                    <Text
                        style={themeForms.styles.buttonLink}
                        onPress={() => toggleEULA()}>{this.translate('forms.registerForm.buttons.eula')}</Text>
                    {this.translate('forms.registerForm.subtitles.and')}
                    <Text
                        style={themeForms.styles.buttonLink}
                        onPress={this.openPrivacyPolicy}>{this.translate('forms.registerForm.buttons.privacyPolicy')}</Text>
                </Text>
                <View style={themeAuthForm.styles.submitButtonContainer}>
                    <Button
                        variant="primary"
                        size="lg"
                        shape="rounded"
                        disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                        disabledStyle={themeForms.styles.buttonDisabled}
                        title={this.translate('forms.registerForm.buttons.register')}
                        onPress={this.onSubmitDetails}
                        disabled={this.isDetailsStepDisabled()}
                        loading={isSubmitting}
                    />
                </View>
            </>
        );
    }

    public render() {
        const { themeAlerts, themeForms } = this.props;
        const { errorMessage, step } = this.state;

        return (
            <>
                <Alert
                    containerStyles={addMargins({ marginBottom: 16 })}
                    isVisible={!!errorMessage}
                    message={errorMessage}
                    type={'error'}
                    themeAlerts={themeAlerts}
                />
                {step === 'phone' && this.renderPhoneStep()}
                {step === 'code' && this.renderCodeStep()}
                {step === 'details' && this.renderDetailsStep()}
                {
                    // Only offered before the SMS is sent — once a code is in flight, an escape
                    // hatch that discards it is a way to lose progress, not a convenience.
                    step === 'phone'
                        ? (
                            <>
                                <View style={[themeForms.styles.moreLinksContainer, spacingStyles.marginTopMd]}>
                                    <Button
                                        type="clear"
                                        titleStyle={themeForms.styles.buttonLink}
                                        title={this.translate('forms.phoneSignupForm.buttons.useEmailInstead')}
                                        onPress={this.props.onSwitchToEmailSignup}
                                    />
                                </View>
                                <View style={themeForms.styles.moreLinksContainer}>
                                    <Button
                                        type="clear"
                                        titleStyle={themeForms.styles.buttonLink}
                                        title={this.translate('forms.registerForm.buttons.backToLogin')}
                                        onPress={this.props.onSwitchToSignIn}
                                    />
                                </View>
                            </>
                        )
                        : null
                }
            </>
        );
    }
}

const localStyles = StyleSheet.create({
    stepHeading: {
        fontSize: fontSizes.xl,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: space.xs,
    },
    stepSubheading: {
        fontSize: fontSizes.sm,
        textAlign: 'center',
        marginBottom: space.lg,
    },
    hint: {
        fontSize: fontSizes.xs,
        textAlign: 'center',
        marginTop: space.xs,
        marginBottom: space.lg,
    },
    disclaimer: {
        marginBottom: space.xl,
    },
});

export default PhoneSignupFormComponent;
