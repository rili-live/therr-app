import React from 'react';
import { SafeAreaView, View, Text, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Content } from 'therr-js-utilities/constants';
import { IUserState } from 'therr-react/types';
import LottieView from 'lottie-react-native';
import RNFB from 'rn-fetch-blob';
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
import ImageCropView from '../components/ImageCropView';
import { getImagePreviewPath } from '../utilities/areaUtils';
import { signImageUrl } from '../utilities/content';

const profileLoader = require('../assets/profile-circling.json');
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
    imageDetails: any;
    inputs: any;
    isCropping: boolean;
    isPhoneNumberValid: boolean;
    isSubmitting: boolean;
    profPicLocalFilepath: string;
    stage: StageType;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateUser: UsersActions.update,
}, dispatch);

export class CreateProfile extends React.Component<ICreateProfileProps, ICreateProfileState> {
    private cropViewRef;
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
            imageDetails: {},
            inputs: {
                email: props.user.details.email,
                firstName: Platform.OS === 'ios' ? (props.user.details.firstName || DEFAULT_FIRSTNAME) : props.user.details.firstName,
                lastName: Platform.OS === 'ios' ? (props.user.details.lastName || DEFAULT_LASTNAME) : props.user.details.lastName,
                userName: props.user.details.userName,
                phoneNumber: props.user.details.phoneNumber,
            },
            isCropping: false,
            isPhoneNumberValid: false,
            isSubmitting: false,
            profPicLocalFilepath: '',
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
        this.props.navigation.setOptions({
            title: this.translate('pages.createProfile.headerTitle'),
        });
    }

    isFormADisabled() {
        const { inputs, isSubmitting } = this.state;

        return (
            !inputs.firstName ||
            !inputs.lastName ||
            !inputs.userName ||
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

    onCropAction = (name) => {
        if (name === 'rotate') {
            this.cropViewRef?.rotateImage(true);
        } else if (name === 'cancel') {
            this.setState({
                isCropping: false,
            });
        } else if (name === 'done') {
            const imageQualityPercent = 75;
            this.cropViewRef?.saveImage(true, imageQualityPercent);
        }
    }

    onDoneCropping = (croppedImageDetails) => {
        console.log('cropped', croppedImageDetails);
        this.setState({
            croppedImageDetails,
            isCropping: false,
        });
    }

    onImageSelect = (imageResponse) => {
        let profPicLocalFilepath = Platform.OS === 'ios' ? imageResponse.uri?.replace('file:///', '') : imageResponse.uri;

        if (!imageResponse.didCancel && !imageResponse.errorCode) {
            this.setState({
                imageDetails: imageResponse,
                isCropping: true,
                profPicLocalFilepath,
            });
        }
    }

    signAndUploadImage = (croppedImageDetails) => {
        const filePathSplit = croppedImageDetails?.uri?.split('.');
        const fileExtension = filePathSplit ? `${filePathSplit[filePathSplit.length - 1]}` : 'jpeg';
        return signImageUrl(true, {
            action: 'write',
            filename: `profile/user_profile.${fileExtension}`,
        }).then((response) => {
            const signedUrl = response?.data?.url && response?.data?.url[0];

            const localFileCroppedPath = Platform.OS === 'ios'
                ? croppedImageDetails?.uri.replace('file:///', '').replace('file:/', '')
                : croppedImageDetails?.uri;

            // Upload to Google Cloud
            // TODO: Abstract and add nudity filter sightengine.com
            return RNFB.fetch(
                'PUT',
                signedUrl,
                {
                    'Content-Type': `image/${fileExtension}`,
                    'Content-Disposition': 'inline',
                },
                RNFB.wrap(localFileCroppedPath),
            ).then(() => response?.data);
        });
    }

    onSubmit = (stage: StageType) => {
        const { croppedImageDetails, isPhoneNumberValid } = this.state;
        const {
            firstName,
            lastName,
            userName,
            phoneNumber,
        } = this.state.inputs;
        const { user } = this.props;

        const updateArgs: any = {
            email: user.details.email,
            phoneNumber: user.details.phoneNumber || phoneNumber,
            firstName,
            lastName,
            userName: userName?.toLowerCase(),
        };

        if (stage === 'B' && !isPhoneNumberValid) {
            this.setState({
                errorMsg: this.translate('forms.createConnection.errorMessages.invalidPhoneNumber'),
            });
            return;
        }

        const isDisable = (stage === 'A' && this.isFormADisabled()) || (stage === 'B' && this.isFormBDisabled());

        if (!isDisable) {
            this.setState({
                isSubmitting: true,
            });
            (croppedImageDetails?.uri ? this.signAndUploadImage(croppedImageDetails) : Promise.resolve({})).then((imageUploadResponse) => {
                if (imageUploadResponse.path) {
                    updateArgs.media = {
                        profilePicture: {
                            altText: `${firstName} ${lastName}`,
                            type: Content.mediaTypes.USER_IMAGE_PUBLIC,
                            path: imageUploadResponse.path,
                        },
                    };
                }

                this.props
                    .updateUser(user.details.id, updateArgs)
                    .then(() => {
                        if (stage === 'A') {
                            this.setState({
                                stage: 'C',
                            });
                        } else if (stage === 'C') {
                            this.setState({
                                stage: 'B',
                            });
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
            });
        }
    };

    onInputChange = (name: string, value: string) => {
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
        const { navigation, user } = this.props;
        const { croppedImageDetails, errorMsg, inputs, isCropping, isSubmitting, profPicLocalFilepath, stage } = this.state;
        const pageHeaderA = this.translate('pages.createProfile.pageHeaderA');
        const pageHeaderB = this.translate('pages.createProfile.pageHeaderB');
        const pageHeaderC = this.translate('pages.createProfile.pageHeaderC');
        const profPicUri = getImagePreviewPath(croppedImageDetails.uri) || `https://robohash.org/${user.settings?.id}?size=200x200`;

        return (
            <>
                <BaseStatusBar />
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
                                    <Text style={this.themeFTUI.styles.title}>
                                        {pageHeaderA}
                                    </Text>
                                }
                                {
                                    stage === 'B' &&
                                    <Text style={this.themeFTUI.styles.title}>
                                        {pageHeaderB}
                                    </Text>
                                }
                                {
                                    stage === 'C' &&
                                    <Text style={this.themeFTUI.styles.title}>
                                        {pageHeaderC}
                                    </Text>
                                }
                            </View>
                            {
                                (stage === 'A' || stage === 'B') &&
                                <View style={[this.theme.styles.sectionContainer, { height: 100, marginBottom: 20 }]}>
                                    { stage === 'A' &&
                                        <LottieView
                                            source={profileLoader}
                                            style={this.themeFTUI.styles.formAGraphic}
                                            resizeMode="cover"
                                            speed={1.75}
                                            autoPlay
                                            loop
                                        />
                                    }
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
                                    onSubmit={() => this.onSubmit(stage)}
                                    translate={this.translate}
                                    themeAlerts={this.themeAlerts}
                                    themeForms={this.themeForms}
                                    themeSettingsForm={this.themeSettingsForm}
                                />
                            }
                            {
                                stage === 'B' &&
                                <CreateProfileStageB
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
                                    errorMsg={errorMsg}
                                    isDisabled={isSubmitting}
                                    onImageSelect={this.onImageSelect}
                                    onInputChange={this.onPhoneInputChange}
                                    onSubmit={() => this.onSubmit(stage)}
                                    translate={this.translate}
                                    theme={this.theme}
                                    themeAlerts={this.themeAlerts}
                                    themeForms={this.themeForms}
                                    themeSettingsForm={this.themeSettingsForm}
                                    userImageUri={profPicUri}
                                />
                            }
                        </View>
                        <ImageCropView
                            isHidden={!isCropping}
                            onImageCrop={this.onDoneCropping}
                            onActionButtonPress={this.onCropAction}
                            componentRef={(ref) => this.cropViewRef = ref}
                            imageUrl={profPicLocalFilepath}
                            navigation={navigation}
                            theme={this.theme}
                            themeMenu={this.themeMenu}
                            translate={this.translate}
                            user={user}
                        />
                    </KeyboardAwareScrollView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(CreateProfile);
