import React from 'react';
import { Share, View, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import {
    BrandVariations, Content, ErrorCodes, getPhoneAccountType,
} from 'therr-js-utilities/constants';
import { sanitizeUserName } from 'therr-js-utilities/sanitizers';
import { IUserState } from 'therr-react/types';
import { UsersService } from 'therr-react/services';
import LottieView from 'lottie-react-native';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../utilities/translator';
import { buildInviteUrl } from '../../utilities/shareUrls';
import { buildStyles } from '../../styles';
import { buildStyles as buildAlertStyles } from '../../styles/alerts';
import { buildStyles as buildFTUIStyles } from '../../styles/first-time-ui';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildSettingsFormStyles } from '../../styles/forms/settingsForm';
import CreateProfileDetails from '../../components/0_First_Time_UI/onboarding-stages/CreateProfileDetails';
import CreateProfilePhoneVerify from '../../components/0_First_Time_UI/onboarding-stages/CreateProfilePhoneVerify';
import CreateProfilePicture from '../../components/0_First_Time_UI/onboarding-stages/CreateProfilePicture';
import CreateProfileInterests from '../../components/0_First_Time_UI/onboarding-stages/CreateProfileInterests';
import InviteFriends from '../../components/0_First_Time_UI/onboarding-stages/InviteFriends';
import SyncContacts from '../../components/0_First_Time_UI/onboarding-stages/SyncContacts';
import StageProgressBar from '../../components/0_First_Time_UI/StageProgressBar';
import BaseStatusBar from '../../components/BaseStatusBar';
import { DEFAULT_FIRSTNAME, DEFAULT_LASTNAME } from '../../constants';
import { getImagePreviewPath } from '../../utilities/areaUtils';
import { getUserImageUri } from '../../utilities/content';
import { synceMobileContacts } from '../../utilities/contacts';
import { markContactsSkipped, markContactsSynced, markInterestsSelected } from '../../utilities/profileCompletion';
import { CURRENT_BRAND_VARIATION } from '../../config/brandConfig';

const verifyPhoneLoader = require('../../assets/verify-phone-shield.json');

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
    route?: any;
}

type StageType = 'details' | 'picture' | 'phone' | 'interests' | 'contacts' | 'invite';

/**
 * Order the guided flow walks through. Also drives the progress bar, so the
 * user always sees how much of the profile is left. `invite` is a closing
 * flourish rather than a profile field, so it is excluded from the count.
 */
const STAGE_ORDER: StageType[] = ['details', 'interests', 'picture', 'phone', 'contacts'];

/**
 * Order the back arrow walks, which is STAGE_ORDER plus `invite`. Kept separate because
 * STAGE_ORDER defines the progress *denominator* and must not count the invite prompt —
 * but back from `invite` should still return to `contacts` rather than falling through to
 * navigation.goBack() and leaving the flow entirely.
 */
const STAGE_BACK_ORDER: StageType[] = [...STAGE_ORDER, 'invite'];

