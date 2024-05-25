import React from 'react';
import { Dimensions, Pressable, SafeAreaView, Keyboard, View } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import RNFB from 'react-native-blob-util';
// import changeNavigationBarColor from 'react-native-navigation-bar-color';
import { IUserState } from 'therr-react/types';
import { Content } from 'therr-js-utilities/constants';
import ImageCropPicker from 'react-native-image-crop-picker';
import OctIcon from 'react-native-vector-icons/Octicons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import analytics from '@react-native-firebase/analytics';
import UsersActions from '../redux/actions/UsersActions';
import DropDown from '../components/Input/DropDown';
// import Alert from '../components/Alert';
import translator from '../services/translator';
import { buildStyles, addMargins } from '../styles';
import { buildStyles as buildAlertStyles } from '../styles/alerts';
import { buildStyles as buildAccentStyles } from '../styles/layouts/accent';
import { buildStyles as buildFormStyles } from '../styles/forms';
import { buildStyles as buildAccentFormStyles } from '../styles/forms/accentEditForm';
import { buildStyles as buildModalStyles } from '../styles/modal';
import spacingStyles from '../styles/layouts/spacing';
import {
    youtubeLinkRegex,
    DEFAULT_RADIUS,
    HAPTIC_FEEDBACK_TYPE,
} from '../constants';
import Alert from '../components/Alert';
import formatHashtags from '../utilities/formatHashtags';
import RoundInput from '../components/Input/Round';
import RoundTextInput from '../components/Input/TextInput/Round';
import HashtagsContainer from '../components/UserContent/HashtagsContainer';
import BaseStatusBar from '../components/BaseStatusBar';
import { getImagePreviewPath } from '../utilities/areaUtils';
import { signImageUrl } from '../utilities/content';
import { requestOSCameraPermissions } from '../utilities/requestOSPermissions';
import BottomSheet from '../components/BottomSheet/BottomSheet';
import TherrIcon from '../components/TherrIcon';

const { width: viewportWidth } = Dimensions.get('window');

// NOTE: When updating this list, be sure to update the MarkerIcon configs to include the new value(s)
export const thoughtCategories = [
    'uncategorized',
    'music',
    'food',
    'drinks',
    'art',
    'nature',
    'travel',
    'fitness',
    'idea',
    'nightLife',
    'geocache',
    'seasonal',
    'warning',
    // 'sports',
];


const hapticFeedbackOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};

interface IEditThoughtDispatchProps {
    createThought: Function;
    updateThought: Function;
}

interface IStoreProps extends IEditThoughtDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IEditThoughtProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IEditThoughtState {
    errorMsg: string;
    successMsg: string;
    hashtags: string[];
    isImageBottomSheetVisible: boolean;
    isVisibilityBottomSheetVisible: boolean;
    inputs: any;
    isSubmitting: boolean;
    previewLinkId?: string;
    previewStyleState: any;
    imagePreviewPath: string;
    selectedImage?: any;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createThought: UsersActions.createThought,
    updateThought: UsersActions.updateThought,
}, dispatch);

export class EditThought extends React.Component<IEditThoughtProps, IEditThoughtState> {
    private categoryOptions: any[];
    private scrollViewRef;
    private translate: Function;
    private unsubscribeNavListener;
    private theme = buildStyles();
    private themeAlerts = buildAlertStyles();
    private themeAccentLayout = buildAccentStyles();
    private themeModal = buildModalStyles();
    private themeForms = buildFormStyles();
    private themeAccentForms = buildAccentFormStyles();

