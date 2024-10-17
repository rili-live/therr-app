import React from 'react';
import { Dimensions, Platform, Pressable, SafeAreaView, Keyboard, Text, View } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button, Image } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import RNFB from 'react-native-blob-util';
import Toast from 'react-native-toast-message';
// import changeNavigationBarColor from 'react-native-navigation-bar-color';
import { GOOGLE_APIS_ANDROID_KEY, GOOGLE_APIS_IOS_KEY } from 'react-native-dotenv';
import { IUserState, IMapState, IContentState } from 'therr-react/types';
import { MapActions } from 'therr-react/redux/actions';
import { Categories, Content, ErrorCodes, FilePaths, GroupMemberRoles } from 'therr-js-utilities/constants';
import { MapsService } from 'therr-react/services';
import ImageCropPicker from 'react-native-image-crop-picker';
import OctIcon from 'react-native-vector-icons/Octicons';
import YoutubePlayer from 'react-native-youtube-iframe';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import LottieView from 'lottie-react-native';
import analytics from '@react-native-firebase/analytics';
import DropDown from '../../components/Input/DropDown';
// import Alert from '../components/Alert';
import translator from '../../services/translator';
import { buildStyles, addMargins } from '../../styles';
import { buildStyles as buildAlertStyles } from '../../styles/alerts';
import { buildStyles as buildAccentStyles } from '../../styles/layouts/accent';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildAccentFormStyles } from '../../styles/forms/accentEditForm';
import { buildStyles as buildModalStyles } from '../../styles/modal';
import { buildStyles as buildAreaStyles } from '../../styles/user-content/areas/editing';
import { buildStyles as buildSearchStyles } from '../../styles/modal/typeAhead';
import userContentStyles from '../../styles/user-content';
import spacingStyles from '../../styles/layouts/spacing';
import {
    youtubeLinkRegex,
    DEFAULT_RADIUS,
    // MIN_RADIUS_PRIVATE,
    // MAX_RADIUS_PRIVATE,
    getAndroidChannel,
    AndroidChannelIds,
    PressActionIds,
    HAPTIC_FEEDBACK_TYPE,
    DEFAULT_LONGITUDE,
    DEFAULT_LATITUDE,
    GROUPS_CAROUSEL_TABS,
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
import { addAddressParams } from '../../utilities/areaUtils';
import BottomSheet from '../../components/BottomSheet/BottomSheet';
import TherrIcon from '../../components/TherrIcon';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import SpaceRating from '../../components/Input/SpaceRating';
import SearchTypeAheadResults from '../../components/SearchTypeAheadResults';
import UsersActions from '../../redux/actions/UsersActions';
import searchLoading from '../../assets/search-loading.json';
import InputEventName from '../Events/InputEventName';
import EventStartEndFormGroup from './EventStartEndFormGroup';

const { height: viewPortHeight, width: viewportWidth } = Dimensions.get('window');

const getUserEventHostGroups = (userGroups: any[]) => userGroups?.filter((userGroup) => [
    GroupMemberRoles.ADMIN,
    GroupMemberRoles.CREATOR,
    GroupMemberRoles.EVENT_HOST,
].includes(userGroup.role)).map((uGroup) => ({
    id: uGroup.groupId,
    label: uGroup.group?.title || uGroup.groupName || uGroup.groupId,
    value: uGroup.groupId,
}));

const hapticFeedbackOptions = {
    enableVibrateFallback: false,
    ignoreAndroidSystemSettings: false,
};

interface IEditEventDispatchProps {
    getUserGroups: Function;
    createEvent: Function;
    updateEvent: Function;
    getPlacesSearchAutoComplete: Function;
}

interface IStoreProps extends IEditEventDispatchProps {
    content: IContentState;
    map: IMapState;
    user: IUserState;
}

// Regular component props
export interface IEditEventProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IEditEventState {
    addressInputText: string;
    areaId?: string;
    errorMsg: string;
    userGroups: any[];
    hashtags: string[];
    isAddressDropdownVisible: boolean;
    isImageBottomSheetVisible: boolean;
    isInsufficientFundsModalVisible: boolean;
    isLoading: boolean;
    isVisibilityBottomSheetVisible: boolean;
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
    map: state.map,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getUserGroups: UsersActions.getUserGroups,
    createEvent: MapActions.createEvent,
    updateEvent: MapActions.updateEvent,
    getPlacesSearchAutoComplete: MapActions.getPlacesSearchAutoComplete,
}, dispatch);

