import React from 'react';
import { Dimensions, Pressable, SafeAreaView, Keyboard, Text, View, Platform } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button, Slider, Image } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import RNFB from 'react-native-blob-util';
import { GOOGLE_APIS_ANDROID_KEY, GOOGLE_APIS_IOS_KEY } from 'react-native-dotenv';
// import changeNavigationBarColor from 'react-native-navigation-bar-color';
import { IUserState, IMapState, IContentState } from 'therr-react/types';
import { MapActions } from 'therr-react/redux/actions';
import { MapsService } from 'therr-react/services';
import { Categories, Content, FilePaths, IncentiveRewardKeys, IncentiveRequirementKeys } from 'therr-js-utilities/constants';
import ImageCropPicker from 'react-native-image-crop-picker';
import OctIcon from 'react-native-vector-icons/Octicons';
import YoutubePlayer from 'react-native-youtube-iframe';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import analytics from '@react-native-firebase/analytics';
import Toast from 'react-native-toast-message';
import DropDown from '../components/Input/DropDown';
// import Alert from '../components/Alert';
import translator from '../services/translator';
import { buildStyles, addMargins } from '../styles';
import { buildStyles as buildAlertStyles } from '../styles/alerts';
import { buildStyles as buildAccentStyles } from '../styles/layouts/accent';
import { buildStyles as buildFormStyles } from '../styles/forms';
import { buildStyles as buildAccentFormStyles } from '../styles/forms/accentEditForm';
import { buildStyles as buildModalStyles } from '../styles/modal';
import { buildStyles as buildMomentStyles } from '../styles/user-content/areas/editing';
import { buildStyles as buildSearchStyles } from '../styles/modal/typeAhead';
import userContentStyles from '../styles/user-content';
import spacingStyles from '../styles/layouts/spacing';
import {
    youtubeLinkRegex,
    DEFAULT_RADIUS_MEDIUM,
    MIN_RADIUS_PUBLIC,
    MAX_RADIUS_PUBLIC,
    DEFAULT_LONGITUDE,
    DEFAULT_LATITUDE,
    HAPTIC_FEEDBACK_TYPE,
} from '../constants';
import Alert from '../components/Alert';
import formatHashtags from '../utilities/formatHashtags';
import RoundInput from '../components/Input/Round';
import RoundTextInput from '../components/Input/TextInput/Round';
import HashtagsContainer from '../components/UserContent/HashtagsContainer';
import BaseStatusBar from '../components/BaseStatusBar';
import { addAddressParams, getImagePreviewPath } from '../utilities/areaUtils';
import { getUserContentUri, signImageUrl } from '../utilities/content';
import { requestOSCameraPermissions } from '../utilities/requestOSPermissions';
import BottomSheet from '../components/BottomSheet/BottomSheet';
import TherrIcon from '../components/TherrIcon';
import SearchTypeAheadResults from '../components/SearchTypeAheadResults';

const { height: viewPortHeight, width: viewportWidth } = Dimensions.get('window');

const hapticFeedbackOptions = {
    enableVibrateFallback: false,
    ignoreAndroidSystemSettings: false,
};

interface IEditSpaceDispatchProps {
    createSpace: Function;
    updateSpace: Function;
    getPlacesSearchAutoComplete: Function;
}

interface IStoreProps extends IEditSpaceDispatchProps {
    content: IContentState;
    map: IMapState;
    user: IUserState;
}

// Regular component props
export interface IEditSpaceProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IEditSpaceState {
    areaId?: string;
    addressInputText: string;
    errorMsg: string;
    hashtags: string[];
    isAddressDropdownVisible: boolean;
    isBottomSheetVisible: boolean;
    isEditingIncentives: boolean;
    inputs: any;
    isBusinessAccount: boolean;
    isCreatorAccount?: boolean;
    isSubmitting: boolean;
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
    createSpace: MapActions.createSpace,
    updateSpace: MapActions.updateSpace,
    getPlacesSearchAutoComplete: MapActions.getPlacesSearchAutoComplete,
}, dispatch);

