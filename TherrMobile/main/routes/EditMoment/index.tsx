import React from 'react';
import { Dimensions, Platform, Pressable, SafeAreaView, Keyboard, Text, View } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button } from '../../components/BaseButton';
import EditFormFooter from '../../components/EditFormFooter';
import LottieView from 'lottie-react-native';
import { Image } from '../../components/BaseImage';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import RNFB from 'react-native-blob-util';
import { showToast } from '../../utilities/toasts';
import { IUserState, IContentState } from 'therr-react/types';
import { ReactionActions, MapActions } from 'therr-react/redux/actions';
import { Categories, Content, ErrorCodes, FilePaths, PushNotifications } from 'therr-js-utilities/constants';
import ImageCropPicker from 'react-native-image-crop-picker';
import OctIcon from 'react-native-vector-icons/Octicons';
import YoutubePlayer from 'react-native-youtube-iframe';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import DropDown from '../../components/Input/DropDown';
import translator from '../../utilities/translator';
import { buildMomentUrl } from '../../utilities/shareUrls';
import { isDarkTheme } from '../../styles/themes';
import { buildStyles, addMargins } from '../../styles';
import { buildStyles as buildAlertStyles } from '../../styles/alerts';
import { buildStyles as buildAccentStyles } from '../../styles/layouts/accent';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildAccentFormStyles } from '../../styles/forms/accentEditForm';
import { buildStyles as buildMomentStyles } from '../../styles/user-content/areas/editing';
import userContentStyles from '../../styles/user-content';
import spacingStyles from '../../styles/layouts/spacing';
import {
    youtubeLinkRegex,
    DEFAULT_RADIUS,
    MIN_RADIUS_PRIVATE,
    MAX_RADIUS_PRIVATE,
    getAndroidChannel,
    AndroidChannelIds,
    HAPTIC_FEEDBACK_TYPE,
} from '../../constants';
import Alert from '../../components/Alert';
import RoundInput from '../../components/Input/Round';
import RoundTextInput from '../../components/Input/TextInput/Round';
import HashtagsContainer from '../../components/UserContent/HashtagsContainer';
import BaseStatusBar from '../../components/BaseStatusBar';
import formatHashtags from '../../utilities/formatHashtags';
import { getImagePreviewPath } from '../../utilities/areaUtils';
import { getUserContentUri, signImageUrl } from '../../utilities/content';
import { requestOSCameraPermissions } from '../../utilities/requestOSPermissions';
import { sendForegroundNotification, sendTriggerNotification } from '../../utilities/pushNotifications';
import { SheetManager } from 'react-native-actions-sheet';
import TherrIcon from '../../components/TherrIcon';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import SharePromptModal from '../../components/Modals/SharePromptModal';
import SpaceRating from '../../components/Input/SpaceRating';

const { width: viewportWidth } = Dimensions.get('window');

const hapticFeedbackOptions = {
    enableVibrateFallback: false,
    ignoreAndroidSystemSettings: false,
};

interface IEditMomentDispatchProps {
    createMoment: Function;
    updateMoment: Function;
    createOrUpdateSpaceReaction: Function;
}

interface IStoreProps extends IEditMomentDispatchProps {
    content: IContentState;
    user: IUserState;
}

// Regular component props
export interface IEditMomentProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IEditMomentState {
    areaId?: string;
    errorMsg: string;
    hashtags: string[];
    isInsufficientFundsModalVisible: boolean;
    isSharePromptVisible: boolean;
    inputs: any;
    isEditingNearbySpaces: boolean;
    isSubmitting: boolean;
    nearbySpaces: { id: string, title: string }[];
    previewLinkId?: string;
    previewStyleState: any;
    imagePreviewPath: string;
    selectedImage?: any;
}

const mapStateToProps = (state) => ({
    content: state.content,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createMoment: MapActions.createMoment,
    updateMoment: MapActions.updateMoment,
    createOrUpdateSpaceReaction: ReactionActions.createOrUpdateSpaceReaction,
}, dispatch);

