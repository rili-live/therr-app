import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SegmentedButtons, Switch } from 'react-native-paper';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Button } from '../../components/BaseButton';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Picker as ReactPicker } from '@react-native-picker/picker';
import { IContentAlgorithmName, IMobileThemeName, IUserState } from 'therr-react/types';
import { BrandVariations, Content, FilePaths, PasswordRegex } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../../config/brandConfig';
import { resolveMobileThemeName } from '../../styles/themes';
import { sanitizeUserName } from 'therr-js-utilities/sanitizers';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import RNFB from 'react-native-blob-util';
import { showToast } from '../../utilities/toasts';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildSettingsFormStyles } from '../../styles/forms/settingsForm';
import textStyles from '../../styles/text';
import BaseInput from '../../components/Input';
import PasswordRequirements from '../../components/Input/PasswordRequirements';
import BaseStatusBar from '../../components/BaseStatusBar';
import UserImage from '../../components/UserContent/UserImage';
import { getImagePreviewPath } from '../../utilities/areaUtils';
import { getUserImageUri, signImageUrl } from '../../utilities/content';
import RoundTextInput from '../../components/Input/TextInput/Round';
import spacingStyles from '../../styles/layouts/spacing';

interface ISettingsDispatchProps {
    updateUser: Function;
}

interface IStoreProps extends ISettingsDispatchProps {
    user: IUserState;
}

// Regular component props
export interface ISettingsProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface ISettingsState {
    croppedImageDetails: any;
    inputs: any;
    isCropping: boolean;
    selectedLocale: string;
    selectedTheme: IMobileThemeName;
    selectedAlgorithm: IContentAlgorithmName;
    isOptedInToAds: boolean;
    isProfilePublic: boolean;
    isSubmitting: boolean;
    formErrors: IFormErrors;
}

type IFormErrors = { [fieldName: string]: string };

/**
 * Validated fields in the order they render. Drives which error the summary toast
 * reports and which section the screen scrolls to, so the user is always sent to the
 * topmost problem rather than an arbitrary key-order one.
 */
const VALIDATED_FIELDS = ['userName', 'firstName', 'lastName', 'oldPassword', 'password', 'repeatPassword'];
const PASSWORD_FIELDS = ['oldPassword', 'password', 'repeatPassword'];

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateUser: UsersActions.update,
}, dispatch);

export class Settings extends React.Component<ISettingsProps, ISettingsState> {
    private scrollViewRef;
    // Measured on layout rather than hardcoded: the sections above "User Profile" vary in
    // height by locale, theme, and which conditional links render for this account.
    private userSectionYOffset: number | null = null;
    private passwordSectionYOffset: number | null = null;
    private isUserSectionScrollPending = false;
    private firstNameInputRef;
    private translate: Function;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();
    private themeForms = buildFormStyles();
    private themeSettingsForm = buildSettingsFormStyles();