export class EditSpace extends React.PureComponent<IEditSpaceProps, IEditSpaceState> {
    private categoryOptions: any[];
    private scrollViewRef;
    private incentiveRequirementKeys: {
        id: string;
        label: string;
        value: any;
    }[];
    private incentiveRewardKeys: {
        id: string;
        label: string;
        value: any;
    }[];
    private translate: Function;
    private throttleAddressTimeoutId: any;
    private unsubscribeNavListener;
    private theme;
    private themeAlerts = buildAlertStyles();
    private themeAccentLayout = buildAccentStyles();
    private themeModal = buildModalStyles();
    private themeMoments = buildMomentStyles();
    private themeForms = buildFormStyles();
    private themeAccentForms = buildAccentFormStyles();
    private themeSearch = buildSearchStyles({ viewPortHeight });

    constructor(props) {
        super(props);

        const { content, route } = props;
        const { area, imageDetails, isBusinessAccount, isCreatorAccount } = route.params;
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
            addressInputText: '',
            errorMsg: '',
            hashtags: area?.hashTags ? area?.hashTags?.split(',') : [],
            isAddressDropdownVisible: false,
            isBottomSheetVisible: false,
            isBusinessAccount,
            isCreatorAccount,
            isEditingIncentives: false,
            inputs: {
                isDraft: false,
                isPublic: true,
                radius: area?.radius || DEFAULT_RADIUS_MEDIUM,
                category: area?.category || '',
                message: area?.message || '',
                notificationMsg: area?.notificationMsg || '',
                hashTags: '',
                maxViews: area?.maxViews,

                // incentives
                featuredIncentiveKey: area?.featuredIncentiveKey?.toString() || undefined,
                featuredIncentiveValue: area?.featuredIncentiveValue?.toString() || undefined,
                featuredIncentiveRewardKey: area?.featuredIncentiveRewardKey?.toString() || undefined,
                featuredIncentiveRewardValue: area?.featuredIncentiveRewardValue?.toString() || undefined,
                featuredIncentiveCurrencyId: area?.featuredIncentiveCurrencyId?.toString() || undefined,
            },
            isSubmitting: false,
            previewStyleState: {},
            selectedImage: imageDetails || {},
            imagePreviewPath,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeAlerts = buildAlertStyles(props.user.settings?.mobileThemeName);
        this.themeAccentLayout = buildAccentStyles(props.user.settings?.mobileThemeName);
        this.themeModal = buildModalStyles(props.user.settings?.mobileThemeName);
        this.themeMoments = buildMomentStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeAccentForms = buildAccentFormStyles(props.user.settings?.mobileThemeName);
        this.themeSearch = buildSearchStyles({ viewPortHeight }, props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) => translator('en-us', key, params);

        // TODO: Make these IDs and values constants from shared config
        this.categoryOptions = Categories.SpaceCategories.map((category: string, index) => ({
            id: index,
            label: this.translate(category),
            value: category,
        }));
        this.incentiveRequirementKeys = [
            {
                id: 'unselectedIncentiveRequirement',
                label: this.translate('forms.editSpace.labels.unselectedIncentiveRequirement'),
                value: undefined,
            } as any].concat(([
            // {
            //     id: IncentiveRequirementKeys.VISIT_A_SPACE,
            //     label: this.translate('forms.editSpace.incentiveRequirementKeys.visitSpace'),
            //     value: IncentiveRequirementKeys.VISIT_A_SPACE,
            // },
            {
                id: IncentiveRequirementKeys.SHARE_A_MOMENT,
                label: this.translate('forms.editSpace.incentiveRequirementKeys.shareAMoment'),
                value: IncentiveRequirementKeys.SHARE_A_MOMENT,
            },
            // {
            //     id: IncentiveRequirementKeys.MAKE_A_PURCHASE,
            //     label: this.translate('forms.editSpace.incentiveRequirementKeys.makeAPurchase'),
            //     value: IncentiveRequirementKeys.MAKE_A_PURCHASE,
            // },
        ]));
        this.incentiveRewardKeys = [
            {
                id: 'unselectedIncentiveReward',
                label: this.translate('forms.editSpace.labels.unselectedIncentiveReward'),
                value: undefined,
            } as any].concat(([
            {
                id: IncentiveRewardKeys.THERR_COIN_REWARD,
                label: this.translate('forms.editSpace.incentiveRewardKeys.coinReward'),
                value: IncentiveRewardKeys.THERR_COIN_REWARD,
            },
            // {
            //     id: IncentiveRewardKeys.CURRENCY_DISCOUNT,
            //     label: this.translate('forms.editSpace.incentiveRewardKeys.currencyDiscount'),
            //     value: IncentiveRewardKeys.CURRENCY_DISCOUNT,
            // },
            // {
            //     id: IncentiveRewardKeys.PERCENTAGE_DISCOUNT,
            //     label: this.translate('forms.editSpace.incentiveRewardKeys.percentageDiscount'),
            //     value: IncentiveRewardKeys.PERCENTAGE_DISCOUNT,
            // },
        ]));
        // changeNavigationBarColor(therrTheme.colors.accent1, false, true);
    }

