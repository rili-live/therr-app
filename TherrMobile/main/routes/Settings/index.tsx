import React from 'react';
import { SafeAreaView, Switch, View, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Button }  from 'react-native-elements';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Picker as ReactPicker } from '@react-native-picker/picker';
import { IUserState } from 'therr-react/types';
import { Content, PasswordRegex } from 'therr-js-utilities/constants';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import RNFB from 'rn-fetch-blob';
import Toast from 'react-native-toast-message';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildSettingsFormStyles } from '../../styles/forms/settingsForm';
import SquareInput from '../../components/Input/Square';
import PasswordRequirements from '../../components/Input/PasswordRequirements';
import BaseStatusBar from '../../components/BaseStatusBar';
import UserImage from '../../components/UserContent/UserImage';
import { getImagePreviewPath } from '../../utilities/areaUtils';
import { getUserImageUri, signImageUrl } from '../../utilities/content';
import RoundTextInput from '../../components/Input/TextInput/Round';


interface ISettingsDispatchProps {
    updateUser: Function;
}

interface IStoreProps extends ISettingsDispatchProps {
    user: IUserState;
}

// Regular component props
export interface ISettingsProps extends IStoreProps {
    navigation: any;
}

interface ISettingsState {
    croppedImageDetails: any;
    inputs: any;
    isCropping: boolean;
    isNightMode: boolean;
    isSubmitting: boolean;
    passwordErrorMessage: string;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateUser: UsersActions.update,
}, dispatch);