    constructor(props) {
        super(props);

        this.state = {
            croppedImageDetails: {},
            inputs: {
                email: props.user.details.email,
                firstName: props.user.details.firstName,
                lastName: props.user.details.lastName,
                userName: props.user.details.userName,
                phoneNumber: props.user.details.phoneNumber,
                settingsBio: props.user.settings.settingsBio,
                shouldHideMatureContent: props.user.details.shouldHideMatureContent,
            },
            isCropping: false,
            selectedLocale: props.user.settings.locale || 'en-us',
            selectedTheme: resolveMobileThemeName(props.user.settings.mobileThemeName) || 'light',
            selectedAlgorithm: props.user.settings.settingsContentAlgorithm || 'pulse',
            isOptedInToAds: props.user.settings.settingsPushBackground && props.user.settings.settingsPushMarketing,
            isProfilePublic: props.user.settings.settingsIsProfilePublic,
            isSubmitting: false,
            formErrors: {},
        };

        this.reloadTheme();
        this.translate = (key: string, params: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount = () => {
        this.props.navigation.setOptions({
            title: this.translate('pages.settings.headerTitle'),
        });

        if (this.props.route?.params?.scrollToSection === 'userProfile') {
            this.isUserSectionScrollPending = true;
            this.scrollToUserSection();
        }
    };

    componentDidUpdate = (prevProps: ISettingsProps) => {
        // Navigating here from a screen already below Settings in the stack re-uses this
        // instance, so the request arrives as a param change rather than a mount.
        const { params } = this.props.route || {};

        if (params !== prevProps.route?.params && params?.scrollToSection === 'userProfile') {
            this.isUserSectionScrollPending = true;
            this.scrollToUserSection();
        }
    };

    onUserSectionLayout = (event) => {
        this.userSectionYOffset = event.nativeEvent.layout.y;
        this.scrollToUserSection();
    };

    onPasswordSectionLayout = (event) => {
        this.passwordSectionYOffset = event.nativeEvent.layout.y;
    };

    /**
     * Scrolls to the "User Profile" section once both the request and the measurement exist.
     * Either can land first: the section may lay out before the param arrives on a re-navigate,
     * and on mount the param is known before anything has been measured.
     */
    scrollToUserSection = () => {
        if (!this.isUserSectionScrollPending || this.userSectionYOffset == null) {
            return;
        }

        this.isUserSectionScrollPending = false;
        this.props.navigation.setParams({ scrollToSection: undefined });
        this.scrollViewRef?.scrollTo({ x: 0, y: this.userSectionYOffset, animated: true });
    };

    goToManageAccount = () => {
        const { navigation } = this.props;

        navigation.push('ManageAccount');
    };

    /**
     * The "add your name" prompt renders directly above the name fields on this screen,
     * so it focuses them rather than navigating anywhere. KeyboardAwareScrollView
     * scrolls the focused input clear of the keyboard on its own.
     */
    focusFirstNameInput = () => {
        this.firstNameInputRef?.focus();
    };

    goToManageSpaces = () => {
        const { navigation } = this.props;

        navigation.push('ManageSpaces');
    };

    goToManageNotifications = () => {
        const { navigation } = this.props;

        navigation.push('ManageNotifications');
    };

    gotToManagePreferences = () => {
        const { navigation } = this.props;

        navigation.push('ManagePreferences');
    };

    goToMyQRCodes = () => {
        const { navigation } = this.props;

        navigation.push('MyQRCodes');
    };

    /**
     * Field-level validation keyed by input name; empty means the form can be submitted.
     *
     * The submit button intentionally stays enabled when this is non-empty. Disabling it
     * left accounts that are missing a name — a state this screen explicitly prompts users
     * to fix, and the normal state for Apple SSO sign-ups — staring at a dead button with
     * nothing on screen naming the blocking field. Validation now runs on press instead,
     * where it can say what is wrong and scroll to it.
     *
     * Phone number is not required: Apple SSO accounts are not guaranteed to have one.
     */
    getFormErrors = (): IFormErrors => {
        const { inputs } = this.state;
        const errors: IFormErrors = {};

        if (!inputs.userName) {
            errors.userName = this.translate('forms.settings.errorMessages.userNameRequired');
        }
        if (!inputs.firstName) {
            errors.firstName = this.translate('forms.settings.errorMessages.firstNameRequired');
        }
        if (!inputs.lastName) {
            errors.lastName = this.translate('forms.settings.errorMessages.lastNameRequired');
        }

        // A password change is all-or-nothing. The API needs the current password to
        // authorize the new one, so a half-filled trio previously passed validation and
        // then got silently dropped by the `oldPassword && password === repeatPassword`
        // guard below — the save reported success and the password never changed.
        if (PASSWORD_FIELDS.some((field) => inputs[field])) {
            if (!inputs.oldPassword) {
                errors.oldPassword = this.translate('forms.settings.errorMessages.oldPasswordRequired');
            }
            if (!inputs.password) {
                errors.password = this.translate('forms.settings.errorMessages.newPasswordRequired');
            } else if (!PasswordRegex.test(inputs.password)) {
                errors.password = this.translate('forms.settings.errorMessages.passwordInsecure');
            }
            if (inputs.password !== inputs.repeatPassword) {
                errors.repeatPassword = this.translate('forms.settings.errorMessages.repeatPassword');
            }
        }

        return errors;
    };

    /**
     * Scrolls to whichever section owns the given field. Both offsets are measured on
     * layout rather than hardcoded, for the same reason the user section already was:
     * the sections above vary in height by locale, theme, and account type.
     */
    scrollToFieldSection = (fieldName: string) => {
        const yOffset = PASSWORD_FIELDS.includes(fieldName)
            ? this.passwordSectionYOffset
            : this.userSectionYOffset;

        if (yOffset == null) {
            return;
        }

        this.scrollViewRef?.scrollTo({ x: 0, y: yOffset, animated: true });
    };

    reloadTheme = () => {
        const themeName = this.props.user.settings?.mobileThemeName;

        this.theme = buildStyles(themeName);
        this.themeMenu = buildMenuStyles(themeName);
        this.themeForms = buildFormStyles(themeName);
        this.themeSettingsForm = buildSettingsFormStyles(themeName);
    };

    onSubmit = () => {
        const {
            firstName,
            lastName,
            oldPassword,
            userName,
            phoneNumber,
            password,
            repeatPassword,
            settingsBio,
            shouldHideMatureContent,
        } = this.state.inputs;
        const { selectedTheme, selectedLocale, selectedAlgorithm, isOptedInToAds, isProfilePublic } = this.state;
        const { user } = this.props;

        if (this.state.isSubmitting) {
            return;
        }

        const formErrors = this.getFormErrors();
        const firstErrorField = VALIDATED_FIELDS.find((field) => formErrors[field]);

        if (firstErrorField) {
            // Three channels, because each covers a gap the others leave: inline messages
            // mark every offending field, the toast surfaces the reason even when the
            // field is off screen, and the scroll puts the first one in view.
            this.setState({ formErrors });
            showToast.error({
                text1: this.translate(firstErrorField === 'password' && password
                    ? 'pages.settings.alertTitles.insecurePassword'
                    : 'pages.settings.alertTitles.incompleteForm'),
                text2: formErrors[firstErrorField],
            });
            this.scrollToFieldSection(firstErrorField);
            return;
        }

        const updateArgs: any = {
            email: user.details.email,
            phoneNumber: user.details.phoneNumber || phoneNumber,
            firstName,
            lastName,
            userName: userName?.toLowerCase(),
            settingsBio,
            settingsLocale: selectedLocale,
            settingsThemeName: selectedTheme,
            settingsPushMarketing: isOptedInToAds,
            settingsPushBackground: isOptedInToAds,
            settingsIsProfilePublic: isProfilePublic,
            shouldHideMatureContent: shouldHideMatureContent === 'false' ? false : true,
        };

        // Sent only when it actually changed, unlike the settings above. Submitting it
        // unconditionally means a device whose cached redux predates the user's choice
        // reverts it on any unrelated save — and because the server resets the stream's
        // relevance scores on a change, that silently wipes the ranking too. Comparing
        // against the same value the picker was seeded from makes a stale device send
        // nothing rather than send the wrong thing.
        if (selectedAlgorithm !== (user.settings.settingsContentAlgorithm || 'pulse')) {
            updateArgs.settingsContentAlgorithm = selectedAlgorithm;
        }

        if (oldPassword && password === repeatPassword) {
            updateArgs.password = password;
            updateArgs.oldPassword = oldPassword;
        }

        this.setState({
            formErrors: {},
            isSubmitting: true,
        });
        this.requestUserUpdate(user, updateArgs).finally(() => {
            this.setState({
                isSubmitting: false,
            });
        });
    };

    requestUserUpdate = (user, updateArgs) => this.props
        .updateUser(user.details.id, updateArgs)
        .then(() => {
            showToast.success({
                text1: this.translate('pages.settings.alertTitles.accountUpdated'),
                text2: this.translate('pages.settings.alertMessages.accountUpdated'),
                duration: 2000,
                onHide: () => {
                    console.log('TODO: LOGOUT');
                },
            });
            this.reloadTheme();
        })
        .catch((error: any) => {
            if (
                error.statusCode === 400 ||
                error.statusCode === 401 ||
                error.statusCode === 404
            ) {
                showToast.error({
                    text1: this.translate('forms.settings.alertTitles.backendErrorMessage'),
                    text2: `${error.message}${
                        error.parameters
                            ? '(' + error.parameters.toString() + ')'
                            : ''
                    }`,
                });
            } else if (error.statusCode >= 500) {
                showToast.error({
                    text1: this.translate('forms.settings.alertTitles.backendErrorMessage'),
                    text2: this.translate('forms.settings.backendErrorMessage'),
                });
            }
        })
        .finally(() => {
            this.scrollViewRef?.scrollTo({ x: 0, y: 0, animated: true });
        });

    onInputChange = (name: string, value: string) => {
        const { inputs } = this.state;
        let sanitizedValue = value;
        if (name === 'userName') {
            sanitizedValue = sanitizeUserName(value);
        }
        const newInputChanges = {
            [name]: sanitizedValue,
        };
        const mergedInputs = {
            ...inputs,
            ...newInputChanges,
        };

        // Editing a field clears its own error: leaving a stale message under an input the
        // user is actively fixing reads as though the fix did not take.
        const formErrors = { ...this.state.formErrors };
        delete formErrors[name];

        // The confirmation mismatch is the exception that stays live rather than waiting
        // for submit — it is the only error the user cannot see from a single field.
        const hasPasswordMismatch = (mergedInputs.password || mergedInputs.repeatPassword)
            && mergedInputs.password !== mergedInputs.repeatPassword;
        if (hasPasswordMismatch) {
            formErrors.repeatPassword = this.translate('forms.settings.errorMessages.repeatPassword');
        } else {
            delete formErrors.repeatPassword;
        }

        this.setState({
            inputs: mergedInputs,
            formErrors,
        });
    };

    onLocaleChange = (value: string) => {
        this.setState({
            selectedLocale: value,
        });
    };

    onThemeChange = (value: string) => {
        this.setState({
            selectedTheme: value as IMobileThemeName,
        });
    };

    onAlgorithmChange = (value: string) => {
        this.setState({
            selectedAlgorithm: value as IContentAlgorithmName,
        });
    };

    onRewardSettingsChange = (isOptedInToAds: boolean) => {
        this.setState({
            isOptedInToAds,
        });
    };

    onProfileVisibilitySettingsChange = (isProfilePublic: boolean) => {
        this.setState({
            isProfilePublic,
        });
    };

    onDoneCropping = (croppedImageDetails) => {
        if (!croppedImageDetails.didCancel && !croppedImageDetails.errorCode) {
            const { user } = this.props;
            this.setState({
                croppedImageDetails,
                isCropping: false,
            });

            this.signAndUploadImage(croppedImageDetails).then((imageUploadResponse) => {
                this.requestUserUpdate(user, {
                    media: {
                        profilePicture: {
                            altText: `${user.details.firstName} ${user.details.lastName}`,
                            type: Content.mediaTypes.USER_IMAGE_PUBLIC,
                            path: imageUploadResponse.path,
                        },
                    },
                });
            }).catch((err) => {
                console.log(err);
            });
        }
    };

    signAndUploadImage = (croppedImageDetails) => {
        const filePathSplit = croppedImageDetails?.path?.split('.');
        const fileExtension = `${filePathSplit?.[filePathSplit.length - 1]}` || 'jpeg';
        return signImageUrl(true, {
            action: 'write',
            filename: `${FilePaths.PROFILE_PICTURE}.${fileExtension}`,
        }).then((response) => {
            const signedUrl = response?.data?.url && response?.data?.url[0];

            const localFileCroppedPath = `${croppedImageDetails?.path}`;

            // Upload to Google Cloud
            // TODO: Abstract and add nudity filter sightengine.com
            return RNFB.fetch(
                'PUT',
                signedUrl,
                {
                    'Content-Type': croppedImageDetails.mime,
                    'Content-Length': croppedImageDetails.size.toString(),
                    'Content-Disposition': 'inline',
                },
                RNFB.wrap(localFileCroppedPath),
            ).then(() => response?.data);
        });
    };

    handleRefresh = () => {
        console.log('refresh');
    };

    render() {
        const { navigation, user } = this.props;
        const {
            croppedImageDetails,
            inputs,
            selectedLocale,
            selectedTheme,
            selectedAlgorithm,
            isOptedInToAds,
            isProfilePublic,
            isSubmitting,
            formErrors,
        } = this.state;
        const pageHeaderUser = this.translate('pages.settings.pageHeaderUser');
        const pageHeaderPassword = this.translate('pages.settings.pageHeaderPassword');
        const pageHeaderDisplaySettings = this.translate('pages.settings.pageHeaderDisplaySettings');
        const pageHeaderRewardsSettings = this.translate('pages.settings.pageHeaderRewardsSettings');
        const pageHeaderPrivacySettings = this.translate('pages.settings.pageHeaderPrivacySettings');
        const pageHeaderContentSettings = this.translate('pages.settings.pageHeaderContentSettings');
        const pageHeaderAdvancedSettings = this.translate('pages.settings.pageHeaderAdvancedSettings');
        const pageHeaderNotificationSettings = this.translate('pages.settings.pageHeaderNotificationSettings');
        const pageHeaderLanguageSettings = this.translate('pages.settings.pageHeaderLanguageSettings');
        const currentUserImageUri = getUserImageUri(user, 200);
        const userImageUri = getImagePreviewPath(croppedImageDetails.path) || currentUserImageUri;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView edges={[]}  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={this.theme.styles.scrollView}
                    >
                        <View style={this.theme.styles.body}>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {pageHeaderPrivacySettings}
                                </Text>
                            </View>
                            <View style={this.themeSettingsForm.styles.settingsContainer}>
                                <View style={this.themeForms.styles.switchContainer}>
                                    <Text
                                        style={this.themeForms.styles.switchLabel}
                                    >
                                        {this.translate('pages.settings.labels.isPublic')}
                                    </Text>
                                    <View
                                        style={this.themeForms.styles.switchSubContainer}
                                    >
                                        <Switch
                                            style={this.themeForms.styles.switchButton}
                                            color={this.theme.colors.primary3}
                                            onValueChange={this.onProfileVisibilitySettingsChange}
                                            value={isProfilePublic}
                                        />
                                        <FontAwesomeIcon
                                            name={isProfilePublic ? 'eye' : 'eye-slash'}
                                            size={22}
                                            color={isProfilePublic ? this.theme.colors.primary3 : this.theme.colorVariations.primary3Fade}
                                        />
                                    </View>
                                </View>
                            </View>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {pageHeaderRewardsSettings}
                                </Text>
                            </View>
                            <View style={this.themeSettingsForm.styles.settingsContainer}>
                                <View style={this.themeForms.styles.switchContainer}>
                                    <Text
                                        style={this.themeForms.styles.switchLabel}
                                    >
                                        {this.translate('pages.settings.labels.enableRewards')}
                                    </Text>
                                    <View
                                        style={this.themeForms.styles.switchSubContainer}
                                    >
                                        <Switch
                                            style={this.themeForms.styles.switchButton}
                                            color={this.theme.colors.primary3}
                                            onValueChange={this.onRewardSettingsChange}
                                            value={isOptedInToAds}
                                        />
                                        <FontAwesomeIcon
                                            name="trophy"
                                            size={22}
                                            color={isOptedInToAds ? this.theme.colors.primary3 : this.theme.colorVariations.primary3Fade}
                                        />
                                    </View>
                                </View>
                            </View>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {pageHeaderDisplaySettings}
                                </Text>
                            </View>
                            <View style={this.themeSettingsForm.styles.settingsContainer}>
                                <SegmentedButtons
                                    value={selectedTheme}
                                    onValueChange={this.onThemeChange}
                                    buttons={[
                                        { value: 'light', label: this.translate('pages.settings.labels.themeLight'), icon: 'white-balance-sunny' },
                                        { value: 'dark', label: this.translate('pages.settings.labels.themeDark'), icon: 'moon-waning-crescent' },
                                        ...(CURRENT_BRAND_VARIATION === BrandVariations.HABITS
                                            ? []
                                            : [{ value: 'retro', label: this.translate('pages.settings.labels.themeRetro'), icon: 'palette-outline' }]),
                                    ]}
                                />
                            </View>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {pageHeaderLanguageSettings}
                                </Text>
                            </View>
                            <View style={this.themeSettingsForm.styles.settingsContainer}>
                                <SegmentedButtons
                                    value={selectedLocale}
                                    onValueChange={this.onLocaleChange}
                                    buttons={[
                                        { value: 'en-us', label: 'English', icon: 'translate' },
                                        { value: 'es', label: 'Español', icon: 'translate' },
                                        { value: 'fr-ca', label: 'Français', icon: 'translate' },
                                    ]}
                                />
                            </View>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {pageHeaderContentSettings}
                                </Text>
                            </View>
                            <View style={this.themeSettingsForm.styles.settingsContainer}>
                                <SegmentedButtons
                                    value={selectedAlgorithm}
                                    onValueChange={this.onAlgorithmChange}
                                    buttons={[
                                        { value: 'pulse', label: this.translate('pages.settings.labels.algorithmPulse'), icon: 'pulse' },
                                        { value: 'focus', label: this.translate('pages.settings.labels.algorithmFocus'), icon: 'target' },
                                    ]}
                                />
                                <Text style={this.theme.styles.sectionDescription}>
                                    {this.translate('pages.settings.labels.contentAlgorithm')}: {this.translate(
                                        selectedAlgorithm === 'focus'
                                            ? 'pages.settings.labels.algorithmFocusDescription'
                                            : 'pages.settings.labels.algorithmPulseDescription'
                                    )}
                                </Text>
                                <Text style={[
                                    this.theme.styles.sectionDescription,
                                    spacingStyles.marginBotXl,
                                    spacingStyles.marginTopLg,
                                ]}>
                                    <Text
                                        style={this.themeForms.styles.buttonLink}
                                        onPress={this.gotToManagePreferences}>{this.translate('forms.settings.buttons.managePreferences')}</Text>
                                </Text>
                                <ReactPicker
                                    selectedValue={inputs.shouldHideMatureContent?.toString()}
                                    style={this.themeForms.styles.picker}
                                    itemStyle={this.themeForms.styles.pickerItem}
                                    onValueChange={(itemValue) =>
                                        this.onInputChange('shouldHideMatureContent', itemValue)
                                    }>
                                    <ReactPicker.Item label={this.translate(
                                        'forms.settings.labels.hideReportedContent'
                                    )} value={'true'} />
                                    <ReactPicker.Item label={this.translate(
                                        'forms.settings.labels.showReportedContent'
                                    )} value={'false'} />
                                </ReactPicker>
                            </View>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {pageHeaderNotificationSettings}
                                </Text>
                            </View>
                            <View style={this.themeSettingsForm.styles.advancedContainer}>
                                <Text style={this.theme.styles.sectionDescription}>
                                    <Text
                                        style={this.themeForms.styles.buttonLink}
                                        onPress={this.goToManageNotifications}>{this.translate('forms.settings.buttons.manageNotifications')}</Text>
                                </Text>
                            </View>
                            <View style={this.themeSettingsForm.styles.advancedContainer}>
                                <Text style={this.theme.styles.sectionDescription}>
                                    <Text
                                        style={this.themeForms.styles.buttonLink}
                                        onPress={this.goToMyQRCodes}>{this.translate('forms.settings.buttons.myQRCodes')}</Text>
                                </Text>
                            </View>
                            <View style={this.theme.styles.sectionContainer} onLayout={this.onUserSectionLayout}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {pageHeaderUser}
                                </Text>
                            </View>
                            {!user.details?.firstName && (
                                <View style={this.themeSettingsForm.styles.advancedContainer}>
                                    <Text style={[this.theme.styles.sectionDescription, { color: this.theme.colors.primary3 }]}>
                                        <Text
                                            style={this.themeForms.styles.buttonLink}
                                            onPress={this.focusFirstNameInput}
                                        >
                                            {this.translate('forms.settings.labels.addYourNamePrompt')}
                                        </Text>
                                    </Text>
                                </View>
                            )}
                            <View style={this.themeSettingsForm.styles.userContainer}>
                                <UserImage
                                    user={user}
                                    onImageReady={this.onDoneCropping}
                                    theme={this.theme}
                                    themeForms={this.themeForms}
                                    userImageUri={userImageUri}
                                />
                                <BaseInput
                                    variant="square"
                                    label={this.translate(
                                        'forms.settings.labels.userName'
                                    )}
                                    labelStyle={this.themeForms.styles.inputLabelLightFaded}
                                    value={inputs.userName}
                                    onChangeText={(text) =>
                                        this.onInputChange('userName', text)
                                    }
                                    errorMessage={formErrors.userName}
                                    rightIcon={
                                        <FontAwesomeIcon
                                            name="user"
                                            size={22}
                                            color={this.theme.colorVariations.primary3Fade}
                                        />
                                    }
                                    themeForms={this.themeForms}
                                />
                                <BaseInput
                                    variant="square"
                                    inputRef={(component) => (this.firstNameInputRef = component)}
                                    label={this.translate(
                                        'forms.settings.labels.firstName'
                                    )}
                                    labelStyle={this.themeForms.styles.inputLabelLightFaded}
                                    value={inputs.firstName}
                                    onChangeText={(text) =>
                                        this.onInputChange('firstName', text)
                                    }
                                    errorMessage={formErrors.firstName}
                                    rightIcon={
                                        <FontAwesomeIcon
                                            name="smile"
                                            size={22}
                                            color={this.theme.colorVariations.primary3Fade}
                                        />
                                    }
                                    themeForms={this.themeForms}
                                />
                                <BaseInput
                                    variant="square"
                                    label={this.translate(
                                        'forms.settings.labels.lastName'
                                    )}
                                    labelStyle={this.themeForms.styles.inputLabelLightFaded}
                                    value={inputs.lastName}
                                    onChangeText={(text) =>
                                        this.onInputChange('lastName', text)
                                    }
                                    errorMessage={formErrors.lastName}
                                    rightIcon={
                                        <FontAwesomeIcon
                                            name="smile-beam"
                                            size={22}
                                            color={this.theme.colorVariations.primary3Fade}
                                        />
                                    }
                                    themeForms={this.themeForms}
                                />
                                <BaseInput
                                    variant="square"
                                    disabled
                                    label={this.translate(
                                        'forms.settings.labels.email'
                                    )}
                                    labelStyle={this.themeForms.styles.inputLabelLightFaded}
                                    value={inputs.email}
                                    // onChangeText={(text) =>
                                    //     this.onInputChange('email', text)
                                    // }
                                    rightIcon={
                                        <MaterialIcon
                                            name="email"
                                            size={24}
                                            color={this.theme.colorVariations.primary3Fade}
                                        />
                                    }
                                    themeForms={this.themeForms}
                                />
                                {/* TODO: RMOBILE-26: Use react-native-phone-input */}
                                <BaseInput
                                    variant="square"
                                    disabled
                                    label={this.translate(
                                        'forms.settings.labels.phoneNumber'
                                    )}
                                    labelStyle={this.themeForms.styles.inputLabelLightFaded}
                                    value={inputs.phoneNumber}
                                    // onChangeText={(text) =>
                                    //     this.onInputChange('phoneNumber', text)
                                    // }
                                    rightIcon={
                                        <MaterialIcon
                                            name="phone"
                                            size={24}
                                            color={this.theme.colorVariations.primary3Fade}
                                        />
                                    }
                                    themeForms={this.themeForms}
                                />
                                <Text style={[this.theme.styles.sectionTitle, spacingStyles.marginTopLg]}>
                                    {this.translate('forms.settings.labels.bioHeader')}
                                </Text>
                                <RoundTextInput
                                    placeholder={this.translate(
                                        'forms.settings.labels.bio'
                                    )}
                                    value={inputs.settingsBio}
                                    onChangeText={(text) =>
                                        this.onInputChange('settingsBio', text)
                                    }
                                    minHeight={110}
                                    numberOfLines={5}
                                    themeForms={this.themeForms}
                                    maxLength={255}
                                />
                                <Text style={textStyles.textRight}>{`${inputs.settingsBio?.length}/255`}</Text>
                            </View>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {pageHeaderAdvancedSettings}
                                </Text>
                            </View>
                            <View style={this.themeSettingsForm.styles.advancedContainer}>
                                <Text style={this.theme.styles.sectionDescription}>
                                    <Text
                                        style={this.themeForms.styles.buttonLink}
                                        onPress={this.goToManageAccount}>{this.translate('forms.settings.buttons.manageAccount')}</Text>
                                </Text>
                            </View>
                            {user.details?.isBusinessAccount && (
                                <View style={this.themeSettingsForm.styles.advancedContainer}>
                                    <Text style={this.theme.styles.sectionDescription}>
                                        <Text
                                            style={this.themeForms.styles.buttonLink}
                                            onPress={this.goToManageSpaces}>{this.translate('forms.settings.buttons.manageSpaces')}</Text>
                                    </Text>
                                </View>
                            )}
                            <View style={this.theme.styles.sectionContainer} onLayout={this.onPasswordSectionLayout}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {pageHeaderPassword}
                                </Text>
                            </View>
                            <View style={this.themeSettingsForm.styles.passwordContainer}>
                                <PasswordRequirements translate={this.translate} password={inputs.password} themeForms={this.themeForms} />
                                <BaseInput
                                    variant="square"
                                    placeholder={this.translate(
                                        'forms.settings.labels.password'
                                    )}
                                    placeholderTextColor={this.themeForms.styles.placeholderText.color}
                                    value={inputs.oldPassword}
                                    onChangeText={(text) =>
                                        this.onInputChange('oldPassword', text)
                                    }
                                    secureTextEntry={true}
                                    errorMessage={formErrors.oldPassword}
                                    rightIcon={
                                        <MaterialIcon
                                            name="vpn-key"
                                            size={26}
                                            color={this.theme.colorVariations.primary3Fade}
                                        />
                                    }
                                    themeForms={this.themeForms}
                                />
                                <BaseInput
                                    variant="square"
                                    placeholder={this.translate(
                                        'forms.settings.labels.newPassword'
                                    )}
                                    placeholderTextColor={this.themeForms.styles.placeholderText.color}
                                    value={inputs.password}
                                    onChangeText={(text) =>
                                        this.onInputChange('password', text)
                                    }
                                    secureTextEntry={true}
                                    errorMessage={formErrors.password}
                                    rightIcon={
                                        <MaterialIcon
                                            name="lock"
                                            size={26}
                                            color={this.theme.colorVariations.primary3Fade}
                                        />
                                    }
                                    themeForms={this.themeForms}
                                />
                                <BaseInput
                                    variant="square"
                                    placeholder={this.translate(
                                        'forms.settings.labels.repeatPassword'
                                    )}
                                    placeholderTextColor={this.themeForms.styles.placeholderText.color}
                                    value={inputs.repeatPassword}
                                    onChangeText={(text) =>
                                        this.onInputChange('repeatPassword', text)
                                    }
                                    secureTextEntry={true}
                                    errorMessage={formErrors.repeatPassword}
                                    rightIcon={
                                        <MaterialIcon
                                            name="lock"
                                            size={26}
                                            color={this.theme.colorVariations.primary3Fade}
                                        />
                                    }
                                    themeForms={this.themeForms}
                                />
                                <Button
                                    type="clear"
                                    titleStyle={this.themeForms.styles.buttonLink}
                                    title={this.translate(
                                        'forms.loginForm.buttons.forgotPassword'
                                    )}
                                    containerStyle={[
                                        spacingStyles.marginTopSm,
                                        spacingStyles.marginBotSm,
                                    ]}
                                    onPress={() => navigation.navigate('ForgotPassword')}
                                />
                            </View>
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
                <View style={this.themeMenu.styles.submitButtonContainerFloat}>
                    <Button
                        buttonStyle={this.themeForms.styles.buttonPrimary}
                        disabledStyle={this.themeForms.styles.buttonDisabled}
                        titleStyle={this.themeForms.styles.buttonTitle}
                        disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                        title={this.translate(
                            'forms.settings.buttons.submit'
                        )}
                        onPress={this.onSubmit}
                        disabled={isSubmitting}
                        loading={isSubmitting}
                    />
                </View>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Settings);
