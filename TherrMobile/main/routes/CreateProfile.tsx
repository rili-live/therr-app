import React from 'react';
import { SafeAreaView, View, Text, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Content } from 'therr-js-utilities/constants';
import { IUserState } from 'therr-react/types';
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
import CreateProfileStageA from '../components/0_First_Time_UI/CreateProfileStageA';
import CreateProfileStageB from '../components/0_First_Time_UI/CreateProfileStageB';
import CreateProfileStageC from '../components/0_First_Time_UI/CreateProfileStageC';
import BaseStatusBar from '../components/BaseStatusBar';
import { DEFAULT_FIRSTNAME, DEFAULT_LASTNAME } from '../constants';
import { getImagePreviewPath } from '../utilities/areaUtils';
import { getUserImageUri } from '../utilities/content';

const verifyPhoneLoader = require('../assets/verify-phone-shield.json');

interface ICreateProfileDispatchProps {
    updateUser: Function;
}

interface IStoreProps extends ICreateProfileDispatchProps {
    user: IUserState;
}

// Regular component props
export interface ICreateProfileProps extends IStoreProps {
    navigation: any;
}

type StageType = 'A' | 'B' | 'C';

interface ICreateProfileState {
    croppedImageDetails: any;
    errorMsg: string;
    inputs: any;
    isPhoneNumberValid: boolean;
    isSubmitting: boolean;
    stage: StageType;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateUser: UsersActions.update,
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
                email: props.user.details.email,
                firstName: Platform.OS === 'ios' ? (props.user.details.firstName || DEFAULT_FIRSTNAME) : props.user.details.firstName,
                lastName: Platform.OS === 'ios' ? (props.user.details.lastName || DEFAULT_LASTNAME) : props.user.details.lastName,
                userName: props.user.details.userName,
                phoneNumber: props.user.details.phoneNumber,
            },
            isPhoneNumberValid: false,
            isSubmitting: false,
            stage: props.route?.params?.stage || 'A',
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
    }

    isFormADisabled() {
        const { inputs, isSubmitting } = this.state;

        return (
            !inputs.firstName ||
            !inputs.lastName ||
            !inputs.userName ||
            inputs.userName?.length < 3 ||
            isSubmitting
        );
    }

    isFormBDisabled() {
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
            stage: 'B',
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

        if (stage === 'B' && !isPhoneNumberValid) {
            this.setState({
                errorMsg: this.translate('forms.createConnection.errorMessages.invalidPhoneNumber'),
            });
            return;
        }

        const isDisabled = (stage === 'A' && this.isFormADisabled()) || (stage === 'B' && this.isFormBDisabled());

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
                        if (stage === 'A') {
                            this.setState({
                                stage: 'C',
                            });
                        } else if (stage === 'C') {
                            this.setState({
                                stage: 'B',
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
        const { croppedImageDetails, errorMsg, inputs, isSubmitting, stage } = this.state;
        const pageHeaderA = this.translate('pages.createProfile.pageHeaderA');
        const pageSubHeaderA = this.translate('pages.createProfile.pageSubHeaderA');
        const pageHeaderB = this.translate('pages.createProfile.pageHeaderB');
        const pageSubHeaderB = this.translate('pages.createProfile.pageSubHeaderB');
        const pageHeaderC = this.translate('pages.createProfile.pageHeaderC');
        const pageSubHeaderC = this.translate('pages.createProfile.pageSubHeaderC');
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
                                    stage === 'A' &&
                                    <>
                                        <Text style={this.themeFTUI.styles.title}>
                                            {pageHeaderA}
                                        </Text>
                                        <Text style={this.themeFTUI.styles.subtitleCenter}>
                                            {pageSubHeaderA}
                                        </Text>
                                    </>
                                }
                                {
                                    stage === 'B' &&
                                    <>
                                        <Text style={this.themeFTUI.styles.title}>
                                            {pageHeaderB}
                                        </Text>
                                        <Text style={this.themeFTUI.styles.subtitleCenter}>
                                            {pageSubHeaderB}
                                        </Text>
                                    </>
                                }
                                {
                                    stage === 'C' &&
                                    <>
                                        <Text style={this.themeFTUI.styles.title}>
                                            {pageHeaderC}
                                        </Text>
                                        <Text style={this.themeFTUI.styles.subtitleCenter}>
                                            {pageSubHeaderC}
                                        </Text>
                                    </>
                                }
                            </View>
                            {
                                (stage === 'A' || stage === 'B') &&
                                <View style={[this.theme.styles.sectionContainer, { height: 50, marginBottom: 20 }]}>
                                    { stage === 'B' &&
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
                                stage === 'A' &&
                                <CreateProfileStageA
                                    errorMsg={errorMsg}
                                    inputs={inputs}
                                    isFormDisabled={this.isFormADisabled()}
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
                                stage === 'B' &&
                                <CreateProfileStageB
                                    user={user}
                                    errorMsg={errorMsg}
                                    isFormDisabled={this.isFormBDisabled()}
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
                                stage === 'C' &&
                                <CreateProfileStageC
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
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(CreateProfile);