interface ICreateProfileState {
    croppedImageDetails: any;
    errorMsg: string;
    inputs: any;
    isLoadingInterests: boolean;
    isPhoneNumberValid: boolean;
    isSubmitting: boolean;
    isSyncingContacts: boolean;
    stage: StageType;
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
            inputs: {
                // Seeded from the account rather than defaulted, because sign-up now sets the
                // type up-front when the phone number already has an account. Leaving this
                // blank would submit `personal` on the next Save and quietly demote a creator
                // or business account into a duplicate type on that number.
                accountType: getPhoneAccountType(props.user.details),
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
            isSyncingContacts: false,
            stage: props.route?.params?.stage || 'details',
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeFTUI = buildFTUIStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        const { user } = this.props;
        this.props.navigation.setOptions({
            title: this.translate('pages.createProfile.headerTitle'),
        });
        logEvent(getAnalytics(),'profile_create_start', {
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

        // First/last name are intentionally optional during onboarding to reduce
        // friction; we prompt users to add their name later. Only a valid username
        // is required to advance. See onboarding friction review (2026-06).
        return (
            !inputs.userName ||
            inputs.userName?.length < 3 ||
            isSubmitting
        );
    }

    isFormInterestsDisabled() {
        const { isSubmitting } = this.state;

        // Whether at least one interest is selected is enforced by
        // CreateProfileInterests itself (it owns that selection state); here we
        // only block while a submit is in flight.
        return isSubmitting;
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
        const { user } = this.props;

        this.setState({
            isSubmitting: true,
        });
        this.props.updateUserInterests({
            interests,
        })
            .then(() => {
                markInterestsSelected(user.details?.id);
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
            userName,
        };

        if (CURRENT_BRAND_VARIATION !== BrandVariations.HABITS) {
            updateArgs.isBusinessAccount = accountType === 'business';
            updateArgs.isCreatorAccount = accountType === 'creator';
        }

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
                        logEvent(getAnalytics(),'profile_create_update_phone', {
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
                        } else if (stage === 'phone') {
                            this.setState({
                                stage: 'contacts',
                            });
                        }
                    }
                })
                .catch((error: any) => {
                    // The account type or phone number collides with another account on the
                    // same number. The service's message is English-only, so translate here.
                    if (error?.errorCode === ErrorCodes.TOO_MANY_ACCOUNTS) {
                        this.setState({
                            errorMsg: this.translate('alertMessages.phoneNumberAlreadyInUse'),
                        });
                    } else if (
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
                    this.scrollViewRef?.scrollTo({ x: 0, y: 0, animated: true });
                    this.setState({
                        isSubmitting: false,
                    });
                });
        }
    };

    onInputChange = (name: string, value: string) => {
        const { inputs } = this.state;
        let sanitizedValue = value;
        if (name === 'userName') {
            sanitizedValue = sanitizeUserName(value);
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

    onFinishOnboarding = () => {
        const { navigation, route } = this.props;

        // Entered from the "Finish your profile" checklist: return the user to
        // where they were rather than dumping them on the map mid-session.
        if (route?.params?.isGuidedStep && navigation.canGoBack?.()) {
            navigation.goBack();
            return;
        }

        navigation.navigate('Map');
    };

    /** Index of the current stage in the guided flow, 1-based for display. */
    getStageStepNumber = (stage: StageType) => {
        const index = STAGE_ORDER.indexOf(stage);

        // `invite` sits past the tracked stages — show the bar as full.
        return index === -1 ? STAGE_ORDER.length : index + 1;
    };

    onGoBackStage = () => {
        const { navigation } = this.props;
        const { stage } = this.state;
        const currentIndex = STAGE_BACK_ORDER.indexOf(stage);

        if (currentIndex > 0) {
            this.setState({
                errorMsg: '',
                stage: STAGE_BACK_ORDER[currentIndex - 1],
            });
            return;
        }

        // Only the first stage falls out of the flow entirely.
        if (navigation.canGoBack?.()) {
            navigation.goBack();
        }
    };

    onSkipContactsSync = () => {
        const { user } = this.props;

        markContactsSkipped(user.details?.id);
        this.advancePastContacts();
    };

    /**
     * The invite stage is a bonus prompt during first-run onboarding. When the
     * user arrived from the profile checklist, contact sync is the last tracked
     * step, so finish instead of tacking on another ask.
     */
    advancePastContacts = () => {
        const { route } = this.props;

        if (route?.params?.isGuidedStep) {
            this.onFinishOnboarding();
            return;
        }

        this.setState({
            errorMsg: '',
            stage: 'invite',
        });
    };

    onShareInviteLink = () => {
        const { user } = this.props;
        const locale = user.settings?.locale || 'en-us';
        const shareUrl = buildInviteUrl(locale, user.details.userName);
        Share.share({
            message: this.translate('forms.createConnection.shareLink.message', {
                inviteCode: user.details.userName,
                shareUrl,
            }),
            url: shareUrl,
            title: this.translate('forms.createConnection.shareLink.title'),
        }).catch((err) => console.error(err));
    };

    onSyncContacts = () => {
        const { navigation, user } = this.props;
        const storePermissions = () => {};

        this.setState({
            errorMsg: '',
            isSyncingContacts: true,
        });

        return synceMobileContacts({
            storePermissions,
            user,
        }).then((result) => {
            // Recorded before navigating so the profile checklist and the
            // people list both see the step as done on their next read.
            markContactsSynced(user.details?.id);
            navigation.navigate('PhoneContacts', {
                allContacts: result.contacts,
                matchedUsers: result.matchedUsers,
            });
        }).catch((err) => {
            console.log('Sync contacts error:', err);
            this.setState({
                errorMsg: this.translate(
                    err?.message === 'permissions-denied'
                        ? 'pages.createProfile.syncContacts.permissionsDenied'
                        : 'pages.createProfile.syncContacts.errorMessage'
                ),
            });
        }).finally(() => {
            this.setState({
                isSyncingContacts: false,
            });
        });
    };

    render() {
        const { user } = this.props;
        const {
            isLoadingInterests,
            interests,
            croppedImageDetails,
            errorMsg,
            inputs,
            isSubmitting,
            isSyncingContacts,
            stage,
        } = this.state;
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
                <SafeAreaView edges={[]}  style={this.theme.styles.safeAreaView}>
                    <StageProgressBar
                        currentStep={this.getStageStepNumber(stage)}
                        totalSteps={STAGE_ORDER.length}
                        onBack={this.onGoBackStage}
                        canGoBack={stage !== STAGE_BACK_ORDER[0]}
                        translate={this.translate as any}
                        theme={this.theme}
                    />
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
                                {
                                    stage === 'contacts' &&
                                    <>
                                        <Text style={this.themeFTUI.styles.title}>
                                            {this.translate('pages.createProfile.pageHeaderContacts')}
                                        </Text>
                                        <Text style={this.themeFTUI.styles.subtitleCenter}>
                                            {this.translate('pages.createProfile.pageSubHeaderContacts')}
                                        </Text>
                                    </>
                                }
                                {
                                    stage === 'invite' &&
                                    <>
                                        <Text style={this.themeFTUI.styles.title}>
                                            {this.translate('pages.createProfile.pageHeaderInvite')}
                                        </Text>
                                        <Text style={this.themeFTUI.styles.subtitleCenter}>
                                            {this.translate('pages.createProfile.pageSubHeaderInvite')}
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
                                    onSubmit={(selectedInterests) => this.onSubmitInterests(stage, selectedInterests)}
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
                            {
                                stage === 'contacts' &&
                                <SyncContacts
                                    isSyncing={isSyncingContacts}
                                    errorMsg={errorMsg}
                                    onSyncContacts={this.onSyncContacts}
                                    onSkip={this.onSkipContactsSync}
                                    translate={this.translate}
                                    theme={this.theme}
                                    themeForms={this.themeForms}
                                    themeSettingsForm={this.themeSettingsForm}
                                />
                            }
                            {
                                stage === 'invite' &&
                                <InviteFriends
                                    onSkip={this.onFinishOnboarding}
                                    onShareLink={this.onShareInviteLink}
                                    onSyncContacts={this.onSyncContacts}
                                    translate={this.translate}
                                    theme={this.theme}
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