    componentDidMount() {
        const { areaId, isBusinessAccount } = this.state;
        const { navigation } = this.props;

        let title = isBusinessAccount
            ? this.translate('pages.editSpace.headerTitle')
            : this.translate('pages.requestSpace.headerTitle');

        if (areaId && isBusinessAccount) {
            title = this.translate('pages.editSpace.headerTitleEditing');
        }

        navigation.setOptions({
            title,
        });

        this.unsubscribeNavListener = navigation.addListener('beforeRemove', (e) => {
            const { isEditingIncentives } = this.state;
            // changeNavigationBarColor(therrTheme.colors.primary, false, true);
            if (isEditingIncentives && (e.data.action.type === 'GO_BACK' || e.data.action.type === 'POP')) {
                e.preventDefault();
                this.setState({
                    isEditingIncentives: false,
                });
            }
        });
    }

    componentWillUnmount() {
        clearTimeout(this.throttleAddressTimeoutId);
        this.unsubscribeNavListener();
    }

    isFormDisabled() {
        const { inputs, isEditingIncentives, isSubmitting } = this.state;


        let isDisabled = (
            !inputs.message ||
            isSubmitting
        );

        if (!isEditingIncentives) {
            return isDisabled;
        }

        // All or no fields are required for incentives
        if (inputs.featuredIncentiveKey ||
            inputs.featuredIncentiveValue ||
            inputs.featuredIncentiveRewardKey ||
            inputs.featuredIncentiveRewardValue ||
            inputs.featuredIncentiveCurrencyId) {
            if (inputs.featuredIncentiveRewardValue && (
                inputs.featuredIncentiveRewardValue === '0' ||
                inputs.featuredIncentiveRewardValue === '0.' ||
                inputs.featuredIncentiveRewardValue === '0.0' ||
                inputs.featuredIncentiveRewardValue?.endsWith('.')
            )) {
                return true;
            }

            return (
                !inputs.featuredIncentiveKey ||
                !inputs.featuredIncentiveValue ||
                !inputs.featuredIncentiveRewardKey ||
                !inputs.featuredIncentiveRewardValue ||
                !inputs.featuredIncentiveCurrencyId
            );
        }
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
        return signImageUrl(isPublic, {
            action: 'write',
            filename: `${FilePaths.CONTENT}/${(notificationMsg || message.substring(0, 20)).replace(/[^a-zA-Z0-9]/g,'_')}.${fileExtension}`,
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
        const { navigation } = this.props;
        this.setState({
            isEditingIncentives: true,
        });


        // This is necessary to allow intercepting the back swipe gesture and prevent it from animating
        // before preventDefault is called in the beforeRemove listener
        navigation.setOptions({
            // animation: 'none', // navigation v6
            animationEnabled: false,
            gestureEnabled: true, // must be set to true or it gets animationEnabled with animationEnabled=false
        });
    };

    onSubmitWithIncentives = () => {
        const { areaId, hashtags, isBusinessAccount, selectedImage } = this.state;
        const {
            addressReadable,
            addressLatitude,
            addressLongitude,
            addressWebsite,
            addressIntlPhone,
            addressOpeningHours,
            addressRating,
            category,
            featuredIncentiveKey,
            featuredIncentiveValue,
            featuredIncentiveRewardKey,
            featuredIncentiveRewardValue,
            featuredIncentiveCurrencyId,
            message,
            notificationMsg,
            maxViews,
            expiresAt,
            radius,
            isPublic,
        } = this.state.inputs;
        const {
            navigation,
            route,
            user,
        } = this.props;
        const {
            latitude,
            longitude,
        } = route.params;

        let createArgs: any = {
            category,
            featuredIncentiveKey,
            featuredIncentiveValue: featuredIncentiveValue ? Number(featuredIncentiveValue) : featuredIncentiveValue,
            featuredIncentiveRewardKey,
            featuredIncentiveRewardValue: featuredIncentiveRewardValue ? Number(featuredIncentiveRewardValue) : featuredIncentiveRewardValue,
            featuredIncentiveCurrencyId,
            fromUserId: user.details.id,
            isPublic,
            message,
            notificationMsg,
            hashTags: hashtags.join(','),
            latitude: addressLatitude || latitude,
            longitude: addressLongitude || longitude,
            maxViews,
            radius,
            expiresAt,
        };

        this.setState({
            errorMsg: '',
        });

        if (!this.isFormDisabled()) {
            ReactNativeHapticFeedback.trigger(HAPTIC_FEEDBACK_TYPE, hapticFeedbackOptions);

            this.setState({
                isSubmitting: true,
            });

            createArgs = addAddressParams(createArgs, {
                addressReadable,
                addressLatitude,
                addressLongitude,
                addressWebsite,
                addressIntlPhone,
                addressOpeningHours,
                addressRating,
            });

            const createSpaceMethod = isBusinessAccount ? this.props.createSpace : MapsService.requestClaim;

            (selectedImage?.path ? this.signAndUploadImage(createArgs) : Promise.resolve(createArgs)).then((modifiedCreateArgs) => {
                const createOrUpdatePromise = areaId
                    ? this.props.updateSpace(areaId, modifiedCreateArgs)
                    : createSpaceMethod(modifiedCreateArgs);
                createOrUpdatePromise
                    .then(() => {
                        if (isBusinessAccount) {
                            Toast.show({
                                type: 'success',
                                text1: areaId ? this.translate('alertTitles.areaUpdatedSuccess') : this.translate('alertTitles.spaceCreatedSuccess'),
                                text2: this.translate('alertMessages.spaceUpdatedSuccess'),
                                visibilityTime: 3500,
                            });
                            analytics().logEvent('space_create', {
                                userId: user.details.id,
                                momentLongitude: longitude,
                                momentLatitude: latitude,
                                radius,
                                isPublic,
                                category,
                            }).catch((err) => console.log(err));
                        } else {
                            Toast.show({
                                type: 'success',
                                text1: this.translate('alertTitles.spaceRequestSuccess'),
                                text2: this.translate('alertMessages.spaceRequestSuccess'),
                                visibilityTime: 3500,
                            });
                            analytics().logEvent('space_request', {
                                userId: user.details.id,
                                momentLongitude: longitude,
                                momentLatitude: latitude,
                                radius,
                                isPublic,
                                category,
                            }).catch((err) => console.log(err));
                        }

                        setTimeout(() => {
                            this.props.navigation.navigate('Map', {
                                shouldShowPreview: true,
                            });
                        }, 500);
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
                        } else if (error.statusCode >= 500) {
                            this.setState({
                                errorMsg: this.translate('forms.editSpace.backendErrorMessage'),
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

        if (name === 'featuredIncentiveKey') {
            if (value === 'visit-a-space') {
                newInputChanges.featuredIncentiveValue = '1';
            } else if (value === 'share-a-moment') {
                newInputChanges.featuredIncentiveValue = '1';
            } else if (value === 'make-a-purchase') {
                newInputChanges.featuredIncentiveValue = '1';
            } else {
                newInputChanges.featuredIncentiveKey = undefined;
                newInputChanges.featuredIncentiveValue = undefined;
                newInputChanges.featuredIncentiveCurrencyId = undefined;
                newInputChanges.featuredIncentiveRewardKey = undefined;
                newInputChanges.featuredIncentiveRewardValue = undefined;
            }
        }

        if (name === 'featuredIncentiveValue') {
            newInputChanges.featuredIncentiveValue = newInputChanges.featuredIncentiveValue?.replace(/[^0-9]/g, '');
        }

        if (name === 'featuredIncentiveRewardKey') {
            if (value === 'therr-coin-reward') {
                newInputChanges.featuredIncentiveCurrencyId = 'TherrCoin';
            } else if (value === 'currency-discount') {
                newInputChanges.featuredIncentiveCurrencyId = 'USD';
            } else if (value === 'percentage-discount') {
                newInputChanges.featuredIncentiveCurrencyId = 'percent';
            } else {
                newInputChanges.featuredIncentiveCurrencyId = undefined;
            }
        }

        if (name === 'featuredIncentiveRewardValue' && value) {
            const val = value.replace(/([^0-9.]+)/, '').replace(/^(\.)$/, '0.').replace(/^0$/, '');
            const match = /(\d{0,7})[^.]*((?:\.\d{0,2})?)/g.exec(val);
            if (match) {
                const sanitizedVal = match[1] + match[2];
                newInputChanges.featuredIncentiveRewardValue = sanitizedVal;
            }
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
                modifiedInputs.address = formatted_address;
                modifiedInputs.addressReadable = formatted_address;
            }
            if (!modifiedInputs.notificationMsg && result?.name) {
                modifiedInputs.notificationMsg = result.name;
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
            }, () => this.toggleBottomSheet());
        }
    };

    toggleBottomSheet = () => {
        const { isBottomSheetVisible } = this.state;
        this.setState({
            isBottomSheetVisible: !isBottomSheetVisible,
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
            this.toggleBottomSheet();
            // TODO: Handle Permissions denied
            if (e?.message.toLowerCase().includes('cancel')) {
                console.log('canceled');
            }
        });
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

        this.setSearchDropdownVisibility(false);
    };

    onOuterContainerPress = () => {
        Keyboard.dismiss();
    };

    getContinueButtonConfig = (): {
        title: string;
        icon: string,
        iconRight: boolean,
        iconStyle: any,
        onPress: any,
    } => {
        const { isEditingIncentives, isBusinessAccount } = this.state;

        if (!isEditingIncentives && isBusinessAccount) {
            return {
                title: this.translate('forms.editSpace.buttons.next'),
                icon: 'chevron-right',
                iconStyle: this.themeAccentForms.styles.nextButtonIcon,
                iconRight: true,
                onPress: () => this.onSubmitBaseDetails(),
            };
        }

        return {
            title: this.translate('forms.editSpace.buttons.submit'),
            icon: 'send',
            iconStyle: this.themeAccentForms.styles.submitButtonIcon,
            iconRight: false,
            onPress: this.onSubmitWithIncentives,
        };
    };

    renderEditingForm = () => {
        const {
            addressInputText,
            errorMsg,
            hashtags,
            inputs,
            isBusinessAccount,
            isAddressDropdownVisible,
            previewLinkId,
            previewStyleState,
            imagePreviewPath,
        } = this.state;
        const { map } = this.props;

        return (
            <>
                <Pressable style={this.themeAccentLayout.styles.container} onPress={this.onOuterContainerPress}>
                    {
                        !!imagePreviewPath &&
                        <View style={this.themeMoments.styles.mediaContainer}>
                            <Image
                                source={{ uri: imagePreviewPath }}
                                style={this.themeMoments.styles.mediaImage}
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
                            !!imagePreviewPath ? 'forms.editSpace.buttons.replaceImage' : 'forms.editSpace.buttons.addImage'
                        )}
                        icon={
                            <TherrIcon
                                name="camera"
                                size={23}
                                style={{ color: this.theme.colors.primary, paddingRight: 8 }}
                            />
                        }
                        onPress={() => this.toggleBottomSheet()}
                        raised={false}
                    />
                    <Text style={this.theme.styles.sectionDescriptionNote}>
                        {this.translate('forms.editSpace.labels.addImageNote')}
                    </Text>
                    <View style={{
                        position: 'relative',
                        marginBottom: !isBusinessAccount ? 50 : 0,
                    }}>
                        {
                            !isBusinessAccount &&
                            <>
                                <RoundInput
                                    autoFocus
                                    maxLength={100}
                                    placeholder={this.translate(
                                        'forms.editSpace.labels.address'
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
                            </>
                        }
                        <RoundInput
                            autoFocus={isBusinessAccount}
                            maxLength={100}
                            placeholder={this.translate(
                                'forms.editSpace.labels.notificationMsg'
                            )}
                            value={inputs.notificationMsg}
                            onChangeText={(text) =>
                                this.onInputChange('notificationMsg', text)
                            }
                            themeForms={this.themeForms}
                        />
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
                        <RoundTextInput
                            placeholder={this.translate(
                                'forms.editSpace.labels.message'
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
                            autoCorrect={false}
                            errorStyle={this.theme.styles.displayNone}
                            placeholder={this.translate(
                                'forms.editSpace.labels.hashTags'
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
                    </View>
                    {
                        isBusinessAccount && <View style={this.themeForms.styles.inputSliderContainer}>
                            <Slider
                                value={inputs.radius}
                                onValueChange={(value) => this.onSliderChange('radius', value)}
                                maximumValue={MAX_RADIUS_PUBLIC}
                                minimumValue={MIN_RADIUS_PUBLIC}
                                step={1}
                                thumbStyle={{ backgroundColor: this.theme.colors.accentBlue, height: 20, width: 20 }}
                                thumbTouchSize={{ width: 30, height: 30 }}
                                minimumTrackTintColor={this.theme.colorVariations.accentBlueLightFade}
                                maximumTrackTintColor={this.theme.colorVariations.accentBlueHeavyFade}
                                onSlidingStart={Keyboard.dismiss}
                            />
                            <Text style={this.themeForms.styles.inputLabelDark}>
                                {`${this.translate('forms.editSpace.labels.radius', { meters: inputs.radius })}`}
                            </Text>
                            <Text style={this.themeForms.styles.inputLabelDark}>
                                {`${this.translate('forms.editSpace.labels.cost', { pointCost: 0 })}`}
                            </Text>
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
                    {/* <AccentInput
                        placeholder={this.translate(
                            'forms.editSpace.labels.maxProximity'
                        )}
                        value={inputs.maxProximity}
                        onChangeText={(text) =>
                            this.onInputChange('maxProximity', text)
                        }
                    />
                    {/* <AccentInput
                        placeholder={this.translate(
                            'forms.editSpace.labels.maxViews'
                        )}
                        value={inputs.maxViews}
                        onChangeText={(text) =>
                            this.onInputChange('maxViews', text)
                        }
                    />
                    <AccentInput
                        placeholder={this.translate(
                            'forms.editSpace.labels.expiresAt'
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
                        <Text style={this.themeAccentForms.styles.previewHeader}>{this.translate('pages.editSpace.previewHeader')}</Text>
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

    renderEditingIncentives = () => {
        const {
            inputs,
            errorMsg,
        } = this.state;

        return (
            <>
                <Pressable style={this.themeAccentLayout.styles.container} onPress={Keyboard.dismiss}>
                    <Text style={this.theme.styles.sectionTitleCenter}>
                        {this.translate('forms.editSpace.labels.addIncentivesNote')}
                    </Text>
                    <Text style={this.theme.styles.sectionDescriptionCentered}>
                        {this.translate('forms.editSpace.labels.addIncentivesNote2')}
                    </Text>
                    <Text style={this.theme.styles.sectionDescriptionNote}>
                        {this.translate('forms.editSpace.labels.addIncentivesNoteEx')}
                    </Text>
                    <Alert
                        containerStyles={addMargins({
                            marginBottom: 24,
                        })}
                        isVisible={!!(errorMsg)}
                        message={errorMsg}
                        type={'error'}
                        themeAlerts={this.themeAlerts}
                    />
                    <Text style={this.theme.styles.sectionLabel}>
                        {this.translate('forms.editSpace.labels.incentiveRequirement')}:
                    </Text>
                    <View style={[this.themeForms.styles.input, { display: 'flex', flexDirection: 'row', alignItems: 'center' }]}>
                        <DropDown
                            onChange={(newValue) =>
                                this.onInputChange('featuredIncentiveKey', newValue || undefined)
                            }
                            options={this.incentiveRequirementKeys}
                            formStyles={this.themeForms.styles}
                            initialValue={inputs.featuredIncentiveKey}
                        />
                    </View>
                    {
                        inputs.featuredIncentiveKey &&
                        <>
                            <Text style={this.theme.styles.sectionLabel}>
                                {this.translate('forms.editSpace.labels.featuredIncentiveValue')}:
                            </Text>
                            <RoundInput
                                maxLength={2}
                                placeholder={this.translate(
                                    'forms.editSpace.labels.featuredIncentiveValuePlaceholder'
                                )}
                                value={inputs.featuredIncentiveValue}
                                onChangeText={(text) =>
                                    this.onInputChange('featuredIncentiveValue', text)
                                }
                                themeForms={this.themeForms}
                            />
                        </>
                    }
                    {
                        inputs.featuredIncentiveValue &&
                        <>
                            <Text style={this.theme.styles.sectionLabel}>
                                {this.translate('forms.editSpace.labels.incentiveReward')}:
                            </Text>
                            <View style={[this.themeForms.styles.input, { display: 'flex', flexDirection: 'row', alignItems: 'center' }]}>
                                <DropDown
                                    onChange={(newValue) =>
                                        this.onInputChange('featuredIncentiveRewardKey', newValue || undefined)
                                    }
                                    options={this.incentiveRewardKeys}
                                    formStyles={this.themeForms.styles}
                                    initialValue={inputs.featuredIncentiveRewardKey}
                                />
                            </View>
                        </>
                    }
                    {
                        inputs.featuredIncentiveRewardKey &&
                        <>
                            <Text style={this.theme.styles.sectionLabel}>
                                {this.translate('forms.editSpace.labels.featuredIncentiveRewardValue')}:
                            </Text>
                            <RoundInput
                                autoFocus
                                maxLength={6}
                                placeholder={this.translate(
                                    'forms.editSpace.labels.featuredIncentiveRewardValuePlaceholder'
                                )}
                                value={inputs.featuredIncentiveRewardValue}
                                onChangeText={(text) =>
                                    this.onInputChange('featuredIncentiveRewardValue', text)
                                }
                                themeForms={this.themeForms}
                            />
                            <Text style={this.theme.styles.sectionLabel}>
                                {this.translate('forms.editSpace.labels.featuredIncentiveCurrencyId')}:
                            </Text>
                            <RoundInput
                                disabled
                                maxLength={100}
                                placeholder={this.translate(
                                    'forms.editSpace.labels.featuredIncentiveCurrencyIdPlaceholder'
                                )}
                                value={inputs.featuredIncentiveCurrencyId}
                                onChangeText={(text) =>
                                    this.onInputChange('featuredIncentiveCurrencyId', text)
                                }
                                themeForms={this.themeForms}
                            />
                        </>
                    }
                </Pressable>
            </>
        );
    };

    render() {
        const { navigation } = this.props;
        const {
            isBottomSheetVisible,
            isEditingIncentives,
        } = this.state;
        const continueButtonConfig = this.getContinueButtonConfig();

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        keyboardShouldPersistTaps="always"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={[this.theme.styles.bodyFlex, this.themeAccentLayout.styles.bodyEdit, this.theme.styles.scrollView]}
                        contentContainerStyle={[
                            this.theme.styles.bodyScroll,
                            this.themeAccentLayout.styles.bodyEditScroll,
                            { backgroundColor: this.theme.colorVariations.primary2Fade },
                        ]}
                    >
                        {
                            isEditingIncentives ? this.renderEditingIncentives() : this.renderEditingForm()
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
                        isVisible={isBottomSheetVisible}
                        onRequestClose={this.toggleBottomSheet}
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
                                'forms.editSpace.buttons.selectExisting'
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
                                'forms.editSpace.buttons.captureNew'
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

export default connect(mapStateToProps, mapDispatchToProps)(EditSpace);
