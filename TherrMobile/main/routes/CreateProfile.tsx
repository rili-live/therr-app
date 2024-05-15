import React from 'react';
import { SafeAreaView, View, Text, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Content } from 'therr-js-utilities/constants';
import { IUserState } from 'therr-react/types';
import { UsersService } from 'therr-react/services';
import LottieView from 'lottie-react-native';
import analytics from '@react-native-firebase/analytics';
import UsersActions from '../redux/actions/UsersActions';
import translator from '../services/translator';
import { buildStyles } from '../styles';
import { buildStyles as buildAlertStyles } from '../styles/alerts';
import { buildStyles as buildFTUIStyles } from '../styles/first-time-ui';
import { buildStyles as buildFormStyles } from '../styles/forms';
import { buildStyles as buildMenuStyles } from '../styles/navigation/buttonMenu';
import { buildStyles as buildSettingsFormStyles } from '../styles/forms/settingsForm';
import CreateProfileDetails from '../components/0_First_Time_UI/onboarding-stages/CreateProfileDetails';
import CreateProfilePhoneVerify from '../components/0_First_Time_UI/onboarding-stages/CreateProfilePhoneVerify';
import CreateProfilePicture from '../components/0_First_Time_UI/onboarding-stages/CreateProfilePicture';
import CreateProfileInterests from '../components/0_First_Time_UI/onboarding-stages/CreateProfileInterests';
import BaseStatusBar from '../components/BaseStatusBar';
import { DEFAULT_FIRSTNAME, DEFAULT_LASTNAME } from '../constants';
import { getImagePreviewPath } from '../utilities/areaUtils';
import { getUserImageUri } from '../utilities/content';

const verifyPhoneLoader = require('../assets/verify-phone-shield.json');

interface ICreateProfileDispatchProps {
    updateUser: Function;
    updateUserInterests: Function;
}

interface IStoreProps extends ICreateProfileDispatchProps {
    user: IUserState;
}

// Regular component props
export interface ICreateProfileProps extends IStoreProps {
    navigation: any;
}

type StageType = 'details' | 'picture' | 'phone' | 'interests';

interface ICreateProfileState {
    croppedImageDetails: any;
    errorMsg: string;
    inputs: any;
    isLoadingInterests: boolean;
    isPhoneNumberValid: boolean;
    isSubmitting: boolean;
    stage: StageType;
    hasSelectedInterests: boolean;
    interests: any;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateUser: UsersActions.update,
    updateUserInterests: UsersActions.updateUserInterests,
}, dispatch);