export class EditMoment extends React.Component<IEditMomentProps, IEditMomentState> {
    private categoryOptions: any[];
    private nearbySpaceOptions: any[];
    private scrollViewRef;
    private translate: Function;
    private unsubscribeNavListener;
    private theme = buildStyles();
    private themeAlerts = buildAlertStyles();
    private themeAccentLayout = buildAccentStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeButtons = buildButtonStyles();
    private themeMoments = buildMomentStyles();
    private themeForms = buildFormStyles();
    private themeAccentForms = buildAccentFormStyles();

    constructor(props) {
        super(props);

        const { content, route } = props;
        const { area, nearbySpaces, imageDetails } = route.params;
        const initialMediaId = area?.mediaIds?.split(',')[0] || undefined;
        const areaMedia = area?.medias?.[0];

        let imagePreviewPath = imageDetails?.path
            ? getImagePreviewPath(imageDetails?.path)
            : (initialMediaId && content?.media[initialMediaId] || '');

        if (!imagePreviewPath && areaMedia) {
            imagePreviewPath = getUserContentUri(areaMedia);
        }

        this.state = {
            areaId: area?.id,
            errorMsg: '',
            hashtags: area?.hashTags ? area?.hashTags?.split(',') : [],
            inputs: {
                isDraft: false,
                isPublic: area?.isPublic == null ? true : area?.isPublic,
                radius: area?.radius || DEFAULT_RADIUS,
                category: area?.category || '',
                message: area?.message || '',
                notificationMsg: area?.notificationMsg || '',
                hashTags: '',
                maxViews: area?.maxViews,
                spaceId: area?.spaceId && nearbySpaces.find(s => s.id === area?.spaceId) ? area?.spaceId : undefined,
            },
            isEditingNearbySpaces: false,
            isInsufficientFundsModalVisible: false,
            isSharePromptVisible: false,
            isSubmitting: false,
            nearbySpaces: area?.nearbySpacesSnapshot || nearbySpaces || [],
            previewStyleState: {},
            selectedImage: imageDetails || {},
            imagePreviewPath,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeAccentLayout = buildAccentStyles(props.user.settings?.mobileThemeName);
        this.themeAlerts = buildAlertStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeMoments = buildMomentStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeAccentForms = buildAccentFormStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) => translator(props.user.settings?.locale || 'en-us', key, params);
        this.categoryOptions = Categories.MomentCategories.map((category: string, index) => ({
            id: index,
            label: this.translate(category),
            value: category,
        }));
        this.nearbySpaceOptions = [{
            id: 'unselected',
            label: this.translate('forms.editMoment.labels.unselected'),
            value: undefined,
        }].concat((nearbySpaces || []).map((space) => ({
            id: space.id,
            label: space.title,
            value: space.id,
        })));
        // changeNavigationBarColor(therrTheme.colors.accent1, false, true);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.editMoment.headerTitle'),
        });

        // If editing an existing moment, fetch the moment details (withMedia) and populate the form
        this.unsubscribeNavListener = navigation.addListener('beforeRemove', (e) => {
            const { isEditingNearbySpaces } = this.state;
            // changeNavigationBarColor(therrTheme.colors.primary, false, true);
            if (isEditingNearbySpaces && (e.data.action.type === 'GO_BACK' || e.data.action.type === 'POP')) {
                e.preventDefault();
                this.setState({
                    isEditingNearbySpaces: false,
                });
            }
        });
    }

    componentWillUnmount() {
        this.unsubscribeNavListener();
    }

    isFormDisabled() {
        const { inputs, isSubmitting } = this.state;

        return (
            !inputs.notificationMsg ||
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
            filename: `${FilePaths.CONTENT}/${(notificationMsg || message.substring(0, 20)).replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`,
        }).then((response) => {
            const signedUrl = response?.data?.url && response?.data?.url[0];
            createArgs.media = [{}];
            createArgs.media[0].altText = notificationMsg;
            createArgs.media[0].type = isPublic ? Content.mediaTypes.USER_IMAGE_PUBLIC : Content.mediaTypes.USER_IMAGE_PRIVATE;
            createArgs.media[0].path = response?.data?.path;
            // TODO: Replace media with medias after migrations
            createArgs.medias = createArgs.media;

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

    onSubmitBaseDetails = () => {
        this.onSubmit({
            isDraft: true,
            shouldSkipRewards: true,
            shouldSkipNavigate: true,
            shouldSkipDraftToast: true,
        });
        const { navigation } = this.props;

        this.setState({
            isEditingNearbySpaces: true,
        });

        // This is necessary to allow intercepting the back swipe gesture and prevent it from animating
        // before preventDefault is called in the beforeRemove listener
        navigation.setOptions({
            // animation: 'none', // navigation v6
            animationEnabled: false,
            gestureEnabled: true, // must be set to true or it gets animationEnabled with animationEnabled=false
        });
    };

    onSubmit = ({
        isDraft = false,
        shouldSkipRewards = false,
        shouldSkipNavigate = false,
        shouldSkipDraftToast = false,
    }) => {
        const { areaId, hashtags, nearbySpaces, selectedImage } = this.state;
        const {
            category,
            message,
            notificationMsg,
            maxViews,
            expiresAt,
            radius,
            rating,
            spaceId,
            isPublic,
        } = this.state.inputs;
        const {
            createOrUpdateSpaceReaction,
            navigation,
            route,
            user,
        } = this.props;
        let {
            latitude,
            longitude,
        } = route.params;
        if (!latitude || !longitude) {
            latitude = route.params.area?.latitude;
            longitude = route.params.area?.longitude;
        }

        const sanitizedRadius = Math.max(MIN_RADIUS_PRIVATE, Math.min(MAX_RADIUS_PRIVATE, parseInt(radius, 10) || MIN_RADIUS_PRIVATE));

        const createArgs: any = {
            category,
            fromUserId: user.details.id,
            isPublic,
            message: message || notificationMsg,
            notificationMsg,
            hashTags: hashtags.join(','),
            isDraft,
            latitude,
            longitude,
            maxViews,
            radius: sanitizedRadius,
            rating,
            skipReward: shouldSkipRewards,
            spaceId,
            expiresAt,
            nearbySpacesSnapshot: nearbySpaces,
        };

        if (!this.isFormDisabled()) {
            ReactNativeHapticFeedback.trigger(HAPTIC_FEEDBACK_TYPE, hapticFeedbackOptions);

            this.setState({
                isSubmitting: true,
            });

            // Note do not save image on 'create draft' otherwise we end up with duplicate images when finalizing draft
            // This is not the BEST user experience but prevents a lot of potential waste
            ((selectedImage?.path) ? this.signAndUploadImage(createArgs) : Promise.resolve(createArgs)).then((modifiedCreateArgs) => {
                const createOrUpdatePromise = areaId
                    ? this.props.updateMoment(areaId, modifiedCreateArgs, !isDraft) // isCompletedDraft (when id and saving finalized)
                    : this.props.createMoment(modifiedCreateArgs);

                if (spaceId && rating !== null) {
                    createOrUpdateSpaceReaction(spaceId, { rating });
                }

                createOrUpdatePromise
                    .then((response) => {
                        if (!shouldSkipDraftToast) {
                            showToast.success({
                                text1: isDraft
                                    ? this.translate('alertTitles.momentDraftSuccess')
                                    : this.translate('alertTitles.momentCreatedSuccess'),
                                text2: isDraft
                                    ? this.translate('alertMessages.momentDraftSuccess')
                                    : this.translate('alertMessages.momentCreatedSuccess'),
                                onHide: () => {
                                    if (response?.therrCoinRewarded && response?.therrCoinRewarded > 0) {
                                        // TODO: Only send toast if push notifications are disabled
                                        // TODO: Include title of checkin
                                        sendForegroundNotification({
                                            title: this.translate('alertTitles.coinsReceived'),
                                            body: this.translate('alertMessages.coinsReceived', {
                                                total: response.therrCoinRewarded,
                                            }),
                                            android: {
                                                pressAction: { id: PushNotifications.PressActionIds.exchange, launchActivity: 'default' },
                                                actions: [
                                                    {
                                                        pressAction: { id: PushNotifications.PressActionIds.exchange, launchActivity: 'default' },
                                                        title: this.translate('alertActions.exchange'),
                                                    },
                                                ],
                                            },
                                        }, getAndroidChannel(AndroidChannelIds.rewardUpdates, false));
                                        showToast.success({
                                            text1: this.translate('alertTitles.coinsReceived'),
                                            text2: this.translate('alertMessages.coinsReceived', {
                                                total: response.therrCoinRewarded,
                                            }),
                                        });
                                        showToast.success({
                                            text1: this.translate('alertTitles.coinsReceived'),
                                            text2: this.translate('alertMessages.coinsReceived', {
                                                total: response.therrCoinRewarded,
                                            }),
                                        });
                                    }
                                },
                            });
                        }

                        if (isDraft && Platform.OS !== 'android') {
                            const nowPlus = new Date();
                            nowPlus.setHours(nowPlus.getMinutes() + 1);
                            sendTriggerNotification(nowPlus, {
                                title: this.translate('alertTitles.draftReminder'),
                                body: this.translate('alertMessages.draftReminder'),
                                android: {
                                    actions: [
                                        {
                                            pressAction: { id: PushNotifications.PressActionIds.drafts, launchActivity: 'default' },
                                            title: this.translate('alertActions.edit'),
                                        },
                                    ],
                                },
                            }, getAndroidChannel(AndroidChannelIds.reminders, true));
                        }

                        logEvent(getAnalytics(),areaId ? 'moment_update' : 'moment_create', {
                            userId: user.details.id,
                            momentLongitude: longitude,
                            momentLatitude: latitude,
                            radius,
                            isDraft,
                            isPublic,
                            category,
                        }).catch((err) => console.log(err));

                        if (!shouldSkipNavigate) {
                            if (!isDraft) {
                                this.setState({
                                    isSharePromptVisible: true,
                                    isSubmitting: false,
                                });
                            } else {
                                setTimeout(() => {
                                    this.props.navigation.navigate('Map', {
                                        shouldShowPreview: false,
                                    });
                                }, 250);
                            }
                        } else {
                            this.setState({
                                areaId: response.id, // so subsequent saves do not create a new area
                                isSubmitting: false,
                            });
                        }
                    })
                    .catch((error: any) => {
                        // TODO: Delete uploaded file on failure to create
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

                            if (error.errorCode === ErrorCodes.INSUFFICIENT_THERR_COIN_FUNDS) {
                                this.toggleInfoModal();
                            }
                        } else if (error.statusCode >= 500) {
                            this.setState({
                                errorMsg: this.translate('forms.editMoment.backendErrorMessage'),
                            });
                        }
                    })
                    .finally(() => {
                        Keyboard.dismiss();
                        this.scrollViewRef.scrollToEnd({ animated: true });
                    });
            }).catch((err) => {
                console.log(err);
                return navigation.navigate('Map', {
                    shouldShowPreview: false,
                });
            });
        }
    };

    onInputChange = (name: string, value: string | undefined) => {
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
            const match = value?.match(youtubeLinkRegex);
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
            isSubmitting: false,
        });
    };

    onSelectRating = (rating: number) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                rating,
            },
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
            });
        }
    };

    onAddImage = (action: string) => {
        const { user } = this.props;
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
                logEvent(getAnalytics(),'permissions_denied_issue', {
                    platform: Platform.OS,
                    userId: user?.details?.id,
                }).catch((err) => console.log(err));
                showToast.error({
                    text1: this.translate('alertTitles.permissionsDenied'),
                    text2: this.translate('alertMessages.cameraOrFilePermissionsDenied'),
                });
                throw new Error('permissions denied');
            }
        }).catch((e) => {
            logEvent(getAnalytics(),'camera_permissions_error', {
                platform: Platform.OS,
                userId: user?.details?.id,
            }).catch((err) => console.log(err));
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
    };

    onConfirmInsufficientFunds = () => {
        this.toggleInfoModal();

        // Submit and allow skipping rewards
        this.setState({
            isSubmitting: false,
            errorMsg: '',
        }, () => this.onSubmit({
            isDraft: false,
            shouldSkipRewards: true,
            shouldSkipNavigate: false,
        }));
    };

    onDismissSharePrompt = () => {
        this.setState({
            isSharePromptVisible: false,
        }, () => {
            setTimeout(() => {
                this.props.navigation.navigate('Map', {
                    shouldShowPreview: false,
                });
            }, 250);
        });
    };

    toggleInfoModal = () => {
        this.setState({
            isInsufficientFundsModalVisible: !this.state.isInsufficientFundsModalVisible,
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

    getContinueButtonConfig = (): {
        title: string;
        icon: string,
        iconRight: boolean,
        iconStyle: any,
        onPress: any,
    } => {
        const { isEditingNearbySpaces, nearbySpaces } = this.state;

        if (!isEditingNearbySpaces && (nearbySpaces?.length || 0) > 0) {
            return {
                title: this.translate('forms.editMoment.buttons.next'),
                icon: 'chevron-right',
                iconStyle: this.themeAccentForms.styles.nextButtonIcon,
                iconRight: true,
                onPress: this.onSubmitBaseDetails,
            };
        }

        return {
            title: this.translate('forms.editMoment.buttons.submit'),
            icon: 'send',
            iconStyle: this.themeAccentForms.styles.submitButtonIcon,
            iconRight: false,
            onPress: () => this.onSubmit({
                isDraft: false,
                shouldSkipRewards: false,
                shouldSkipNavigate: false,
            }),
        };
    };

    renderEditingForm = () => {
        const {
            errorMsg,
            hashtags,
            inputs,
            previewLinkId,
            previewStyleState,
            imagePreviewPath,
        } = this.state;

        return (
            <>
                <Pressable style={this.themeAccentLayout.styles.container} onPress={Keyboard.dismiss}>
                    <View style={this.themeMoments.styles.mediaContainer}>
                        {
                            imagePreviewPath
                                ? (
                                    <Image
                                        source={{ uri: imagePreviewPath }}
                                        style={this.themeMoments.styles.mediaImage}
                                    />
                                )
                                : (
                                    <LottieView
                                        source={require('../../assets/missing-image-storefront.json')}
                                        resizeMode="contain"
                                        speed={0.8}
                                        autoPlay
                                        loop
                                        style={{
                                            width: viewportWidth - (2 * this.themeAccentLayout.styles.container.padding),
                                            height: 160,
                                        }}
                                    />
                                )
                        }
                    </View>
                    <Button
                        containerStyle={spacingStyles.marginBotMd}
                        buttonStyle={this.themeForms.styles.buttonPrimary}
                        // disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                        disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                        disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                        titleStyle={this.themeForms.styles.buttonTitle}
                        title={this.translate(
                            imagePreviewPath ? 'forms.editMoment.buttons.replaceImage' : 'forms.editMoment.buttons.addImage'
                        )}
                        icon={
                            <TherrIcon
                                name="camera"
                                size={23}
                                style={{ color: this.theme.colors.primary, paddingRight: 8 }}
                            />
                        }
                        onPress={() => SheetManager.show('image-picker-sheet', {
                            payload: {
                                galleryText: this.translate('forms.editMoment.buttons.selectExisting'),
                                cameraText: this.translate('forms.editMoment.buttons.captureNew'),
                                themeForms: this.themeForms,
                                onSelect: (source) => this.onAddImage(source),
                            },
                        })}
                        raised={false}
                    />
                    {
                        !!imagePreviewPath &&
                        <Button
                            containerStyle={spacingStyles.marginBotMd}
                            buttonStyle={this.themeForms.styles.buttonRoundAlt}
                            titleStyle={this.themeForms.styles.buttonTitleAlt}
                            title={this.translate('forms.editMoment.buttons.removeImage')}
                            icon={
                                <OctIcon
                                    name="x"
                                    size={18}
                                    style={{ color: this.theme.colors.accentRed, paddingRight: 8 }}
                                />
                            }
                            onPress={() => this.setState({ selectedImage: undefined, imagePreviewPath: '' })}
                            raised={false}
                        />
                    }
                    <Text style={this.theme.styles.sectionDescriptionNote}>
                        {this.translate('forms.editMoment.labels.addImageNote')}
                    </Text>
                    <RoundInput
                        containerStyle={{ marginBottom: 12 }}
                        autoFocus
                        maxLength={100}
                        placeholder={this.translate(
                            'forms.editMoment.labels.notificationMsg'
                        )}
                        value={inputs.notificationMsg}
                        onChangeText={(text) =>
                            this.onInputChange('notificationMsg', text)
                        }
                        themeForms={this.themeForms}
                    />
                    <RoundTextInput
                        placeholder={this.translate(
                            'forms.editMoment.labels.message'
                        )}
                        value={inputs.message}
                        onChangeText={(text) =>
                            this.onInputChange('message', text)
                        }
                        minHeight={150}
                        numberOfLines={7}
                        themeForms={this.themeForms}
                    />
                    <RoundInput
                        containerStyle={{ marginBottom: 12 }}
                        autoCorrect={false}
                        errorStyle={this.theme.styles.displayNone}
                        placeholder={this.translate(
                            'forms.editMoment.labels.hashTags'
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
                    <View style={[
                        spacingStyles.padTopMd,
                        spacingStyles.padBotMd,
                        spacingStyles.flexRow,
                        spacingStyles.alignCenter,
                    ]}>
                        <DropDown
                            onChange={(newValue) =>
                                this.onInputChange('category', newValue || 'uncategorized')
                            }
                            options={this.categoryOptions}
                            formStyles={this.themeForms.styles}
                            initialValue={inputs.category}
                        />
                    </View>
                    <Button
                        containerStyle={spacingStyles.marginBotMd}
                        buttonStyle={this.themeForms.styles.buttonRoundAlt}
                        // disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                        disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                        disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                        titleStyle={this.themeForms.styles.buttonTitleAlt}
                        title={inputs.isPublic
                            ? this.translate('forms.editMoment.buttons.visibilityPublic')
                            : this.translate('forms.editMoment.buttons.visibilityPrivate')}
                        type="outline"
                        onPress={() => SheetManager.show('visibility-picker-sheet', {
                            payload: {
                                publicText: this.translate('forms.editMoment.buttons.visibilityPublic'),
                                privateText: this.translate('forms.editMoment.buttons.visibilityPrivate'),
                                themeForms: this.themeForms,
                                onSelect: (isPublic) => this.onSetVisibility(isPublic),
                            },
                        })}
                        raised={false}
                        icon={
                            <OctIcon
                                name={inputs.isPublic ? 'globe' : 'people'}
                                size={22}
                                style={this.themeForms.styles.buttonIconAlt}
                            />
                        }
                    />
                    <View
                        style={[this.themeForms.styles.inputSliderContainer, { paddingBottom: 20 }]}
                    >
                        <RoundInput
                            placeholder={this.translate('forms.editMoment.labels.radiusPlaceholder', {
                                min: MIN_RADIUS_PRIVATE,
                                max: MAX_RADIUS_PRIVATE,
                            })}
                            value={inputs.radius === '' ? '' : String(inputs.radius)}
                            onChangeText={(text) => {
                                const stripped = text.replace(/[^0-9]/g, '');
                                if (stripped === '') {
                                    this.onInputChange('radius', '' as any);
                                } else {
                                    this.onInputChange('radius', parseInt(stripped, 10) as any);
                                }
                            }}
                            onBlur={() => {
                                const num = parseInt(inputs.radius, 10);
                                if (isNaN(num) || num < MIN_RADIUS_PRIVATE) {
                                    this.onInputChange('radius', MIN_RADIUS_PRIVATE as any);
                                } else if (num > MAX_RADIUS_PRIVATE) {
                                    this.onInputChange('radius', MAX_RADIUS_PRIVATE as any);
                                }
                            }}
                            keyboardType="number-pad"
                            themeForms={this.themeForms}
                        />
                        {inputs.radius !== '' && <Text style={this.themeForms.styles.inputLabelDark}>
                            {`${this.translate('forms.editMoment.labels.radius', { meters: inputs.radius })}`}
                        </Text>}
                    </View>
                    <Alert
                        containerStyles={addMargins({
                            marginBottom: 24,
                        })}
                        isVisible={!!(errorMsg)}
                        message={errorMsg}
                        type={'error'}
                        themeAlerts={this.themeAlerts}
                    />
                    {/* <AccentInput
                        placeholder={this.translate(
                            'forms.editMoment.labels.maxProximity'
                        )}
                        value={inputs.maxProximity}
                        onChangeText={(text) =>
                            this.onInputChange('maxProximity', text)
                        }
                    />
                    {/* <AccentInput
                        placeholder={this.translate(
                            'forms.editMoment.labels.maxViews'
                        )}
                        value={inputs.maxViews}
                        onChangeText={(text) =>
                            this.onInputChange('maxViews', text)
                        }
                    />
                    <AccentInput
                        placeholder={this.translate(
                            'forms.editMoment.labels.expiresAt'
                        )}
                        value={inputs.expiresAt}
                        onChangeText={(text) =>
                            this.onInputChange('expiresAt', text)
                        }
                    /> */}
                </Pressable>
                {
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
                }
            </>
        );
    };

    renderEditingNearbySpaces = () => {
        const {
            errorMsg,
            inputs,
        } = this.state;

        return (
            <>
                <Pressable style={this.themeAccentLayout.styles.container} onPress={Keyboard.dismiss}>
                    <Text style={this.theme.styles.sectionDescriptionNote}>
                        {this.translate('forms.editMoment.labels.addNearbySpaceNote')}
                    </Text>
                    <View style={[this.themeForms.styles.input, { display: 'flex', flexDirection: 'row', alignItems: 'center' }]}>
                        <DropDown
                            onChange={(newValue) =>
                                this.onInputChange('spaceId', newValue || undefined)
                            }
                            options={this.nearbySpaceOptions}
                            formStyles={this.themeForms.styles}
                            initialValue={inputs.spaceId}
                        />
                    </View>
                    {
                        inputs.spaceId &&
                        <View style={this.theme.styles.sectionContainer}>
                            <Text style={this.theme.styles.sectionTitleCenter}>
                                {this.translate('forms.editMoment.headers.rating')}
                            </Text>
                            <SpaceRating themeForms={this.themeForms} isEditable onSelectRating={this.onSelectRating} />
                        </View>
                    }
                    <Alert
                        containerStyles={addMargins({
                            marginBottom: 24,
                        })}
                        isVisible={!!errorMsg}
                        message={errorMsg}
                        type={'error'}
                        themeAlerts={this.themeAlerts}
                    />
                </Pressable>
            </>
        );
    };

    render() {
        const { navigation } = this.props;
        const {
            previewLinkId,
            previewStyleState,
            isEditingNearbySpaces,
            isInsufficientFundsModalVisible,
            isSharePromptVisible,
        } = this.state;
        const continueButtonConfig = this.getContinueButtonConfig();
        const iPadDynamicStyles: any = (Platform.OS === 'ios' && Platform.isPad)
            ? {
                marginHorizontal: '30%',
                width: '70%',
                minWidth: '70%', // helps ensure view within bottomSheet is full width
                alignSelf: 'center',
            }
            : {};

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={[this.theme.styles.safeAreaView, iPadDynamicStyles]}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        keyboardShouldPersistTaps="always"
                        scrollEnabled
                        ref={(component) => (this.scrollViewRef = component)}
                        style={[this.theme.styles.bodyFlex, this.themeAccentLayout.styles.bodyEdit]}
                        contentContainerStyle={[
                            this.theme.styles.bodyScroll,
                            this.themeAccentLayout.styles.bodyEditScroll,
                            { backgroundColor: this.theme.colorVariations.primary2Fade },
                        ]}
                    >
                        {
                            isEditingNearbySpaces ? this.renderEditingNearbySpaces() : this.renderEditingForm()
                        }
                        {
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
                        }
                    </KeyboardAwareScrollView>
                    <EditFormFooter
                        isDarkMode={isDarkTheme(this.props.user.settings?.mobileThemeName)}
                        theme={this.theme}
                        buttons={[
                            {
                                title: this.translate('forms.editMoment.buttons.back'),
                                onPress: () => navigation.goBack(),
                                mode: 'outlined',
                                icon: 'arrow-left',
                                textColor: this.theme.colors.brandingBlueGreen,
                            },
                            {
                                title: this.translate('forms.editMoment.buttons.draft'),
                                onPress: () => this.onSubmit({
                                    isDraft: true,
                                    shouldSkipRewards: true,
                                    shouldSkipNavigate: true,
                                }),
                                mode: 'outlined',
                                icon: 'file-edit-outline',
                                disabled: this.isFormDisabled(),
                                loading: this.state.isSubmitting,
                                textColor: this.theme.colors.brandingBlueGreen,
                            },
                            {
                                title: continueButtonConfig.title,
                                onPress: continueButtonConfig.onPress,
                                mode: 'contained',
                                icon: continueButtonConfig.iconRight ? 'chevron-right' : 'send',
                                disabled: this.isFormDisabled(),
                                loading: this.state.isSubmitting,
                                buttonColor: this.theme.colors.accentTeal,
                                textColor: this.theme.colors.brandingBlack,
                            },
                        ]}
                    />
                </SafeAreaView>
                <ConfirmModal
                    isVisible={isInsufficientFundsModalVisible}
                    onCancel={this.toggleInfoModal}
                    onConfirm={this.onConfirmInsufficientFunds}
                    headerText={this.translate('forms.editMoment.modal.insufficientFundsTitle')}
                    text={this.translate('forms.editMoment.modal.insufficientFundsMessage')}
                    text2={this.translate('forms.editMoment.modal.insufficientFundsMessage2')}
                    textCancel={this.translate('forms.editMoment.buttons.cancel')}
                    textConfirm={this.translate('forms.editMoment.buttons.continue')}
                    translate={this.translate}
                    theme={this.theme}
                    themeModal={this.themeConfirmModal}
                    themeButtons={this.themeButtons}
                />
                <SharePromptModal
                    isVisible={isSharePromptVisible}
                    headerText={this.translate('modals.sharePrompt.momentCreated.header')}
                    message={this.translate('modals.sharePrompt.momentCreated.message')}
                    shareMessage={this.translate('modals.contentOptions.shareLink.messageMoment', {
                        momentId: this.state.areaId || '',
                        shareUrl: buildMomentUrl(this.props.user?.settings?.locale || 'en-us', this.state.areaId || ''),
                    })}
                    shareUrl={buildMomentUrl(
                        this.props.user?.settings?.locale || 'en-us', this.state.areaId || ''
                    )}
                    shareTitle={this.translate('modals.contentOptions.shareLink.titleMoment', { momentTitle: this.state.inputs.notificationMsg || '' })}
                    onDismiss={this.onDismissSharePrompt}
                    translate={this.translate}
                    themeModal={this.themeConfirmModal}
                    themeButtons={this.themeButtons}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(EditMoment);