export class EditEvent extends React.Component<IEditEventProps, IEditEventState> {
    private categoryOptions: any[];
    private nearbySpaceOptions: any[];
    private scrollViewRef;
    private translate: Function;
    private throttleAddressTimeoutId: any;
    private unsubscribeNavListener;
    private theme = buildStyles();
    private themeAlerts = buildAlertStyles();
    private themeAccentLayout = buildAccentStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeButtons = buildButtonStyles();
    private themeAreas = buildAreaStyles();
    private themeModal = buildModalStyles();
    private themeForms = buildFormStyles();
    private themeAccentForms = buildAccentFormStyles();
    private themeSearch = buildSearchStyles({ viewPortHeight });

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
            addressInputText: area?.space?.addressReadable || '',
            errorMsg: '',
            userGroups: getUserEventHostGroups(Object.values(props.user.myUserGroups || {})),
            hashtags: area?.hashTags ? area?.hashTags?.split(',') : [],
            inputs: {
                addressReadable: area?.space?.addressReadable || '',
                addressLatitude: area?.space?.latitude || '',
                addressLongitude: area?.space?.longitude || '',
                isDraft: false,
                isPublic: area?.isPublic == null ? true : area?.isPublic,
                radius: area?.radius || DEFAULT_RADIUS,
                category: area?.category || '',
                message: area?.message || '',
                notificationMsg: area?.notificationMsg || '',
                hashTags: '',
                maxViews: area?.maxViews,
                groupId: area?.groupId || undefined,
                spaceId: area?.spaceId || undefined,
                scheduleStartAt: area?.scheduleStartAt ? new Date(area?.scheduleStartAt) : new Date(),
                scheduleStopAt: area?.scheduleStopAt ? new Date(area?.scheduleStopAt) : new Date(),
            },
            isAddressDropdownVisible: false,
            isEditingNearbySpaces: false,
            isImageBottomSheetVisible: false,
            isInsufficientFundsModalVisible: false,
            isLoading: true,
            isVisibilityBottomSheetVisible: false,
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
        this.themeModal = buildModalStyles(props.user.settings?.mobileThemeName);
        this.themeAreas = buildAreaStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeAccentForms = buildAccentFormStyles(props.user.settings?.mobileThemeName);
        this.themeSearch = buildSearchStyles({ viewPortHeight }, props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) => translator('en-us', key, params);
        this.categoryOptions = Categories.EventCategories.map((category, index) => ({
            id: index,
            label: this.translate(category),
            value: category,
        }));
        this.nearbySpaceOptions = [{
            id: 'unselected',
            label: this.translate('forms.editEvent.labels.unselected'),
            value: undefined,
        }].concat((nearbySpaces || []).map((space) => ({
            id: space.id,
            label: space.title,
            value: space.id,
        })));
        // changeNavigationBarColor(therrTheme.colors.accent1, false, true);
    }

    componentDidMount() {
        const { getUserGroups, navigation } = this.props;
        const { areaId, userGroups } = this.state;

        navigation.setOptions({
            title: areaId ? this.translate('pages.editEvent.headerTitleEditing') : this.translate('pages.editEvent.headerTitle'),
        });

        // Fetch if user groups are missing title/groupName
        if (!userGroups?.length || userGroups?.some((group) => !group.title && !group.groupName)) {
            getUserGroups({
                withGroups: true,
            }).then((result) => {
                const eventHostUserGroups = getUserEventHostGroups(result?.userGroups);
                this.setState({
                    userGroups: eventHostUserGroups,
                });
            }).finally(() => {
                this.setState({
                    isLoading: false,
                });
            });
        } else {
            this.setState({
                isLoading: false,
            });
        }

        // If editing an existing event, fetch the event details (withMedia) and populate the form
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
        clearTimeout(this.throttleAddressTimeoutId);
        this.unsubscribeNavListener();
    }

    isFormDisabled() {
        const { inputs, isSubmitting } = this.state;

        return (
            !inputs.message ||
            !inputs.notificationMsg ||
            !inputs.groupId ||
            !inputs.addressReadable ||
            !inputs.addressLatitude ||
            !inputs.addressLongitude ||
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
            filename: `${FilePaths.CONTENT}/events/${(notificationMsg || message.substring(0, 20)).replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`,
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
            addressReadable,
            addressLatitude,
            addressLongitude,
            addressNotificationMsg,
            addressWebsite,
            addressIntlPhone,
            addressOpeningHours,
            addressRating,
            category,
            message,
            notificationMsg,
            maxViews,
            expiresAt,
            radius,
            rating,
            scheduleStartAt,
            scheduleStopAt,
            groupId,
            spaceId,
            isPublic,
        } = this.state.inputs;
        const {
            navigation,
            route,
            user,
        } = this.props;
        let {
            latitude,
            longitude,
        } = route.params;
        let userLatitude = latitude;
        let userLongitude = longitude;
        if (!userLatitude || !userLongitude) {
            userLatitude = route.params.area?.latitude;
            userLongitude = route.params.area?.longitude;
        }

        let createArgs: any = {
            category,
            fromUserId: user.details.id,
            isPublic,
            message,
            notificationMsg,
            hashTags: hashtags.join(','),
            isDraft,
            latitude: addressLatitude,
            longitude: addressLongitude,
            userLatitude,
            userLongitude,
            maxViews,
            radius,
            rating,
            scheduleStartAt: scheduleStartAt.getTime(),
            scheduleStopAt: scheduleStopAt.getTime(),
            skipReward: shouldSkipRewards,
            spaceId,
            groupId,
            expiresAt,
            nearbySpacesSnapshot: nearbySpaces,
        };

        if (scheduleStopAt - scheduleStartAt <= 0) {
            Toast.show({
                type: 'error',
                text1: this.translate('alertTitles.startDateAfterEndDate'),
                text2: this.translate('alertMessages.startDateAfterEndDate'),
                visibilityTime: 3500,
            });

            return;
        }

        if (!this.isFormDisabled()) {
            ReactNativeHapticFeedback.trigger(HAPTIC_FEEDBACK_TYPE, hapticFeedbackOptions);

            this.setState({
                isSubmitting: true,
            });

            createArgs = addAddressParams(createArgs, {
                addressReadable,
                addressLatitude,
                addressLongitude,
                addressNotificationMsg,
                addressWebsite,
                addressIntlPhone,
                addressOpeningHours,
                addressRating,
            });

            // Note do not save image on 'create draft' otherwise we end up with duplicate images when finalizing draft
            // This is not the BEST user experience but prevents a lot of potential waste
            ((selectedImage?.path) ? this.signAndUploadImage(createArgs) : Promise.resolve(createArgs)).then((modifiedCreateArgs) => {
                const createOrUpdatePromise = areaId
                    ? this.props.updateEvent(areaId, modifiedCreateArgs, !isDraft) // isCompletedDraft (when id and saving finalized)
                    : this.props.createEvent(modifiedCreateArgs);

                createOrUpdatePromise
                    .then((response) => {
                        if (!shouldSkipDraftToast) {
                            const onHide = () => {
                                if (response?.therrCoinRewarded && response?.therrCoinRewarded > 0) {
                                    // TODO: Only send toast if push notifications are disabled
                                    // TODO: Include title of checkin
                                    sendForegroundNotification({
                                        title: this.translate('alertTitles.coinsReceived'),
                                        body: this.translate('alertMessages.coinsReceived', {
                                            total: response.therrCoinRewarded,
                                        }),
                                        android: {
                                            pressAction: { id: PressActionIds.exchange, launchActivity: 'default' },
                                            actions: [
                                                {
                                                    pressAction: { id: PressActionIds.exchange, launchActivity: 'default' },
                                                    title: this.translate('alertActions.exchange'),
                                                },
                                            ],
                                        },
                                    }, getAndroidChannel(AndroidChannelIds.rewardUpdates, false));
                                    Toast.show({
                                        type: 'success',
                                        text1: this.translate('alertTitles.coinsReceived'),
                                        text2: this.translate('alertMessages.coinsReceived', {
                                            total: response.therrCoinRewarded,
                                        }),
                                        visibilityTime: 3500,
                                    });
                                    Toast.show({
                                        type: 'success',
                                        text1: this.translate('alertTitles.coinsReceived'),
                                        text2: this.translate('alertMessages.coinsReceived', {
                                            total: response.therrCoinRewarded,
                                        }),
                                        visibilityTime: 3500,
                                    });
                                }
                            };

                            let text1 = isDraft
                                ? this.translate('alertTitles.eventDraftSuccess')
                                : this.translate('alertTitles.eventCreatedSuccess');
                            let text2 = isDraft
                                ? this.translate('alertMessages.eventDraftSuccess')
                                : this.translate('alertMessages.eventCreatedSuccess');

                            if (areaId) {
                                text1 = this.translate('alertTitles.areaUpdatedSuccess');
                                text2 = this.translate('alertMessages.eventUpdatedSuccess');
                            }

                            Toast.show({
                                type: 'successBig',
                                text1,
                                text2,
                                visibilityTime: 2500,
                                position: 'top',
                                onHide,
                            });
                        }

                        if (isDraft) {
                            const nowPlus = new Date();
                            nowPlus.setHours(nowPlus.getMinutes() + 1);
                            sendTriggerNotification(nowPlus, {
                                title: this.translate('alertTitles.draftReminder'),
                                body: this.translate('alertMessages.draftReminder'),
                                android: {
                                    actions: [
                                        {
                                            pressAction: { id: PressActionIds.drafts, launchActivity: 'default' },
                                            title: this.translate('alertActions.edit'),
                                        },
                                    ],
                                },
                            }, getAndroidChannel(AndroidChannelIds.reminders, true));
                        }

                        analytics().logEvent('event_create', {
                            userId: user.details.id,
                            eventLongitude: longitude,
                            eventLatitude: latitude,
                            radius,
                            isDraft,
                            isPublic,
                            category,
                        }).catch((err) => console.log(err));

                        if (!shouldSkipNavigate) {
                            setTimeout(() => {
                                if (areaId) {
                                    navigation.reset({
                                        index: 1,
                                        routes: [
                                            {
                                                name: 'Map',
                                            },
                                            {
                                                name: 'Areas',
                                            },
                                            {
                                                name: 'ViewEvent',
                                                params: {
                                                    isMyContent: true,
                                                    previousView: 'Areas',
                                                    event: {
                                                        id: areaId,
                                                    },
                                                    eventDetails: {},
                                                },
                                            },
                                        ],
                                    });
                                } else {
                                    this.props.navigation.navigate('Map', {
                                        shouldShowPreview: false,
                                    });
                                }
                            }, 250);
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
                            Toast.show({
                                type: 'error',
                                text1: this.translate('alertTitles.backendErrorMessage'),
                                text2: `${error.message}${
                                    error.parameters
                                        ? '(' + error.parameters.toString() + ')'
                                        : ''
                                }`,
                                visibilityTime: 3500,
                            });

                            if (error.errorCode === ErrorCodes.INSUFFICIENT_THERR_COIN_FUNDS) {
                                this.toggleInfoModal();
                            }
                        } else if (error.statusCode >= 500) {
                            Toast.show({
                                type: 'error',
                                text1: this.translate('alertTitles.backendErrorMessage'),
                                text2: this.translate('forms.editEvent.backendErrorMessage'),
                                visibilityTime: 3500,
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

    onAddressInputChange = (text: string, invoker: string = 'input') => {
        const { getPlacesSearchAutoComplete, map } = this.props;
        const { addressInputText } = this.state;

        clearTimeout(this.throttleAddressTimeoutId);
        this.setState({
            addressInputText: text,
        });

        this.throttleAddressTimeoutId = setTimeout(() => {
            getPlacesSearchAutoComplete({
                longitude: map?.longitude || DEFAULT_LONGITUDE.toString(),
                latitude: map?.latitude || DEFAULT_LATITUDE.toString(),
                // radius,
                input: text,
                types: 'establishment',
            });
        }, 500);

        if (invoker === 'input' && text === addressInputText) {
            return;
        }
        this.setSearchDropdownVisibility(!!text?.length);
    };

    onGoToGroups = () => {
        this.props.navigation.navigate('Groups', {
            activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
        });
    };

    handleAddressInputPress = (invoker: string) => {
        const { addressInputText } = this.state;

        this.setSearchDropdownVisibility(!!addressInputText?.length);

        this.onAddressInputChange(addressInputText || '', invoker);
    };

    handleSearchSelect = (selection) => {
        Keyboard.dismiss();

        this.setSearchDropdownVisibility(false);

        MapsService.getPlaceDetails({
            apiKey: Platform.OS === 'ios' ? GOOGLE_APIS_IOS_KEY : GOOGLE_APIS_ANDROID_KEY,
            placeId: selection?.place_id,
            fieldsGroup: 'basic',
            shouldIncludeWebsite: true,
            shouldIncludeIntlPhone: true,
            shouldIncludeOpeningHours: true,
            shouldIncludeRating: true,
        }).then((response) => {
            const result = response.data?.result;
            const geometry = result?.geometry;
            const formatted_address = result?.formatted_address;
            const modifiedInputs = {
                ...this.state.inputs,
            };
            if (formatted_address) {
                modifiedInputs.addressInputText = formatted_address;
                modifiedInputs.addressReadable = formatted_address;
            }
            if (result?.name) {
                modifiedInputs.addressNotificationMsg = result.name;
            }
            if (geometry?.location) {
                modifiedInputs.addressLatitude = geometry.location.lat;
                modifiedInputs.addressLongitude = geometry.location.lng;
            }
            if (result?.website) {
                modifiedInputs.addressWebsite = result?.website;
            }
            if (result?.rating) {
                modifiedInputs.addressRating = {
                    rating: result?.rating,
                    total: result?.user_ratings_total || 0,
                };
            }
            if (result?.opening_hours?.weekday_text) {
                modifiedInputs.addressOpeningHours = result?.opening_hours?.weekday_text;
            }
            if (result?.international_phone_number) {
                modifiedInputs.addressIntlPhone = result?.international_phone_number.replace(/\s/g, '').replace(/-/g, '');
            }
            this.setState({
                addressInputText: result?.name || formatted_address,
                inputs: modifiedInputs,
            });
        }).catch((error) => {
            console.log(error);
        });
    };

    setSearchDropdownVisibility = (shouldShow: boolean) => {
        this.setState({
            isAddressDropdownVisible: shouldShow,
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
                height: 3 * viewportWidth,
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
                analytics().logEvent('permissions_denied_issue', {
                    platform: Platform.OS,
                    userId: user?.details?.id,
                }).catch((err) => console.log(err));
                Toast.show({
                    type: 'errorBig',
                    text1: this.translate('alertTitles.permissionsDenied'),
                    text2: this.translate('alertMessages.cameraOrFilePermissionsDenied'),
                });
                throw new Error('permissions denied');
            }
        }).catch((e) => {
            analytics().logEvent('camera_permissions_error', {
                platform: Platform.OS,
                userId: user?.details?.id,
            }).catch((err) => console.log(err));
            this.toggleImageBottomSheet();
            // TODO: Handle Permissions denied
            if (e?.message.toLowerCase().includes('cancel')) {
                console.log('canceled');
            }
        });
    };

    onConfirmDatePicker = (variation: 'start' | 'end', date) => {
        const pickerStateKey = variation === 'start'
            ? 'scheduleStartAt'
            : 'scheduleStopAt';
        const newInputChanges = {
            [pickerStateKey]: date,
        };

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            errorMsg: '',
            isSubmitting: false,
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
            isSubmitting: false,
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
        const { areaId, isEditingNearbySpaces, nearbySpaces } = this.state;

        if (!isEditingNearbySpaces && (nearbySpaces?.length || 0) > 0) {
            return {
                title: this.translate('forms.editEvent.buttons.next'),
                icon: 'chevron-right',
                iconStyle: this.themeAccentForms.styles.nextButtonIcon,
                iconRight: true,
                onPress: this.onSubmitBaseDetails,
            };
        }

        return {
            title: this.translate(areaId ? 'forms.editEvent.buttons.update' : 'forms.editEvent.buttons.submit'),
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
            areaId,
            addressInputText,
            errorMsg,
            hashtags,
            inputs,
            previewLinkId,
            previewStyleState,
            isAddressDropdownVisible,
            imagePreviewPath,
            userGroups,
        } = this.state;
        const { map, user } = this.props;

        return (
            <>
                <Pressable style={this.themeAccentLayout.styles.container} onPress={Keyboard.dismiss}>
                    {
                        !!imagePreviewPath &&
                        <View style={this.themeAreas.styles.mediaContainer}>
                            <Image
                                source={{ uri: imagePreviewPath }}
                                style={[this.themeAreas.styles.mediaImageEvent, {
                                    width: viewportWidth - (2 * this.themeAccentLayout.styles.container.padding),
                                }]}
                                resizeMode='contain'
                            />
                        </View>
                    }
                    <Button
                        containerStyle={spacingStyles.marginBotMd}
                        buttonStyle={this.themeForms.styles.buttonPrimary}
                        // disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                        disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                        disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                        titleStyle={this.themeForms.styles.buttonTitle}
                        title={this.translate(
                            !!imagePreviewPath ? 'forms.editEvent.buttons.replaceImage' : 'forms.editEvent.buttons.addImage'
                        )}
                        icon={
                            <TherrIcon
                                name="camera"
                                size={23}
                                style={{ color: this.theme.colors.primary, paddingRight: 8 }}
                            />
                        }
                        onPress={() => this.toggleImageBottomSheet()}
                        raised={false}
                    />
                    <Text style={this.theme.styles.sectionDescriptionNote}>
                        {this.translate('forms.editEvent.labels.addImageNote')}
                    </Text>
                    <View style={{
                        position: 'relative',
                        marginBottom: 50,
                    }}>
                        <RoundInput
                            autoFocus={!areaId}
                            maxLength={100}
                            placeholder={this.translate(
                                'forms.editEvent.labels.address'
                            )}
                            value={addressInputText}
                            onChangeText={(text) =>
                                this.onAddressInputChange(text)
                            }
                            onFocus={() => this.handleAddressInputPress('onfocus')}
                            onBlur={() => this.setSearchDropdownVisibility(false)}
                            rightIcon={
                                <TherrIcon
                                    name={'search'}
                                    size={18}
                                    color={this.theme.colors.primary3}
                                    onPress={() => this.handleAddressInputPress('onpress')}
                                />
                            }
                            themeForms={this.themeForms}
                        />
                        {
                            isAddressDropdownVisible &&
                            <SearchTypeAheadResults
                                containerStyles={{
                                    top: this.themeForms.styles.inputContainerRound.height,
                                }}
                                handleSelect={this.handleSearchSelect}
                                searchPredictionResults={map?.searchPredictions?.results || []}
                                themeSearch={this.themeSearch}
                                disableScroll
                            />
                        }
                        <InputEventName
                            autoFocus={!!areaId}
                            translate={this.translate}
                            onChangeText={(text) =>
                                this.onInputChange('notificationMsg', text)
                            }
                            themeForms={this.themeForms}
                            value={inputs.notificationMsg}
                        />
                        <EventStartEndFormGroup
                            themeForms={this.themeForms}
                            isNightMode={user.settings?.mobileThemeName === 'dark' || user.settings?.mobileThemeName === 'retro'}
                            onConfirm={this.onConfirmDatePicker}
                            translate={this.translate}
                            startsAtValue={inputs.scheduleStartAt}
                            stopsAtValue={inputs.scheduleStopAt}
                        />
                        <RoundTextInput
                            placeholder={this.translate(
                                'forms.editEvent.labels.message'
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
                            containerStyle={{ marginBottom: !hashtags?.length ? 10 : 0 }}
                            autoCorrect={false}
                            errorStyle={this.theme.styles.displayNone}
                            placeholder={this.translate(
                                'forms.editEvent.labels.hashTags'
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
                                enabled={!areaId}
                                onChange={(newValue) =>
                                    this.onInputChange('groupId', newValue || undefined)
                                }
                                options={[{
                                    id: 'unselected',
                                    label: this.translate('forms.editEvent.labels.selectAGroup'),
                                    value: undefined,
                                }].concat(userGroups)}
                                formStyles={this.themeForms.styles}
                                initialValue={inputs.groupId}
                            />
                        </View>
                        <View style={[
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
                                ? this.translate('forms.editEvent.buttons.visibilityPublic')
                                : this.translate('forms.editEvent.buttons.visibilityPrivate')}
                            type="outline"
                            onPress={this.toggleVisibilityBottomSheet}
                            raised={false}
                            icon={
                                <OctIcon
                                    name={inputs.isPublic ? 'globe' : 'people'}
                                    size={22}
                                    style={this.themeForms.styles.buttonIconAlt}
                                />
                            }
                        />
                        {/* <View style={[this.themeForms.styles.inputSliderContainer, { paddingBottom: 20 }]}>
                            <Slider
                                value={inputs.radius}
                                onValueChange={(value) => this.onSliderChange('radius', value)}
                                maximumValue={MAX_RADIUS_PRIVATE}
                                minimumValue={MIN_RADIUS_PRIVATE}
                                step={1}
                                thumbStyle={{ backgroundColor: this.theme.colors.accentBlue, height: 20, width: 20 }}
                                thumbTouchSize={{ width: 30, height: 30 }}
                                minimumTrackTintColor={this.theme.colorVariations.accentBlueLightFade}
                                maximumTrackTintColor={this.theme.colorVariations.accentBlueHeavyFade}
                                onSlidingStart={Keyboard.dismiss}
                            />
                            <Text style={this.themeForms.styles.inputLabelDark}>
                                {`${this.translate('forms.editEvent.labels.radius', { meters: inputs.radius })}`}
                            </Text>
                        </View> */}
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
                            'forms.editEvent.labels.maxProximity'
                        )}
                        value={inputs.maxProximity}
                        onChangeText={(text) =>
                            this.onInputChange('maxProximity', text)
                        }
                    />
                    {/* <AccentInput
                        placeholder={this.translate(
                            'forms.editEvent.labels.maxViews'
                        )}
                        value={inputs.maxViews}
                        onChangeText={(text) =>
                            this.onInputChange('maxViews', text)
                        }
                    />
                    <AccentInput
                        placeholder={this.translate(
                            'forms.editEvent.labels.expiresAt'
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
                        <Text style={this.themeAccentForms.styles.previewHeader}>{this.translate('pages.editEvent.previewHeader')}</Text>
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
                        {this.translate('forms.editEvent.labels.addNearbySpaceNote')}
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
                                {this.translate('forms.editEvent.headers.rating')}
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
            isImageBottomSheetVisible,
            isInsufficientFundsModalVisible,
            isLoading,
            isVisibilityBottomSheetVisible,
            userGroups,
        } = this.state;
        const continueButtonConfig = this.getContinueButtonConfig();

        if (isLoading) {
            return (
                <SafeAreaView style={[this.theme.styles.safeAreaView]}>
                    <LottieView
                        source={searchLoading}
                        // resizeMode="cover"
                        resizeMode="contain"
                        speed={1}
                        autoPlay
                        loop
                        style={[{position: 'absolute', top: 0, width: '100%', height: 65}]}
                    />
                </SafeAreaView>
            );
        }

        if (!userGroups.length) {
            return (
                <SafeAreaView style={[this.theme.styles.safeAreaView]}>
                    <View
                        style={this.theme.styles.bodyFlex}
                    >
                        <Text style={[this.theme.styles.sectionDescriptionCentered, spacingStyles.marginBotXl]}>
                            {this.translate('forms.editEvent.labels.noUserGroups')}
                        </Text>
                        <Button
                            containerStyle={spacingStyles.marginBotMd}
                            buttonStyle={this.themeForms.styles.buttonPrimary}
                            titleStyle={this.themeForms.styles.buttonTitle}
                            title={this.translate('forms.editEvent.buttons.goToGroups')}
                            icon={
                                <TherrIcon
                                    name="group"
                                    size={23}
                                    style={{ color: this.theme.colors.primary, paddingRight: 8 }}
                                />
                            }
                            onPress={this.onGoToGroups}
                            raised={false}
                        />
                    </View>
                </SafeAreaView>
            );

        }

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
                        {
                            isEditingNearbySpaces ? this.renderEditingNearbySpaces() : this.renderEditingForm()
                        }
                        {
                            !!previewLinkId
                            && <View style={[userContentStyles.preview, this.themeAccentForms.styles.previewContainer, previewStyleState]}>
                                <Text style={this.themeAccentForms.styles.previewHeader}>{this.translate('pages.editEvent.previewHeader')}</Text>
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
                        {/* <Button
                            buttonStyle={this.themeAccentForms.styles.draftButton}
                            disabledStyle={this.themeAccentForms.styles.submitButtonDisabled}
                            disabledTitleStyle={this.themeAccentForms.styles.submitDisabledButtonTitle}
                            titleStyle={this.themeAccentForms.styles.submitButtonTitle}
                            containerStyle={[this.themeAccentForms.styles.submitButtonContainer, { marginRight: 20 }]}
                            title={this.translate(
                                'forms.editEvent.buttons.draft'
                            )}
                            icon={
                                <TherrIcon
                                    name="edit"
                                    size={20}
                                    color={this.isFormDisabled() ? 'grey' : 'black'}
                                    style={this.themeAccentForms.styles.submitButtonIcon}
                                />
                            }
                            onPress={() => this.onSubmit({
                                isDraft: true,
                                shouldSkipRewards: true,
                                shouldSkipNavigate: true,
                            })}
                            disabled={this.isFormDisabled()}
                        /> */}
                        <Button
                            buttonStyle={this.themeAccentForms.styles.submitButton}
                            disabledStyle={this.themeAccentForms.styles.submitButtonDisabled}
                            disabledTitleStyle={this.themeAccentForms.styles.submitDisabledButtonTitle}
                            titleStyle={this.themeAccentForms.styles.submitButtonTitle}
                            containerStyle={this.themeAccentForms.styles.submitButtonContainer}
                            title={continueButtonConfig.title}
                            icon={
                                <TherrIcon
                                    name={continueButtonConfig.icon}
                                    size={20}
                                    color={this.isFormDisabled() ? 'grey' : 'black'}
                                    style={continueButtonConfig.iconStyle}
                                />
                            }
                            iconRight={continueButtonConfig.iconRight}
                            onPress={continueButtonConfig.onPress}
                            disabled={this.isFormDisabled()}
                        />
                    </View>
                    <BottomSheet
                        isVisible={isVisibilityBottomSheetVisible}
                        onRequestClose={this.toggleVisibilityBottomSheet}
                        themeModal={this.themeModal}
                    >
                        <Button
                            containerStyle={{ marginBottom: 10, width: '100%' }}
                            buttonStyle={this.themeForms.styles.buttonRound}
                            // disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                            disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                            disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                            titleStyle={this.themeForms.styles.buttonTitle}
                            title={this.translate(
                                'forms.editEvent.buttons.visibilityPublic'
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
                                'forms.editEvent.buttons.visibilityPrivate'
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
                            containerStyle={{ marginBottom: 10, width: '100%' }}
                            buttonStyle={this.themeForms.styles.buttonRound}
                            // disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                            disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                            disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                            titleStyle={this.themeForms.styles.buttonTitle}
                            title={this.translate(
                                'forms.editEvent.buttons.selectExisting'
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
                                'forms.editEvent.buttons.captureNew'
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
                <ConfirmModal
                    isVisible={isInsufficientFundsModalVisible}
                    onCancel={this.toggleInfoModal}
                    onConfirm={this.onConfirmInsufficientFunds}
                    headerText={this.translate('forms.editEvent.modal.insufficientFundsTitle')}
                    text={this.translate('forms.editEvent.modal.insufficientFundsMessage')}
                    text2={this.translate('forms.editEvent.modal.insufficientFundsMessage2')}
                    textCancel={this.translate('forms.editEvent.buttons.cancel')}
                    textConfirm={this.translate('forms.editEvent.buttons.continue')}
                    translate={this.translate}
                    theme={this.theme}
                    themeModal={this.themeConfirmModal}
                    themeButtons={this.themeButtons}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(EditEvent);