export class CreateProfile extends React.Component<ICreateProfileProps, ICreateProfileState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeAlerts = buildAlertStyles();
    private themeFTUI = buildFTUIStyles();
    private themeForms = buildFormStyles();
    private themeMenu = buildMenuStyles();
    private themeSettingsForm = buildSettingsFormStyles();

    constructor(props) {
        super(props);

        this.state = {
            croppedImageDetails: {},
            errorMsg: '',
            hasSelectedInterests: false,
            inputs: {
                email: props.user.details.email,
                firstName: Platform.OS === 'ios' ? (props.user.details.firstName || DEFAULT_FIRSTNAME) : props.user.details.firstName,
                lastName: Platform.OS === 'ios' ? (props.user.details.lastName || DEFAULT_LASTNAME) : props.user.details.lastName,
                userName: props.user.details.userName,
                phoneNumber: props.user.details.phoneNumber,
            },
            interests: {},
            isLoadingInterests: true,
            isPhoneNumberValid: false,
            isSubmitting: false,
            stage: props.route?.params?.stage || 'details',
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeFTUI = buildFTUIStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { user } = this.props;
        this.props.navigation.setOptions({
            title: this.translate('pages.createProfile.headerTitle'),
        });
        analytics().logEvent('profile_create_start', {
            userId: user.details.id,
        }).catch((err) => console.log(err));

        this.setState({
            isLoadingInterests: true,
        });

        UsersService.getInterests().then((response) => {
            this.setState({
                interests: response.data,
            });
        }).catch((err) => {
            console.log(err);
        }).finally(() => {
            this.setState({
                isLoadingInterests: false,
            });
        });
    }

    isFormUserDetailsDisabled() {
        const { inputs, isSubmitting } = this.state;

        return (
            !inputs.firstName ||
            !inputs.lastName ||
            !inputs.userName ||
            inputs.userName?.length < 3 ||
            isSubmitting
        );
    }

    isFormInterestsDisabled() {
        const { hasSelectedInterests, isSubmitting } = this.state;

        return (
            !hasSelectedInterests ||
            isSubmitting
        );
    }

    isFormPhoneDisabled() {
        const { inputs, isPhoneNumberValid, isSubmitting } = this.state;

        return (
            !inputs.phoneNumber ||
            !isPhoneNumberValid ||
            isSubmitting
        );
    }

    requestUserUpdate = (imageUploadResponse) => {
        const { user } = this.props;

        this.props.updateUser(user.details?.id, {
            media: {
                profilePicture: {
                    altText: `${user.details?.firstName} ${user.details?.lastName}`,
                    type: Content.mediaTypes.USER_IMAGE_PUBLIC,
                    path: imageUploadResponse.path,
                },
            },
        });
    };

    onCropComplete = (croppedImageDetails) => {
        this.setState({
            croppedImageDetails,
        });
    };

    onContinue = () => {
        this.setState({
            stage: 'phone',
        });
    };

    onSubmitInterests = (stage: StageType, interests: any) => {
        this.setState({
            isSubmitting: true,
        });
        this.props.updateUserInterests({
            interests,
        })
            .then(() => {
                this.setState({
                    stage: 'picture',
                });
            }).catch((error: any) => {
                if (
                    error.statusCode === 400 ||
                    error.statusCode === 401 ||
                    error.statusCode === 404
                ) {
                    this.setState({
                        errorMsg: `${error.message}${
                            error.parameters
                                ? '(' + error.parameters.toString() + ')'
                                : ''
                        }`,
                    });
                } else if (error.statusCode >= 500) {
                    this.setState({
                        errorMsg: this.translate('forms.settings.backendErrorMessage'),
                    });
                }
            }).finally(() => {
                this.setState({
                    isSubmitting: false,
                });
            });
    };

    onSubmit = (stage: StageType, shouldSkipAdvance: boolean = false) => {
        const { isPhoneNumberValid } = this.state;
        const {
            firstName,
            lastName,
            userName,
            phoneNumber,
            accountType,
        } = this.state.inputs;
        const { user } = this.props;

        const updateArgs: any = {
            email: user.details.email,
            phoneNumber: user.details.phoneNumber || phoneNumber,
            firstName,
            lastName,
            userName: userName?.toLowerCase(),
            isBusinessAccount: accountType === 'business',
            isCreatorAccount: accountType === 'creator',
        };

        if (stage === 'phone' && !isPhoneNumberValid) {
            this.setState({
                errorMsg: this.translate('forms.createConnection.errorMessages.invalidPhoneNumber'),
            });
            return;
        }

        const isDisabled = (stage === 'details' && this.isFormUserDetailsDisabled()) || (stage === 'phone' && this.isFormPhoneDisabled());

        if (!isDisabled) {
            this.setState({
                isSubmitting: true,
            });
            this.props
                .updateUser(user.details.id, updateArgs)
                .then(() => {
                    if (phoneNumber) {
                        analytics().logEvent('profile_create_update_phone', {
                            userId: user.details.id,
                        }).catch((err) => console.log(err));
                    }
                    if (!shouldSkipAdvance) {
                        if (stage === 'details') {
                            this.setState({
                                stage: 'interests',
                            });
                        } else if (stage === 'interests') {
                            this.setState({
                                stage: 'picture',
                            });
                        } else if (stage === 'picture') {
                            this.setState({
                                stage: 'phone',
                            });
                        }
                    }
                })
                .catch((error: any) => {
                    if (
                        error.statusCode === 400 ||
                        error.statusCode === 401 ||
                        error.statusCode === 404
                    ) {
                        this.setState({
                            errorMsg: `${error.message}${
                                error.parameters
                                    ? '(' + error.parameters.toString() + ')'
                                    : ''
                            }`,
                        });
                    } else if (error.statusCode >= 500) {
                        this.setState({
                            errorMsg: this.translate('forms.settings.backendErrorMessage'),
                        });
                    }
                })
                .finally(() => {
                    this.scrollViewRef?.scrollToPosition(0, 0);
                    this.setState({
                        isSubmitting: false,
                    });
                });
        }
    };

    onInterestsChange = () => {
        this.setState({
            hasSelectedInterests: true,
        });
    };

    onInputChange = (name: string, value: string) => {
        const { inputs } = this.state;
        let sanitizedValue = value;
        if (name === 'userName') {
            sanitizedValue = value.replace(/[^\w.]/g, '').replace(/\.\./, '.').replace(/__/, '.');
        }
        const newInputChanges = {
            [name]: sanitizedValue,
        };

        this.setState({
            inputs: {
                ...inputs,
                ...newInputChanges,
            },
            errorMsg: '',
            isSubmitting: false,
        });
    };

    onPickerChange = (name: string, value: boolean) => {
        const { inputs } = this.state;

        const newInputChanges = {
            [name]: value,
        };

        this.setState({
            inputs: {
                ...inputs,
                ...newInputChanges,
            },
            errorMsg: '',
            isSubmitting: false,
        });
    };

    onPhoneInputChange = (name: string, value: string, isValid: boolean) => {
        this.setState({
            isPhoneNumberValid: isValid,
        }, () => this.onInputChange(name, value));
    };

    render() {
        const { user } = this.props;
        const { isLoadingInterests, interests, croppedImageDetails, errorMsg, inputs, isSubmitting, stage } = this.state;
        const pageHeaderDetails = this.translate('pages.createProfile.pageHeaderDetails');
        const pageSubHeaderDetails = this.translate('pages.createProfile.pageSubHeaderDetails');
        const pageHeaderPhone = this.translate('pages.createProfile.pageHeaderPhone');
        const pageSubHeaderPhone = this.translate('pages.createProfile.pageSubHeaderPhone');
        const pageHeaderPicture = this.translate('pages.createProfile.pageHeaderPicture');
        const pageSubHeaderPicture = this.translate('pages.createProfile.pageSubHeaderPicture');
        const pageHeaderInterests = this.translate('pages.createProfile.pageHeaderInterests');
        const pageSubHeaderInterests = this.translate('pages.createProfile.pageSubHeaderInterests');
        const currentUserImageUri = getUserImageUri(user, 200);
        const userImageUri = getImagePreviewPath(croppedImageDetails.path) || currentUserImageUri;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        // style={this.theme.styles.scrollViewFull}
                        style={[this.theme.styles.bodyFlex, { padding: 0 }]}
                        contentContainerStyle={[this.theme.styles.bodyScroll, { minHeight: '100%' }]}
                    >
                        <View style={this.theme.styles.body}>
                            <View style={this.theme.styles.sectionContainer}>
                                {
                                    stage === 'details' &&
                                    <>
                                        <Text style={this.themeFTUI.styles.title}>
                                            {pageHeaderDetails}
                                        </Text>
                                        <Text style={this.themeFTUI.styles.subtitleCenter}>
                                            {pageSubHeaderDetails}
                                        </Text>
                                    </>
                                }
                                {
                                    stage === 'interests' &&
                                    <>
                                        <Text style={this.themeFTUI.styles.title}>
                                            {pageHeaderInterests}
                                        </Text>
                                        <Text style={this.themeFTUI.styles.subtitleCenter}>
                                            {pageSubHeaderInterests}
                                        </Text>
                                    </>
                                }
                                {
                                    stage === 'picture' &&
                                    <>
                                        <Text style={this.themeFTUI.styles.title}>
                                            {pageHeaderPicture}
                                        </Text>
                                        <Text style={this.themeFTUI.styles.subtitleCenter}>
                                            {pageSubHeaderPicture}
                                        </Text>
                                    </>
                                }
                                {
                                    stage === 'phone' &&
                                    <>
                                        <Text style={this.themeFTUI.styles.title}>
                                            {pageHeaderPhone}
                                        </Text>
                                        <Text style={this.themeFTUI.styles.subtitleCenter}>
                                            {pageSubHeaderPhone}
                                        </Text>
                                    </>
                                }
                            </View>
                            {
                                (stage === 'details' || stage === 'phone') &&
                                <View style={[this.theme.styles.sectionContainer, { height: 50, marginBottom: 20 }]}>
                                    { stage === 'phone' &&
                                        <LottieView
                                            source={verifyPhoneLoader}
                                            style={this.themeFTUI.styles.formBGraphic}
                                            resizeMode="contain"
                                            autoPlay
                                            loop
                                        />
                                    }
                                </View>
                            }
                            {
                                stage === 'details' &&
                                <CreateProfileDetails
                                    errorMsg={errorMsg}
                                    inputs={inputs}
                                    isFormDisabled={this.isFormUserDetailsDisabled()}
                                    onInputChange={this.onInputChange}
                                    onPickerChange={this.onPickerChange}
                                    onSubmit={(shouldSkipAdvance) => this.onSubmit(stage, shouldSkipAdvance)}
                                    translate={this.translate}
                                    theme={this.theme}
                                    themeAlerts={this.themeAlerts}
                                    themeForms={this.themeForms}
                                    themeSettingsForm={this.themeSettingsForm}
                                />
                            }
                            {
                                stage === 'interests' &&
                                <CreateProfileInterests
                                    availableInterests={interests}
                                    isLoading={isLoadingInterests}
                                    isDisabled={this.isFormInterestsDisabled()}
                                    onChange={this.onInterestsChange}
                                    onSubmit={(interests) => this.onSubmitInterests(stage, interests)}
                                    translate={this.translate}
                                    theme={this.theme}
                                    themeForms={this.themeForms}
                                    themeSettingsForm={this.themeSettingsForm}
                                    submitButtonText={this.translate(
                                        'forms.createProfile.buttons.submit'
                                    )}
                                />
                            }
                            {
                                stage === 'picture' &&
                                <CreateProfilePicture
                                    user={user}
                                    errorMsg={errorMsg}
                                    isDisabled={isSubmitting}
                                    onCropComplete={this.onCropComplete}
                                    requestUserUpdate={this.requestUserUpdate}
                                    onInputChange={this.onPhoneInputChange}
                                    onContinue={() => this.onContinue()}
                                    translate={this.translate}
                                    theme={this.theme}
                                    themeAlerts={this.themeAlerts}
                                    themeForms={this.themeForms}
                                    themeSettingsForm={this.themeSettingsForm}
                                    userImageUri={userImageUri}
                                />
                            }
                            {
                                stage === 'phone' &&
                                <CreateProfilePhoneVerify
                                    user={user}
                                    errorMsg={errorMsg}
                                    isFormDisabled={this.isFormPhoneDisabled()}
                                    onInputChange={this.onPhoneInputChange}
                                    onSubmit={() => this.onSubmit(stage)}
                                    translate={this.translate}
                                    theme={this.theme}
                                    themeAlerts={this.themeAlerts}
                                    themeForms={this.themeForms}
                                    themeSettingsForm={this.themeSettingsForm}
                                />
                            }
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(CreateProfile);