export class Settings extends React.Component<ISettingsProps, ISettingsState> {
    private scrollViewRef;
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
            isNightMode: props.user.settings.mobileThemeName === 'retro',
            isSubmitting: false,
            passwordErrorMessage: '',
        };

        this.reloadTheme();
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount = () => {
        this.props.navigation.setOptions({
            title: this.translate('pages.settings.headerTitle'),
        });
    }

    goToManageAccount = () => {
        const { navigation } = this.props;

        navigation.push('ManageAccount');
    }

    isFormDisabled() {
        const { inputs, isSubmitting } = this.state;

        // TODO: Add message to show when passwords not equal
        // Phone number is not required for Apple users (due to stupid Apple SSO rule)
        // ...so we need to add more logic here
        return (
            (inputs.oldPassword && inputs.password !== inputs.repeatPassword) ||
            !inputs.userName ||
            !inputs.firstName ||
            !inputs.lastName ||
            isSubmitting
        );
    }

    reloadTheme = () => {
        const themeName = this.props.user.settings?.mobileThemeName;

        this.theme = buildStyles(themeName);
        this.themeMenu = buildMenuStyles(themeName);
        this.themeForms = buildFormStyles(themeName);
        this.themeSettingsForm = buildSettingsFormStyles(themeName);
    }

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
        const { isNightMode } = this.state;
        const { user } = this.props;

        if (password && !PasswordRegex.test(password)) {
            Toast.show({
                type: 'errorBig',
                text1: this.translate('pages.settings.alertTitles.insecurePassword'),
                text2: this.translate(
                    'forms.settings.errorMessages.passwordInsecure'
                ),
            });
            this.scrollViewRef?.scrollToPosition(0, 0);
            return;
        }

        const updateArgs: any = {
            email: user.details.email,
            phoneNumber: user.details.phoneNumber || phoneNumber,
            firstName,
            lastName,
            userName: userName?.toLowerCase(),
            settingsBio,
            settingsThemeName: isNightMode ? 'retro' : 'light',
            shouldHideMatureContent,
        };

        if (oldPassword && password === repeatPassword) {
            updateArgs.password = password;
            updateArgs.oldPassword = oldPassword;
        }

        if (!this.isFormDisabled()) {
            this.setState({
                isSubmitting: true,
            });
            this.requestUserUpdate(user, updateArgs).finally(() => {
                this.setState({
                    isSubmitting: false,
                });
            });
        }
    };

    requestUserUpdate = (user, updateArgs) => this.props
        .updateUser(user.details.id, updateArgs)
        .then(() => {
            Toast.show({
                type: 'success',
                text1: this.translate('pages.settings.alertTitles.accountUpdated'),
                text2: this.translate('pages.settings.alertMessages.accountUpdated'),
                visibilityTime: 2000,
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
                Toast.show({
                    type: 'errorBig',
                    text1: this.translate('forms.settings.alertTitles.backendErrorMessage'),
                    text2: `${error.message}${
                        error.parameters
                            ? '(' + error.parameters.toString() + ')'
                            : ''
                    }`,
                });
            } else if (error.statusCode >= 500) {
                Toast.show({
                    type: 'errorBig',
                    text1: this.translate('forms.settings.alertTitles.backendErrorMessage'),
                    text2: this.translate('forms.settings.backendErrorMessage'),
                });
            }
        })
        .finally(() => {
            this.scrollViewRef?.scrollToPosition(0, 0);
        });

    onInputChange = (name: string, value: string) => {
        let passwordErrorMessage = '';
        const { inputs } = this.state;
        const newInputChanges = {
            [name]: value,
        };

        if (name === 'repeatPassword' && inputs.oldPassword) {
            if (inputs.password !== newInputChanges.repeatPassword) {
                passwordErrorMessage = this.translate('forms.settings.errorMessages.repeatPassword');
            }
        }

        if (name === 'password' && inputs.repeatPassword) {
            if (inputs.repeatPassword !== newInputChanges.password) {
                passwordErrorMessage = this.translate('forms.settings.errorMessages.repeatPassword');
            }
        }

        this.setState({
            inputs: {
                ...inputs,
                ...newInputChanges,
            },
            isSubmitting: false,
            passwordErrorMessage,
        });
    };

    onThemeChange = (isNightMode: boolean) => {
        this.setState({
            isNightMode,
        });
    }

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
    }

    signAndUploadImage = (croppedImageDetails) => {
        const filePathSplit = croppedImageDetails?.path?.split('.');
        const fileExtension = filePathSplit ? `${filePathSplit[filePathSplit.length - 1]}` : 'jpeg';
        return signImageUrl(true, {
            action: 'write',
            filename: `profile/user_profile.${fileExtension}`,
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
    }

    handleRefresh = () => {
        console.log('refresh');
    }

    render() {
        const { navigation, user } = this.props;
        const { croppedImageDetails, inputs, isNightMode, passwordErrorMessage } = this.state;
        const pageHeaderUser = this.translate('pages.settings.pageHeaderUser');
        const pageHeaderPassword = this.translate('pages.settings.pageHeaderPassword');
        const pageHeaderDisplaySettings = this.translate('pages.settings.pageHeaderDisplaySettings');
        const pageHeaderSettings = this.translate('pages.settings.pageHeaderSettings');
        const pageHeaderAdvancedSettings = this.translate('pages.settings.pageHeaderAdvancedSettings');
        const currentUserImageUri = getUserImageUri(user, 200);
        const userImageUri = getImagePreviewPath(croppedImageDetails.path) || currentUserImageUri;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={this.theme.styles.scrollView}
                    >
                        <View style={this.theme.styles.body}>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {pageHeaderDisplaySettings}
                                </Text>
                            </View>
                            <View style={this.themeSettingsForm.styles.settingsContainer}>
                                <View style={this.themeForms.styles.switchContainer}>
                                    <Text
                                        style={this.themeForms.styles.switchLabel}
                                    >
                                        {this.translate('pages.settings.labels.nightMode')}
                                    </Text>
                                    <View
                                        style={this.themeForms.styles.switchSubContainer}
                                    >
                                        <Switch
                                            style={this.themeForms.styles.switchButton}
                                            trackColor={{ false: this.theme.colors.primary2, true: this.theme.colors.primary4 }}
                                            thumbColor={isNightMode ? this.theme.colors.primary3 : this.theme.colorVariations.primary3Fade}
                                            ios_backgroundColor={this.theme.colors.primary4}
                                            onValueChange={this.onThemeChange}
                                            value={isNightMode}
                                        />
                                        <FontAwesomeIcon
                                            name="moon"
                                            size={22}
                                            color={this.theme.colorVariations.primary3Fade}
                                        />
                                    </View>
                                </View>
                            </View>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {pageHeaderUser}
                                </Text>
                            </View>
                            <View style={this.themeSettingsForm.styles.userContainer}>
                                <UserImage
                                    onImageReady={this.onDoneCropping}
                                    theme={this.theme}
                                    themeForms={this.themeForms}
                                    userImageUri={userImageUri}
                                />
                                <SquareInput
                                    label={this.translate(
                                        'forms.settings.labels.userName'
                                    )}
                                    labelStyle={this.themeForms.styles.inputLabelLightFaded}
                                    value={inputs.userName}
                                    onChangeText={(text) =>
                                        this.onInputChange('userName', text)
                                    }
                                    rightIcon={
                                        <FontAwesomeIcon
                                            name="user"
                                            size={22}
                                            color={this.theme.colorVariations.primary3Fade}
                                        />
                                    }
                                    themeForms={this.themeForms}
                                />
                                <SquareInput
                                    label={this.translate(
                                        'forms.settings.labels.firstName'
                                    )}
                                    labelStyle={this.themeForms.styles.inputLabelLightFaded}
                                    value={inputs.firstName}
                                    onChangeText={(text) =>
                                        this.onInputChange('firstName', text)
                                    }
                                    rightIcon={
                                        <FontAwesomeIcon
                                            name="smile"
                                            size={22}
                                            color={this.theme.colorVariations.primary3Fade}
                                        />
                                    }
                                    themeForms={this.themeForms}
                                />
                                <SquareInput
                                    label={this.translate(
                                        'forms.settings.labels.lastName'
                                    )}
                                    labelStyle={this.themeForms.styles.inputLabelLightFaded}
                                    value={inputs.lastName}
                                    onChangeText={(text) =>
                                        this.onInputChange('lastName', text)
                                    }
                                    rightIcon={
                                        <FontAwesomeIcon
                                            name="smile-beam"
                                            size={22}
                                            color={this.theme.colorVariations.primary3Fade}
                                        />
                                    }
                                    themeForms={this.themeForms}
                                />
                                <SquareInput
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
                                <SquareInput
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
                                    maxLength={80}
                                />
                                <Text style={{ textAlign: 'right' }}>{`${inputs.settingsBio?.length}/80`}</Text>
                            </View>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {pageHeaderSettings}
                                </Text>
                            </View>
                            <View style={this.themeSettingsForm.styles.settingsContainer}>
                                <ReactPicker
                                    selectedValue={inputs.shouldHideMatureContent}
                                    style={this.themeForms.styles.picker}
                                    itemStyle={this.themeForms.styles.pickerItem}
                                    onValueChange={(itemValue) =>
                                        this.onInputChange('shouldHideMatureContent', itemValue)
                                    }>
                                    <ReactPicker.Item label={this.translate(
                                        'forms.settings.labels.hideReportedContent'
                                    )} value={true} />
                                    <ReactPicker.Item label={this.translate(
                                        'forms.settings.labels.showReportedContent'
                                    )} value={false} />
                                </ReactPicker>
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
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {pageHeaderPassword}
                                </Text>
                            </View>
                            <View style={this.themeSettingsForm.styles.passwordContainer}>
                                <PasswordRequirements translate={this.translate} password={inputs.password} themeForms={this.themeForms} />
                                <SquareInput
                                    placeholder={this.translate(
                                        'forms.settings.labels.password'
                                    )}
                                    placeholderTextColor={this.themeForms.styles.placeholderText.color}
                                    value={inputs.oldPassword}
                                    onChangeText={(text) =>
                                        this.onInputChange('oldPassword', text)
                                    }
                                    secureTextEntry={true}
                                    rightIcon={
                                        <MaterialIcon
                                            name="vpn-key"
                                            size={26}
                                            color={this.theme.colorVariations.primary3Fade}
                                        />
                                    }
                                    themeForms={this.themeForms}
                                />
                                <SquareInput
                                    placeholder={this.translate(
                                        'forms.settings.labels.newPassword'
                                    )}
                                    placeholderTextColor={this.themeForms.styles.placeholderText.color}
                                    value={inputs.password}
                                    onChangeText={(text) =>
                                        this.onInputChange('password', text)
                                    }
                                    secureTextEntry={true}
                                    rightIcon={
                                        <MaterialIcon
                                            name="lock"
                                            size={26}
                                            color={this.theme.colorVariations.primary3Fade}
                                        />
                                    }
                                    themeForms={this.themeForms}
                                />
                                <SquareInput
                                    placeholder={this.translate(
                                        'forms.settings.labels.repeatPassword'
                                    )}
                                    placeholderTextColor={this.themeForms.styles.placeholderText.color}
                                    value={inputs.repeatPassword}
                                    onChangeText={(text) =>
                                        this.onInputChange('repeatPassword', text)
                                    }
                                    secureTextEntry={true}
                                    errorMessage={passwordErrorMessage}
                                    rightIcon={
                                        <MaterialIcon
                                            name="lock"
                                            size={26}
                                            color={this.theme.colorVariations.primary3Fade}
                                        />
                                    }
                                    themeForms={this.themeForms}
                                />
                            </View>
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
                <View style={this.themeMenu.styles.submitButtonContainerFloat}>
                    <Button
                        buttonStyle={this.themeForms.styles.button}
                        title={this.translate(
                            'forms.settings.buttons.submit'
                        )}
                        onPress={this.onSubmit}
                        disabled={this.isFormDisabled()}
                        raised={true}
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