    constructor(props) {
        super(props);

        const { route } = props;
        const { area, imageDetails } = route.params || {};

        this.state = {
            errorMsg: '',
            successMsg: '',
            hashtags: [],
            inputs: {
                isDraft: false,
                isPublic: area?.isPublic || true,
                radius: area?.radius || DEFAULT_RADIUS,
                category: area?.category || '',
                message: area?.message || '',
                notificationMsg: area?.notificationMsg || '',
                hashTags: area?.hashtags || '',
                maxViews: area?.maxViews,
            },
            isImageBottomSheetVisible: false,
            isVisibilityBottomSheetVisible: false,
            isSubmitting: false,
            previewStyleState: {},
            selectedImage: imageDetails || {},
            imagePreviewPath: getImagePreviewPath(imageDetails?.path),
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeAccentLayout = buildAccentStyles(props.user.settings?.mobileThemeName);
        this.themeAlerts = buildAlertStyles(props.user.settings?.mobileThemeName);
        this.themeModal = buildModalStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeAccentForms = buildAccentFormStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) => translator('en-us', key, params);
        this.categoryOptions = thoughtCategories.map((category, index) => ({
            id: index,
            label: this.translate(`forms.editThought.categories.${category}`),
            value: category,
        }));
        // changeNavigationBarColor(therrTheme.colors.accent1, false, true);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.editThought.headerTitle'),
        });

        this.unsubscribeNavListener = navigation.addListener('beforeRemove', () => {
            // changeNavigationBarColor(therrTheme.colors.primary, false, true);
        });
    }

    componentWillUnmount() {
        this.unsubscribeNavListener();
    }

    isFormDisabled() {
        const { inputs, isSubmitting } = this.state;

        return (
            !inputs.message ||
            isSubmitting
        );
    }

    signAndUploadImage = (createArgs) => {
        const { selectedImage } = this.state;
        const {
            message,
            notificationMsg,
            isPublic,
        } = this.state.inputs;
        const {
            route,
        } = this.props;
        const {
        } = route.params;
        const imageDetails = selectedImage;
        const filePathSplit = imageDetails?.path?.split('.');
        const fileExtension = filePathSplit ? `${filePathSplit[filePathSplit.length - 1]}` : 'jpeg';

        // TODO: This is too slow
        // Use public method for public spaces
        return signImageUrl(isPublic, {
            action: 'write',
            filename: `content/${(notificationMsg || message.substring(0, 20)).replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`,
        }).then((response) => {
            const signedUrl = response?.data?.url && response?.data?.url[0];
            createArgs.media = [{}];
            createArgs.media[0].type = isPublic ? Content.mediaTypes.USER_IMAGE_PUBLIC : Content.mediaTypes.USER_IMAGE_PRIVATE;
            createArgs.media[0].path = response?.data?.path;

            const localFileCroppedPath = `${imageDetails?.path}`;

            // Upload to Google Cloud
            // TODO: Abstract and add nudity filter sightengine.com
            return RNFB.fetch(
                'PUT',
                signedUrl,
                {
                    'Content-Type': imageDetails.mime,
                    'Content-Length': imageDetails.size.toString(),
                    'Content-Disposition': 'inline',
                },
                RNFB.wrap(localFileCroppedPath),
            ).then(() => createArgs);
        });
    };

    onSubmit = (e, isDraft = false) => {
        e.preventDefault();
        const { hashtags } = this.state;
        const {
            category,
            message,
            maxViews,
            expiresAt,
            isPublic,
        } = this.state.inputs;
        const {
            route,
            user,
        } = this.props;

        const createArgs: any = {
            category,
            fromUserId: user.details.id,
            isPublic,
            message,
            hashTags: hashtags.join(','),
            isDraft,
            maxViews,
            expiresAt,
        };

        if (!this.isFormDisabled()) {
            ReactNativeHapticFeedback.trigger(HAPTIC_FEEDBACK_TYPE, hapticFeedbackOptions);

            this.setState({
                isSubmitting: true,
            });

            const createOrUpdatePromise = route.params?.thought?.id
                ? this.props.updateThought(route.params?.thought.id, createArgs, !isDraft) // isCompletedDraft (when id and saving finalized)
                : this.props.createThought(createArgs);

            createOrUpdatePromise
                .then(() => {
                    this.setState({
                        successMsg: this.translate('forms.editThought.backendSuccessMessage'),
                    });

                    analytics().logEvent('thought_create', {
                        userId: user.details.id,
                        isDraft,
                        isPublic,
                        category,
                    }).catch((err) => console.log(err));

                    setTimeout(() => {
                        this.props.navigation.navigate('Areas');
                    }, 500);
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
                            errorMsg: this.translate('forms.editThought.backendErrorMessage'),
                        });
                    }
                })
                .finally(() => {
                    Keyboard.dismiss();
                    this.scrollViewRef.scrollToEnd({ animated: true });
                });
        }
    };

    onInputChange = (name: string, value: string) => {
        const { hashtags } = this.state;
        let modifiedHashtags = [ ...hashtags ];
        let modifiedValue = value;
        const newInputChanges = {
            [name]: modifiedValue,
        };

        if (name === 'hashTags') {
            const { formattedValue, formattedHashtags } = formatHashtags(value, modifiedHashtags);

            modifiedHashtags = formattedHashtags;
            newInputChanges[name] = formattedValue;
        }

        if (name === 'message') {
            const match = value.match(youtubeLinkRegex);
            const previewLinkId = (match && match[1]) || undefined;
            this.setState({
                previewLinkId,
            });
        }

        this.setState({
            hashtags: modifiedHashtags,
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            errorMsg: '',
            successMsg: '',
            isSubmitting: false,
        });
    };

    handleHashTagsBlur = () => {
        const { hashtags, inputs } = this.state;

        if (inputs.hashTags?.trim().length) {
            const { formattedValue, formattedHashtags } = formatHashtags(`${inputs.hashTags},`, [...hashtags]);

            this.setState({
                hashtags: formattedHashtags,
                inputs: {
                    ...inputs,
                    hashTags: formattedValue,
                },
            });
        }
    };

    handleImageSelect = (imageResponse) => {
        if (!imageResponse.didCancel && !imageResponse.errorCode) {
            this.setState({
                selectedImage: imageResponse,
                imagePreviewPath: getImagePreviewPath(imageResponse?.path),
            }, () => this.toggleImageBottomSheet());
        }
    };

    toggleImageBottomSheet = () => {
        const { isImageBottomSheetVisible } = this.state;
        this.setState({
            isImageBottomSheetVisible: !isImageBottomSheetVisible,
        });
    };

    toggleVisibilityBottomSheet = () => {
        const { isVisibilityBottomSheetVisible } = this.state;
        this.setState({
            isVisibilityBottomSheetVisible: !isVisibilityBottomSheetVisible,
        });
    };

    onAddImage = (action: string) => {
        // TODO: Store permissions in redux
        const storePermissions = () => {};

        return requestOSCameraPermissions(storePermissions).then((response) => {
            const permissionsDenied = Object.keys(response).some((key) => {
                return response[key] !== 'granted';
            });
            const pickerOptions: any = {
                mediaType: 'photo',
                includeBase64: false,
                height: 4 * viewportWidth,
                width: 4 * viewportWidth,
                multiple: false,
                cropping: true,
            };
            if (!permissionsDenied) {
                if (action === 'camera') {
                    return ImageCropPicker.openCamera(pickerOptions)
                        .then((cameraResponse) => this.handleImageSelect(cameraResponse));
                } else {
                    return ImageCropPicker.openPicker(pickerOptions)
                        .then((cameraResponse) => this.handleImageSelect(cameraResponse));
                }
            } else {
                throw new Error('permissions denied');
            }
        }).catch((e) => {
            this.toggleImageBottomSheet();
            // TODO: Handle Permissions denied
            if (e?.message.toLowerCase().includes('cancel')) {
                console.log('canceled');
            }
        });
    };

    onSetVisibility = (isPublic: boolean) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                isPublic,
            },
        });

        this.toggleVisibilityBottomSheet();
    };

    onSliderChange = (name, value) => {
        const newInputChanges = {
            [name]: value,
        };

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            errorMsg: '',
            successMsg: '',
            isSubmitting: false,
        });
    };

    handleHashtagPress = (tag) => {
        const { hashtags } = this.state;
        let modifiedHastags = hashtags.filter(t => t !== tag);

        this.setState({
            hashtags: modifiedHastags,
        });
    };

    handlePreviewFullScreen = (isFullScreen) => {
        const previewStyleState = isFullScreen ? {
            top: 0,
            left: 0,
            padding: 0,
            margin: 0,
            position: 'absolute',
            zIndex: 20,
        } : {};
        this.setState({
            previewStyleState,
        });
    };

    render() {
        const { navigation } = this.props;
        const {
            errorMsg,
            successMsg,
            hashtags,
            inputs,
            isImageBottomSheetVisible,
            isVisibilityBottomSheetVisible,
        } = this.state;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={[this.theme.styles.safeAreaView]}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        keyboardShouldPersistTaps="always"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={[this.theme.styles.bodyFlex, this.themeAccentLayout.styles.bodyEdit]}
                        contentContainerStyle={[
                            this.theme.styles.bodyScroll,
                            this.themeAccentLayout.styles.bodyEditScroll,
                            { backgroundColor: this.theme.colorVariations.primary2Fade },
                        ]}
                    >
                        <Pressable style={this.themeAccentLayout.styles.container} onPress={Keyboard.dismiss}>
                            <RoundTextInput
                                autoFocus
                                placeholder={this.translate(
                                    'forms.editThought.labels.message'
                                )}
                                value={inputs.message}
                                onChangeText={(text) =>
                                    this.onInputChange('message', text)
                                }
                                minHeight={150}
                                numberOfLines={7}
                                maxLength={255}
                                themeForms={this.themeForms}
                            />
                            <RoundInput
                                autoCorrect={false}
                                errorStyle={this.theme.styles.displayNone}
                                placeholder={this.translate(
                                    'forms.editThought.labels.hashTags'
                                )}
                                value={inputs.hashTags}
                                onChangeText={(text) =>
                                    this.onInputChange('hashTags', text)
                                }
                                onBlur={this.handleHashTagsBlur}
                                themeForms={this.themeForms}
                            />
                            <HashtagsContainer
                                hashtags={hashtags}
                                onHashtagPress={this.handleHashtagPress}
                                styles={this.themeForms.styles}
                            />
                            <Button
                                containerStyle={[spacingStyles.marginBotMd, spacingStyles.marginTopXLg]}
                                buttonStyle={this.themeForms.styles.buttonRoundAlt}
                                // disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                                disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                                disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                                titleStyle={this.themeForms.styles.buttonTitleAlt}
                                title={inputs.isPublic
                                    ? this.translate('forms.editThought.buttons.visibilityPublic')
                                    : this.translate('forms.editThought.buttons.visibilityPrivate')}
                                type="outline"
                                onPress={this.toggleVisibilityBottomSheet}
                                raised={false}
                            />
                            <View style={[this.themeForms.styles.input, spacingStyles.flexRow, spacingStyles.alignCenter]}>
                                <DropDown
                                    onChange={(newValue) =>
                                        this.onInputChange('category', newValue || 'uncategorized')
                                    }
                                    options={this.categoryOptions}
                                    formStyles={this.themeForms.styles}
                                />
                            </View>
                            <Alert
                                containerStyles={addMargins({
                                    marginBottom: 24,
                                })}
                                isVisible={!!(errorMsg || successMsg)}
                                message={successMsg || errorMsg}
                                type={errorMsg ? 'error' : 'success'}
                                themeAlerts={this.themeAlerts}
                            />
                            {/* <AccentInput
                                placeholder={this.translate(
                                    'forms.editThought.labels.maxViews'
                                )}
                                value={inputs.maxViews}
                                onChangeText={(text) =>
                                    this.onInputChange('maxViews', text)
                                }
                            />
                            <AccentInput
                                placeholder={this.translate(
                                    'forms.editThought.labels.expiresAt'
                                )}
                                value={inputs.expiresAt}
                                onChangeText={(text) =>
                                    this.onInputChange('expiresAt', text)
                                }
                            /> */}
                        </Pressable>
                        {/* {
                            !!previewLinkId
                            && <View style={[userContentStyles.preview, this.themeAccentForms.styles.previewContainer, previewStyleState]}>
                                <Text style={this.themeAccentForms.styles.previewHeader}>{this.translate('pages.editMoment.previewHeader')}</Text>
                                <View style={this.themeAccentForms.styles.preview}>
                                    <YoutubePlayer
                                        height={300}
                                        play={false}
                                        videoId={previewLinkId}
                                        onFullScreenChange={this.handlePreviewFullScreen}
                                    />
                                </View>
                            </View>
                        } */}
                    </KeyboardAwareScrollView>
                    <View style={this.themeAccentLayout.styles.footer}>
                        <Button
                            containerStyle={this.themeAccentForms.styles.backButtonContainer}
                            buttonStyle={this.themeAccentForms.styles.backButton}
                            onPress={() => navigation.goBack()}
                            icon={
                                <TherrIcon
                                    name="go-back"
                                    size={25}
                                    color={'black'}
                                />
                            }
                            type="clear"
                        />
                        <Button
                            buttonStyle={this.themeAccentForms.styles.submitButton}
                            disabledStyle={this.themeAccentForms.styles.submitButtonDisabled}
                            disabledTitleStyle={this.themeAccentForms.styles.submitDisabledButtonTitle}
                            titleStyle={this.themeAccentForms.styles.submitButtonTitle}
                            containerStyle={this.themeAccentForms.styles.submitButtonContainer}
                            title={this.translate(
                                'forms.editThought.buttons.submit'
                            )}
                            icon={
                                <TherrIcon
                                    name="send"
                                    size={20}
                                    color={this.isFormDisabled() ? 'grey' : 'black'}
                                    style={this.themeAccentForms.styles.submitButtonIcon}
                                />
                            }
                            onPress={(e) => this.onSubmit(e)}
                            disabled={this.isFormDisabled()}
                        />
                    </View>
                    <BottomSheet
                        isVisible={isVisibilityBottomSheetVisible}
                        onRequestClose={this.toggleVisibilityBottomSheet}
                        themeModal={this.themeModal}
                    >
                        <Button
                            containerStyle={[spacingStyles.marginBotMd, spacingStyles.fullWidth]}
                            buttonStyle={this.themeForms.styles.buttonRound}
                            // disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                            disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                            disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                            titleStyle={this.themeForms.styles.buttonTitle}
                            title={this.translate(
                                'forms.editThought.buttons.visibilityPublic'
                            )}
                            onPress={() => this.onSetVisibility(true)}
                            raised={false}
                            icon={
                                <OctIcon
                                    name="globe"
                                    size={22}
                                    style={this.themeForms.styles.buttonIcon}
                                />
                            }
                        />
                        <Button
                            containerStyle={spacingStyles.fullWidth}
                            buttonStyle={this.themeForms.styles.buttonRound}
                            // disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                            disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                            disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                            titleStyle={this.themeForms.styles.buttonTitle}
                            title={this.translate(
                                'forms.editThought.buttons.visibilityPrivate'
                            )}
                            onPress={() => this.onSetVisibility(false)}
                            raised={false}
                            icon={
                                <OctIcon
                                    name="people"
                                    size={22}
                                    style={this.themeForms.styles.buttonIcon}
                                />
                            }
                        />
                    </BottomSheet>
                    <BottomSheet
                        isVisible={isImageBottomSheetVisible}
                        onRequestClose={this.toggleImageBottomSheet}
                        themeModal={this.themeModal}
                    >
                        <Button
                            containerStyle={[spacingStyles.marginBotMd, spacingStyles.fullWidth]}
                            buttonStyle={this.themeForms.styles.buttonRound}
                            // disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                            disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                            disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                            titleStyle={this.themeForms.styles.buttonTitle}
                            title={this.translate(
                                'forms.editThought.buttons.selectExisting'
                            )}
                            onPress={() => this.onAddImage('upload')}
                            raised={false}
                            icon={
                                <OctIcon
                                    name="plus"
                                    size={22}
                                    style={this.themeForms.styles.buttonIcon}
                                />
                            }
                        />
                        <Button
                            containerStyle={spacingStyles.fullWidth}
                            buttonStyle={this.themeForms.styles.buttonRound}
                            // disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                            disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                            disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                            titleStyle={this.themeForms.styles.buttonTitle}
                            title={this.translate(
                                'forms.editThought.buttons.captureNew'
                            )}
                            onPress={() => this.onAddImage('camera')}
                            raised={false}
                            icon={
                                <OctIcon
                                    name="device-camera"
                                    size={22}
                                    style={this.themeForms.styles.buttonIcon}
                                />
                            }
                        />
                    </BottomSheet>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(EditThought);
