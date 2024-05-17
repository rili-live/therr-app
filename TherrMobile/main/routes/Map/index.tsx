import React, { Ref } from 'react';
import { Dimensions, PermissionsAndroid, Keyboard, Platform, SafeAreaView } from 'react-native';
import { StackActions } from '@react-navigation/native';
import MapView from 'react-native-map-clustering';
import AnimatedOverlay from 'react-native-modal-overlay';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Toast from 'react-native-toast-message';
import { MapsService, UsersService, PushNotificationsService } from 'therr-react/services';
import { AccessCheckType, IContentState, IMapState as IMapReduxState, INotificationsState, IReactionsState, IUserState } from 'therr-react/types';
import { IAreaType } from 'therr-js-utilities/types';
import { ErrorCodes, MetricNames } from 'therr-js-utilities/constants';
import { MapActions, ReactionActions, UserInterfaceActions } from 'therr-react/redux/actions';
import { AccessLevels, Location } from 'therr-js-utilities/constants';
import Geolocation from 'react-native-geolocation-service';
import AnimatedLoader from 'react-native-animated-loader';
import { distanceTo } from 'geolocation-utils';
import ImageCropPicker from 'react-native-image-crop-picker';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { GOOGLE_APIS_ANDROID_KEY, GOOGLE_APIS_IOS_KEY } from 'react-native-dotenv';
import { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import MapActionButtons, { ICreateAction as ICreateMomentAction } from './MapActionButtons';
import Alert from '../../components/Alert';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import { ILocationState } from '../../types/redux/location';
import LocationActions from '../../redux/actions/LocationActions';
import translator from '../../services/translator';
import {
    ANIMATE_TO_REGION_DURATION,
    ANIMATE_TO_REGION_DURATION_SLOW,
    PRIMARY_LATITUDE_DELTA,
    PRIMARY_LONGITUDE_DELTA,
    MIN_LOAD_TIMEOUT,
    MOMENTS_REFRESH_THROTTLE_MS,
    DEFAULT_LONGITUDE,
    DEFAULT_LATITUDE,
    MAX_ANIMATION_LATITUDE_DELTA,
    ANIMATE_TO_REGION_DURATION_FAST,
    MAX_ANIMATION_LONGITUDE_DELTA,
    getAndroidChannel,
    AndroidChannelIds,
    PressActionIds,
    MIN_TIME_BTW_CHECK_INS_MS,
    HAPTIC_FEEDBACK_TYPE,
    PEOPLE_CAROUSEL_TABS,
} from '../../constants';
import { buildStyles, loaderStyles } from '../../styles';
import { buildStyles as buildAlertStyles } from '../../styles/alerts';
import { buildStyles as buildBottomSheetStyles } from '../../styles/bottom-sheet';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildLoaderStyles } from '../../styles/loaders';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildDisclosureStyles } from '../../styles/modal/locationDisclosure';
import { buildStyles as buildTourStyles } from '../../styles/modal/tourModal';
import { buildStyles as buildViewAreaStyles } from '../../styles/user-content/areas/viewing';
import { buildStyles as buildSearchStyles } from '../../styles/modal/typeAhead';
import mapStyles from '../../styles/map';
import requestLocationServiceActivation from '../../utilities/requestLocationServiceActivation';
import {
    requestOSMapPermissions,
    requestOSCameraPermissions,
    isLocationPermissionGranted,
    checkAndroidPermission,
} from '../../utilities/requestOSPermissions';
// import FiltersButtonGroup from '../../components/FiltersButtonGroup';
import BaseStatusBar from '../../components/BaseStatusBar';
import SearchTypeAheadResults from '../../components/SearchTypeAheadResults';
import SearchThisAreaButtonGroup from '../../components/SearchThisAreaButtonGroup';
import LocationUseDisclosureModal from '../../components/Modals/LocationUseDisclosureModal';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import eula from './EULA';
import UsersActions from '../../redux/actions/UsersActions';
import TouringModal from '../../components/Modals/TouringModal';
import BottomSheetPlus, { defaultSnapPoints } from '../../components/BottomSheet/BottomSheetPlus';
import MapBottomSheetContent, { IMapSheetContentTypes } from '../../components/BottomSheet/MapBottomSheetContent';
import TherrMapView from './TherrMapView';
import { isMyContent } from '../../utilities/content';
import getNearbySpaces from '../../utilities/getNearbySpaces';
import { sendForegroundNotification } from '../../utilities/pushNotifications';
import QuickFiltersList from '../../components/QuickFiltersList';
import { getInitialAuthorFilters, getInitialCategoryFilters, getInitialVisibilityFilters } from '../../utilities/getInitialFilters';

const { height: viewPortHeight, width: viewportWidth } = Dimensions.get('window');
const earthLoader = require('../../assets/earth-loader.json');
const AREAS_SEARCH_COUNT = Platform.OS === 'android' ? 250 : 400;
const AREAS_SEARCH_COUNT_ZOOMED = Platform.OS === 'android' ? 100 : 200;
const MAX_RENDERED_CIRCLES = (2 * AREAS_SEARCH_COUNT_ZOOMED) - 1;

// TODO: Cache users last location and default there
const DEFAULT_MAP_SEARCH = {
    description: 'United States',
    matched_substrings: [{
        length: 13,
        offset: 0,
    }],
    place_id: 'ChIJCzYy5IS16lQRQrfeQ5K5Oxw',
    reference: 'ChIJCzYy5IS16lQRQrfeQ5K5Oxw',
    structured_formatting: {
        main_text: 'United States',
        main_text_matched_substrings: [{
            length: 13,
            offset: 0,
        }],
    },
    terms: [{
        offset: 0,
        value: 'United States',
    }],
    types: ['country', 'political', 'geocode'],
};

const hapticFeedbackOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};


interface IMapDispatchProps {
    captureClickTarget: Function;
    createOrUpdateMomentReaction: Function;
    createOrUpdateSpaceReaction: Function;
    findEventReactions: Function;
    findMomentReactions: Function;
    findSpaceReactions: Function;
    updateUserCoordinates: Function;
    updateMapViewCoordinates: Function;
    setMapFilters: Function;
    searchEvents: Function;
    searchMoments: Function;
    searchSpaces: Function;
    setInitialUserLocation: Function;
    setSearchDropdownVisibility: Function;
    deleteMoment: Function;
    createSpaceCheckInMetrics: Function;
    updateGpsStatus: Function;
    updateLocationDisclosure: Function;
    updateLocationPermissions: Function;
    updateUser: Function;
    updateTour: Function;
    updateFirstTimeUI: Function;
}

interface IStoreProps extends IMapDispatchProps {
    content: IContentState;
    location: ILocationState;
    map: IMapReduxState;
    notifications: INotificationsState;
    reactions: IReactionsState;
    user: IUserState;
}

// Regular component props
export interface IMapProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IMapState {
    activeQuickFilterId: string;
    alertMessage: string;
    areButtonsVisible: boolean;
    areLayersVisible: boolean;
    bottomSheetContentType: IMapSheetContentTypes;
    bottomSheetIsTransparent: boolean;
    bottomSheetSnapPoints: (string | number)[];
    exchangeRate: number;
    region: {
        latitude?: number,
        longitude?: number,
        latitudeDelta?: number,
        longitudeDelta?: number,
    };
    shouldFollowUserLocation: boolean;
    isConfirmModalVisible: boolean;
    isAreaAlertVisible: boolean;
    isScrollEnabled: boolean;
    isLocationReady: boolean;
    isSearchLoading: boolean;
    isLocationUseDisclosureModalVisible: boolean;
    isMapReady: boolean;
    isMinLoadTimeComplete: boolean;
    isSearchThisLocationBtnVisible: boolean;
    nearbySpaces: {
        id: string;
        title: string;
        featuredIncentiveRewardValue?: number;
    }[];
    shouldIgnoreSearchThisAreaButton: boolean;
    shouldRenderMapCircles: boolean;
    shouldShowCreateActions: boolean;
    lastMomentsRefresh?: number,
    lastLocationSendForProcessing?: number,
    lastLocationSendForProcessingCoords?: {
        longitude: number,
        latitude: number,
    },
    circleCenter: {longitude: number, latitude: number};
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    location: state.location,
    map: state.map,
    notifications: state.notifications,
    reactions: state.reactions,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            captureClickTarget: UserInterfaceActions.captureClickEvent,
            updateUserCoordinates: MapActions.updateUserCoordinates,
            updateMapViewCoordinates: MapActions.updateMapViewCoordinates,
            searchEvents: MapActions.searchEvents,
            searchMoments: MapActions.searchMoments,
            searchSpaces: MapActions.searchSpaces,
            setInitialUserLocation: MapActions.setInitialUserLocation,
            setSearchDropdownVisibility: MapActions.setSearchDropdownVisibility,
            setMapFilters: MapActions.setMapFilters,
            deleteMoment: MapActions.deleteMoment,
            createSpaceCheckInMetrics: MapActions.createSpaceCheckInMetrics,
            createOrUpdateMomentReaction: ReactionActions.createOrUpdateMomentReaction,
            createOrUpdateSpaceReaction: ReactionActions.createOrUpdateSpaceReaction,
            findEventReactions: ReactionActions.findEventReactions,
            findMomentReactions: ReactionActions.findMomentReactions,
            findSpaceReactions: ReactionActions.findSpaceReactions,
            updateGpsStatus: LocationActions.updateGpsStatus,
            updateLocationDisclosure: LocationActions.updateLocationDisclosure,
            updateLocationPermissions: LocationActions.updateLocationPermissions,
            updateUser: UsersActions.update,
            updateTour: UsersActions.updateTour,
            updateFirstTimeUI: UsersActions.updateFirstTimeUI,
        },
        dispatch
    );

class Map extends React.PureComponent<IMapProps, IMapState> {
    private bottomSheetRef: React.RefObject<BottomSheetMethods> | undefined;
    private scrollAnimationRef;
    private localeShort = 'en-US'; // TODO: Derive from user locale
    private initialAuthorFilters;
    private initialCategoryFilters;
    private initialVisibilityFilters;
    private mapRef: any;
    private mapWatchId;
    private theme = buildStyles();
    private themeAlerts = buildAlertStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeBottomSheet = buildBottomSheetStyles();
    private themeViewArea = buildViewAreaStyles();
    private themeButtons = buildButtonStyles();
    private themeLoader = buildLoaderStyles();
    private themeMenu = buildMenuStyles();
    private themeDisclosure = buildDisclosureStyles();
    private themeTour = buildTourStyles();
    private themeSearch = buildSearchStyles({ viewPortHeight });
    private timeoutIdPreviewRegion;
    private timeoutIdLocationReady;
    private timeoutIdRefreshMoments;
    private timeoutIdShowMomentAlert;
    private timeoutIdSearchButton;
    private timeoutIdWaitForSearchSelect;
    private translate: Function;
    private unsubscribeBlurListener: any;
    private unsubscribeFocusListener: any;
    private unsubscribeNavigationListener: any;
    private previewScrollIndex: number = 0;
    private quickFilterButtons: {
        index: string;
        icon: string;
        title: string;
    }[];

    constructor(props) {
        super(props);

        const routeLongitude = props.route?.params?.longitude;
        const routeLatitude = props.route?.params?.latitude;

        this.state = {
            activeQuickFilterId: '0',
            alertMessage: 'Error',
            areButtonsVisible: true,
            areLayersVisible: false,
            bottomSheetContentType: 'nearby',
            bottomSheetIsTransparent: false,
            bottomSheetSnapPoints: defaultSnapPoints,
            exchangeRate: 0.25,
            region: {},
            shouldFollowUserLocation: false,
            isConfirmModalVisible: false,
            isScrollEnabled: true,
            isAreaAlertVisible: false,
            isLocationUseDisclosureModalVisible: false,
            isLocationReady: false,
            isSearchLoading: false,
            isMapReady: false,
            isMinLoadTimeComplete: false,
            isSearchThisLocationBtnVisible: false,
            nearbySpaces: [],
            shouldIgnoreSearchThisAreaButton: false,
            shouldRenderMapCircles: false,
            shouldShowCreateActions: false,
            // Note: This is essentially the same as redux state `location.user.longitude/latitude` (plus defaults)
            // We should probably consolidate this into redux
            circleCenter: {
                longitude: routeLongitude || props?.user?.details?.lastKnownLongitude || DEFAULT_LONGITUDE,
                latitude: routeLatitude || props?.user?.details?.lastKnownLatitude || DEFAULT_LATITUDE,
            },
        };

        this.reloadTheme();
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
        this.initialAuthorFilters = getInitialAuthorFilters(this.translate);
        this.initialCategoryFilters = getInitialCategoryFilters(this.translate);
        this.initialVisibilityFilters = getInitialVisibilityFilters(this.translate);
        this.quickFilterButtons = [
            {
                index: '0',
                icon: 'globe',
                title: this.translate('pages.map.filterButtons.all'),
            },
            {
                index: '1',
                icon: 'group',
                title: this.translate('pages.map.filterButtons.people'),
            },
            {
                index: '2',
                icon: 'utensils',
                title: this.translate('pages.map.filterButtons.places'),
            },
            {
                index: '3',
                icon: 'calendar',
                title: this.translate('pages.map.filterButtons.events'),
            },
            {
                index: '4',
                icon: 'music',
                title: this.translate('pages.map.filterButtons.music'),
            },
        ];
    }

    componentDidMount = async () => {
        const {
            navigation,
            setSearchDropdownVisibility,
            updateFirstTimeUI,
            updateTour,
            route,
            user,
        } = this.props;
        UsersService.getUserInterests().then((response) => {
            if (!response?.data?.length) {
                navigation.navigate('ManagePreferences');
            }
        });
        UsersService.getExchangeRate().then((response) => {
            this.setState({
                exchangeRate: response.data?.exchangeRate,
            });
        }).catch((err) => console.log(`Failed to get exchange rate: ${err.message}`));

        if (user.details?.loginCount < 3 && !user.settings?.hasCompletedFTUI) {
            updateTour(user.details.id, {
                isTouring: true,
            });
            updateFirstTimeUI(true);
        }

        if (!route.params?.longitude || !route.params?.latitude) {
            if (user?.details?.lastKnownLatitude && user?.details?.lastKnownLongitude) {
                // Load the users last known location
                // Note: See getLongitudeDelta()
                // This converts degrees to miles then miles to meters (times 4 for extended search)
                const radiusMeters = 4 * MAX_ANIMATION_LATITUDE_DELTA * 69 * 1609.34;
                this.handleSearchThisLocation(radiusMeters, user?.details?.lastKnownLatitude, user?.details?.lastKnownLongitude);
            } else {
                this.handleSearchSelect(DEFAULT_MAP_SEARCH);
            }
        } else {
            this.handleSearchThisLocation(undefined, route.params?.latitude, route.params?.longitude);
        }

        this.unsubscribeNavigationListener = navigation.addListener('state', () => {
            setSearchDropdownVisibility(false);
            clearTimeout(this.timeoutIdLocationReady);
            this.setState({
                isMinLoadTimeComplete: true,
                isLocationReady: true,
            });
        });

        this.unsubscribeBlurListener = navigation.addListener('blur', () => {
            this.clearTimeouts();
        });

        this.unsubscribeFocusListener = navigation.addListener('focus', () => {
            const { map, location, route: inScopeRoute } = this.props;
            this.expandBottomSheet(-1);
            this.setState({
                areButtonsVisible: true,
            });
            setSearchDropdownVisibility(false);

            if (inScopeRoute?.params?.shouldInitiateLocation) {
                this.handleGpsRecenterPress();
            } else if (inScopeRoute?.params?.shouldShowPreview &&
                ((map?.latitude && map?.longitude) || (location?.user?.latitude && location?.user?.longitude))) {
                navigation.setParams({
                    shouldShowPreview: false,
                });

                const searchRadiusMeters = 4 * MAX_ANIMATION_LATITUDE_DELTA * 69 * 1609.34;
                const latitude = map?.latitude || location?.user?.latitude;
                const longitude = map?.longitude || location?.user?.longitude;
                this.handleSearchThisLocation(searchRadiusMeters, latitude, longitude)
                    .finally(() => {
                        // TODO: Determine if this needs to be canceled when navigating to a new view
                        this.mapRef.props.onPress({
                            nativeEvent: {
                                coordinate: {
                                    latitude: latitude,
                                    longitude: longitude,
                                },
                            },
                        }, true);
                    });
            }

            clearTimeout(this.timeoutIdLocationReady);
        });

        navigation.setOptions({
            title: this.translate('pages.map.headerTitle'),
        });

        this.timeoutIdLocationReady = setTimeout(() => {
            this.setState({
                isMinLoadTimeComplete: true,
                isLocationReady: true,
                isSearchThisLocationBtnVisible: false,
            });
        }, MIN_LOAD_TIMEOUT);
    };

    componentDidUpdate(prevProps: IMapProps) {
        const { user } = this.props;

        if (prevProps.user?.settings?.mobileThemeName !== user?.settings?.mobileThemeName) {
            this.reloadTheme();
        }
    }

    componentWillUnmount() {
        Geolocation.clearWatch(this.mapWatchId);
        this.clearTimeouts();
        if (this.unsubscribeNavigationListener) {
            this.unsubscribeNavigationListener();
        }
        if (this.unsubscribeBlurListener) {
            this.unsubscribeBlurListener();
        }
        if (this.unsubscribeFocusListener) {
            this.unsubscribeFocusListener();
        }
        this.setState({
            isMapReady: false,
        });
    }

    clearTimeouts = () => {
        clearTimeout(this.timeoutIdPreviewRegion);
        clearTimeout(this.timeoutIdLocationReady);
        clearTimeout(this.timeoutIdSearchButton);
        clearTimeout(this.timeoutIdRefreshMoments);
        clearTimeout(this.timeoutIdShowMomentAlert);
        clearTimeout(this.timeoutIdWaitForSearchSelect);
    };

    reloadTheme = (shouldForceUpdate: boolean = false) => {
        const themeName = this.props.user.settings?.mobileThemeName;
        this.theme = buildStyles(themeName);
        this.themeAlerts = buildAlertStyles(themeName);
        this.themeConfirmModal = buildConfirmModalStyles(themeName);
        this.themeBottomSheet = buildBottomSheetStyles(themeName);
        this.themeViewArea = buildViewAreaStyles(themeName);
        this.themeButtons = buildButtonStyles(themeName);
        this.themeLoader = buildLoaderStyles(themeName);
        this.themeMenu = buildMenuStyles(themeName);
        this.themeDisclosure = buildDisclosureStyles(themeName);
        this.themeTour = buildTourStyles(themeName);
        this.themeSearch = buildSearchStyles({ viewPortHeight }, themeName);

        if (shouldForceUpdate) {
            this.forceUpdate();
        }
    };

    animateToWithHelp = (doAnimate) => {
        if (this.state.isMapReady) {
            this.setState({
                shouldIgnoreSearchThisAreaButton: true,
            });
            clearTimeout(this.timeoutIdSearchButton);
            clearTimeout(this.timeoutIdWaitForSearchSelect);
            doAnimate();
            this.timeoutIdWaitForSearchSelect = setTimeout(() => {
                this.setState({
                    shouldIgnoreSearchThisAreaButton: false,
                });
            }, ANIMATE_TO_REGION_DURATION_SLOW + 1000); // Add some buffer room
        }
    };

    hasNoMapFilters = () => {
        const { map } = this.props;
        const mapFilters = {
            filtersAuthor: map.filtersAuthor,
            filtersCategory: map.filtersCategory,
            filtersVisibility: map.filtersVisibility,
        };

        return (!mapFilters.filtersAuthor?.length && !mapFilters.filtersCategory?.length && !mapFilters.filtersVisibility?.length)
        || (mapFilters.filtersAuthor[0]?.isChecked && mapFilters.filtersCategory[0]?.isChecked && mapFilters.filtersVisibility[0]?.isChecked);
    };

    getFilteredAreas = (areas, mapFilters) => {
        // Filter for duplicates
        if (this.hasNoMapFilters()) {
            return areas;
        }

        // Only requires one loop to check each area
        const filteredAreasMap = {};
        Object.values(areas).forEach((area: any) => {
            if (this.shouldRenderArea(area, mapFilters)) {
                filteredAreasMap[area.id] = area;
            }
        });

        if (areas.length === Object.values(filteredAreasMap).length) {
            // Prevents unnecessary rerenders
            return areas;
        }

        return filteredAreasMap;
    };

    shouldRenderArea = (area, mapFilters) => {
        const { user } = this.props;
        let passesFilterAuthor = true;
        let passesFilterCategory = true;
        let passesFilterVisibility = true;

        if (!area.latitude || !area.longitude) {
            return false;
        }

        // Filters have been populated and "Select All" is not checked
        if (mapFilters.filtersAuthor?.length && !mapFilters.filtersAuthor[0]?.isChecked) {
            passesFilterAuthor = mapFilters.filtersAuthor.some(filter => {
                if (!filter.isChecked) {
                    return false;
                }

                return (isMyContent(area, user) && filter.name === 'me') || (!isMyContent(area, user) && filter.name === 'notMe');
            });
        }

        // Filters have been populated and "Select All" is not checked
        if (mapFilters.filtersCategory.length && !mapFilters.filtersCategory[0]?.isChecked) {
            passesFilterCategory = mapFilters.filtersCategory.some(filter => {
                if (!filter.isChecked) {
                    return false;
                }

                return area.category === filter.name;
            });
        }

        // Filters have been populated and "Select All" is not checked
        if (mapFilters.filtersVisibility.length && !mapFilters.filtersVisibility[0]?.isChecked) {
            const shouldHide = mapFilters.filtersVisibility.filter((f) => ['events', 'moments', 'spaces'].includes(f.name))
                .every(filter => !filter.isChecked);
            const shouldHide2 = mapFilters.filtersVisibility.filter((f) => ['events', 'moments', 'spaces'].includes(f.name))
                .some(filter => !filter.isChecked && filter.name === area.areaType);
            passesFilterVisibility = !shouldHide && !shouldHide2 && mapFilters.filtersVisibility.some(filter => {
                if (!filter.isChecked) {
                    return false;
                }

                return (area.isPublic && filter.name === 'public') || (!area.isPublic && filter.name === 'private');
            });
        }

        return passesFilterAuthor && passesFilterCategory && passesFilterVisibility;
    };

    goToMoments = () => {
        const { navigation } = this.props;

        navigation.navigate('Areas');
    };

    goToHome = () => {
        const { navigation } = this.props;

        navigation.dispatch(
            StackActions.replace('Areas', {})
        );
    };

    goToNotifications = () => {
        const { navigation } = this.props;

        this.setState({
            shouldShowCreateActions: false,
        });

        navigation.navigate('Notifications');
    };

    cancelAreaAlert = () => {
        clearTimeout(this.timeoutIdShowMomentAlert);
        this.setState({
            isAreaAlertVisible: false,
        });
    };

    expandBottomSheet = (index = 1, shouldToggle = false, content: IMapSheetContentTypes = 'nearby') => {
        const { areButtonsVisible, areLayersVisible } = this.state;
        const bottomSheetRef = this.bottomSheetRef;
        this.setState({
            areButtonsVisible: false,
            areLayersVisible: false,
            bottomSheetIsTransparent: false,
            bottomSheetContentType: content,
            bottomSheetSnapPoints: defaultSnapPoints,
        }, () => {
            if (index < 0) {
                bottomSheetRef?.current?.close();
            } else {
                if (shouldToggle && !areButtonsVisible && !areLayersVisible) {
                    // UX: Helps users more easily understand that they can hide the bottom sheet and show buttons
                    bottomSheetRef?.current?.close();
                } else {
                    bottomSheetRef?.current?.snapToIndex(index);
                }
            }
        });
    };

    handleImageSelect = (imageResponse, userCoords, areaType: IAreaType = 'moments') => {
        const { navigation } = this.props;
        const routeName = areaType === 'spaces' ? 'EditSpace' : 'EditMoment';

        if (!imageResponse.didCancel && !imageResponse.errorCode) {
            return navigation.navigate(routeName, {
                ...userCoords,
                imageDetails: imageResponse,
            });
        }
    };

    handleCreate = (action: ICreateMomentAction = 'moment', isBusinessAccount = false, isCreatorAccount = false) => {
        const { createSpaceCheckInMetrics, location, navigation } = this.props;
        const { circleCenter, nearbySpaces } = this.state;

        this.setState({
            shouldShowCreateActions: false,
        });

        if (location?.settings?.isGpsEnabled) {
            // TODO: Store permissions in redux
            const storePermissions = () => {};

            if (action === 'check-in') {
                if (nearbySpaces?.length) {
                    const { map } = this.props;
                    const firstSpace = nearbySpaces[0];
                    if (map.recentEngagements
                        && map.recentEngagements[firstSpace.id]
                        && map.recentEngagements[firstSpace.id].engagementType === 'check-in'
                        && (Date.now() - map.recentEngagements[firstSpace.id].timestamp) < (MIN_TIME_BTW_CHECK_INS_MS)) {
                        // Require at least 30 minutes between check-ins
                        const alertMsg = this.translate('pages.map.areaAlerts.tooManyCheckIns');
                        return this.showAreaAlert(alertMsg);
                    }
                    createSpaceCheckInMetrics({
                        name: MetricNames.SPACE_USER_CHECK_IN,
                        spaceId: firstSpace.id,
                        latitude: circleCenter.latitude,
                        longitude: circleCenter.longitude,
                    }).then((response) => {
                        // TODO: Only send toast if push notifications are disabled
                        if (response?.therrCoinRewarded) {
                            sendForegroundNotification({
                                title: this.translate('alertTitles.coinsReceived'),
                                body: this.translate('alertMessages.coinsReceived', {
                                    total: response?.therrCoinRewarded || '2',
                                }),
                                android: {
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
                                    total: response?.therrCoinRewarded || '2',
                                }),
                                visibilityTime: 2500,
                            });
                        } else {
                            const alertMsg = response?.isMySpace
                                ? this.translate('pages.map.areaAlerts.ownSpaceCheckIn')
                                : this.translate('pages.map.areaAlerts.unknownError');
                            return this.showAreaAlert(alertMsg);
                        }
                    }).catch((err) => {
                        if (err.errorCode === ErrorCodes.INSUFFICIENT_THERR_COIN_FUNDS) {
                            const alertMsg = this.translate('pages.map.areaAlerts.lowFunds', 4000);
                            return this.showAreaAlert(alertMsg);
                        } else {
                            const alertMsg = this.translate('pages.map.areaAlerts.unknownError');
                            return this.showAreaAlert(alertMsg);
                        }
                    });
                }

                return;
            }

            if (action === 'moment') {
                navigation.reset({
                    index: 1,
                    routes: [
                        {
                            name: 'Map',
                            params: {
                                ...circleCenter,
                            },
                        },
                        {
                            name: 'EditMoment',
                            params: {
                                ...circleCenter,
                                imageDetails: {},
                                nearbySpaces,
                                area: {},
                            },
                        },
                    ],
                });
                return;
            }

            if (action === 'event') {
                navigation.reset({
                    index: 1,
                    routes: [
                        {
                            name: 'Map',
                            params: {
                                ...circleCenter,
                            },
                        },
                        {
                            name: 'EditEvent',
                            params: {
                                ...circleCenter,
                                imageDetails: {},
                                nearbySpaces,
                                area: {},
                            },
                        },
                    ],
                });
                return;
            }

            if (action === 'claim') {
                navigation.reset({
                    index: 1,
                    routes: [
                        {
                            name: 'Map',
                            params: {
                                ...circleCenter,
                            },
                        },
                        {
                            name: 'EditSpace',
                            params: {
                                ...circleCenter,
                                imageDetails: {},
                                area: {},
                                isBusinessAccount,
                                isCreatorAccount,
                            },
                        },
                    ],
                });
                return;
            }

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
                            .then((cameraResponse) => this.handleImageSelect(cameraResponse, circleCenter));
                    } else if (action === 'upload') {
                        return ImageCropPicker.openPicker(pickerOptions)
                            .then((cameraResponse) => this.handleImageSelect(cameraResponse, circleCenter));
                    } else {
                        navigation.navigate('EditMoment', {
                            ...circleCenter,
                            imageDetails: {},
                        });
                    }
                } else {
                    throw new Error('permissions denied');
                }
            }).catch((e) => {
                console.log(e);
                // TODO: Handle Permissions denied
                if (e?.message.toLowerCase().includes('cancel')) {
                    this.handleImageSelect({
                        didCancel: true,
                    }, circleCenter);
                }
            });

        } else {
            // TODO: Alert that GPS is required to create a moment
            let alertMsg = this.translate('pages.map.areaAlerts.enableMomentLocation');
            if (action === 'claim') {
                alertMsg = isBusinessAccount
                    ? this.translate('pages.map.areaAlerts.enableSpaceLocation')
                    : this.translate('pages.map.areaAlerts.requestSpaceLocation');
            }
            if (action === 'event') {
                alertMsg = this.translate('pages.map.areaAlerts.enableEventLocation');
            }
            this.showAreaAlert(alertMsg);
        }
    };

    handleMatchUpPress = () => {
        // TODO: Navigate to Match Up page where user can prompt for curated activities
        this.props.navigation.navigate('Connect', {
            activeTab: PEOPLE_CAROUSEL_TABS.GROUPS,
        });
    };

    handleGpsRecenterPress = () => {
        const {
            location,
            map,
            setInitialUserLocation,
            updateUserCoordinates,
            updateGpsStatus,
            updateLocationDisclosure,
            updateLocationPermissions,
        } = this.props;

        ReactNativeHapticFeedback.trigger(HAPTIC_FEEDBACK_TYPE, hapticFeedbackOptions);

        this.setState({
            shouldShowCreateActions: false,
        });

        clearTimeout(this.timeoutIdLocationReady);
        this.timeoutIdLocationReady = setTimeout(() => {
            this.setState({
                isMinLoadTimeComplete: true,
            });
        }, MIN_LOAD_TIMEOUT);

        let perms;

        // NOTE: This logic is re-used in the Area/index.tsx file
        // We may want to find a better way rather than copy/paste to keep things in sync
        return requestLocationServiceActivation({
            isGpsEnabled: location?.settings?.isGpsEnabled,
            translate: this.translate,
            shouldIgnoreRequirement: false,
        }).then((response: any) => {
            if (response?.status || Platform.OS === 'ios') {
                if (response?.alreadyEnabled && isLocationPermissionGranted(location.permissions)) {
                    // Ensure that the user sees location disclosure even if gps is already enabled (otherwise requestOSMapPermissions will handle it)
                    if (!location?.settings?.isLocationDislosureComplete) {
                        this.setState({
                            isLocationUseDisclosureModalVisible: true,
                        });
                        return true;
                    } else {
                        return false;
                    }
                }

                updateLocationDisclosure(true);
                updateGpsStatus(response?.status || 'enabled');

                return false;
            }

            return Promise.resolve(false);
        }).then((shouldAbort) => {
            if (shouldAbort) { // short-circuit because backup disclosure is in progress
                return;
            }

            return requestOSMapPermissions(updateLocationPermissions).then((permissions) => {
                // TODO: If permissions are never ask again, display instructions for user to go to app settings and allow
                return new Promise((resolve, reject) => {
                    let extraPromise = Promise.resolve(false);
                    if (Platform.OS === 'android' && permissions[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] !== 'granted') {
                        extraPromise = checkAndroidPermission(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION, updateLocationPermissions);
                    }

                    return extraPromise.then((isCoarseLocationGranted) => {
                        perms = {
                            ...permissions,
                            [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: isCoarseLocationGranted ? 'granted' : 'denied',
                        };
                        // If permissions are granted
                        if (isLocationPermissionGranted(perms)) {
                            this.setState({
                                isLocationReady: true,
                            });

                            // User has already logged in initially and loaded the map
                            if (location.user?.longitude && location.user?.latitude && map.hasUserLocationLoaded) {
                                const { region } = this.state;
                                const coords = {
                                    longitude: location.user?.longitude,
                                    latitude: location.user?.latitude,
                                };
                                this.updateCircleCenter(coords);
                                updateUserCoordinates(coords);
                                const mapDelta = region.longitude && region.latitudeDelta
                                    && Math.abs(region.latitudeDelta - MAX_ANIMATION_LATITUDE_DELTA) > 0.001
                                    && Math.abs(region.longitude - location.user?.longitude) < 0.0001
                                    ? {
                                        latitudeDelta: MAX_ANIMATION_LATITUDE_DELTA,
                                        longitudeDelta: MAX_ANIMATION_LONGITUDE_DELTA,
                                    }
                                    : null;
                                this.handleGpsRecenter(coords, mapDelta, ANIMATE_TO_REGION_DURATION_FAST);
                                return resolve(coords);
                            }
                            // Get Location Success Handler
                            const positionSuccessCallback = (position) => {
                                const coords = {
                                    latitude:
                                        position.coords
                                            .latitude,
                                    longitude:
                                        position.coords
                                            .longitude,
                                };
                                this.updateCircleCenter(coords);
                                setInitialUserLocation();
                                if (coords.latitude !== this.props.location?.user?.latitude || coords.longitude !== location?.user?.longitude) {
                                    updateUserCoordinates(coords);
                                }

                                this.handleGpsRecenter(coords, null, ANIMATE_TO_REGION_DURATION);
                                return resolve(coords);
                            };
                            // Get Location Failed Handler
                            const positionErrorCallback = (error, type) => {
                                console.log('geolocation error', error.code, type);
                                if (type !== 'watch' && error.code !== error.TIMEOUT) {
                                    return reject(error);
                                }
                            };
                            const positionOptions = {
                                enableHighAccuracy: true,
                            };

                            // If this is not cached, response can be slow
                            // Geolocation.getCurrentPosition(
                            //     positionSuccessCallback,
                            //     (error) => positionErrorCallback(error, 'get'),
                            //     positionOptions,
                            // );

                            // Sometimes watch is faster than get, so we'll call both and cancel after one resolves first
                            this.mapWatchId = Geolocation.watchPosition(
                                positionSuccessCallback,
                                (error) => positionErrorCallback(error, 'watch'),
                                positionOptions,
                            );
                        } else {
                            console.log('Location permission denied');
                            return reject('permissionDenied');
                        }
                    });
                });
            })
                .then((coords: any) => {
                    Geolocation.clearWatch(this.mapWatchId);
                    Geolocation.stopObserving();
                    this.handleRefreshMoments(true, coords);
                })
                .catch((error) => {
                    console.log('requestOSPermissionsError', error);
                    // TODO: Display message encouraging user to turn on location permissions in settings
                    if (error === 'permissionDenied') {
                        updateLocationPermissions(perms);
                    }
                    // this.goToHome();
                });
        }).catch((error) => {
            console.log('locationServiceActivationError', error);
            // this.goToHome();
        });
    };

    handleGpsRecenter = (coords?, delta?, duration?) => {
        const { circleCenter, lastLocationSendForProcessing } = this.state;
        const { map } = this.props;
        const loc = {
            latitude: coords?.latitude || circleCenter.latitude,
            longitude: coords?.longitude || circleCenter.longitude,
            latitudeDelta: delta?.latitudeDelta || PRIMARY_LATITUDE_DELTA,
            longitudeDelta: delta?.longitudeDelta || PRIMARY_LONGITUDE_DELTA,
        };
        /**
         * Send location to backend for processing
         * This helps ensure first time users post their location and get some initial content
         */
        PushNotificationsService.postLocationChange({
            longitude: loc.longitude,
            latitude: loc.latitude,
            lastLocationSendForProcessing,
            radiusOfAwareness: map.radiusOfAwareness,
            radiusOfInfluence: map.radiusOfInfluence,
        });
        this.animateToWithHelp(() => this.mapRef && this.mapRef.animateToRegion(loc, duration || ANIMATE_TO_REGION_DURATION));
        this.setState({
            areLayersVisible: false,
            shouldFollowUserLocation: false,
            isScrollEnabled: true,
        });
    };

    handleOpenMapFiltersPress = () => {
        const { navigation } = this.props;
        navigation.navigate('MapFilteredSearch');
    };

    // TODO: Call this when user has traveled a certain distance from origin
    handleRefreshMoments = (overrideThrottle = false, coords?: any) => {
        const { isMinLoadTimeComplete } = this.state;
        const { location } = this.props;

        clearTimeout(this.timeoutIdRefreshMoments);

        if (!isMinLoadTimeComplete) {
            this.timeoutIdRefreshMoments = setTimeout(() => {
                this.handleRefreshMoments(overrideThrottle, coords);
            }, 50);

            return;
        }

        this.setState({
            areLayersVisible: false,
        });
        if (!overrideThrottle && this.state.lastMomentsRefresh &&
            (Date.now() - this.state.lastMomentsRefresh <= MOMENTS_REFRESH_THROTTLE_MS)) {
            return;
        }
        const { map } = this.props;
        const userCoords = coords || {
            longitude: map.longitude,
            latitude: map.latitude,
        };

        // TODO: Consider making this one, dynamic request to add efficiency
        return this.searchMapAreas(userCoords, {
            itemsPerPage: AREAS_SEARCH_COUNT,
            meItemsPerPage: 50,
        }, {
            userLatitude: location?.user?.latitude,
            userLongitude: location?.user?.longitude,
        })
            .finally(() =>{
                this.setState({
                    isSearchLoading: false,
                });

                this.setState({
                    lastMomentsRefresh: Date.now(),
                });
            });
    };

    searchMapAreas = (
        longLat: { longitude: string, latitude: string },
        conditions: {
            itemsPerPage: number,
            meItemsPerPage: number,
        },
        distanceOverride?: any) => {
        const {
            findEventReactions,
            findMomentReactions,
            findSpaceReactions,
            searchEvents,
            searchMoments,
            searchSpaces,
        } = this.props;

        return Promise.all([
            searchMoments({
                query: 'connections',
                itemsPerPage: conditions.itemsPerPage,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                ...longLat,
            }, distanceOverride),
            searchSpaces({
                query: 'connections',
                itemsPerPage: conditions.itemsPerPage,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                ...longLat,
            }, distanceOverride),
            searchEvents({
                query: 'connections',
                itemsPerPage: conditions.itemsPerPage,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                ...longLat,
            }, distanceOverride),
            searchMoments({
                query: 'me',
                itemsPerPage: conditions.meItemsPerPage,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                ...longLat,
            }, distanceOverride),
            searchSpaces({
                query: 'me',
                itemsPerPage: conditions.meItemsPerPage,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                ...longLat,
            }, distanceOverride),
            searchEvents({
                query: 'me',
                itemsPerPage: conditions.meItemsPerPage,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                ...longLat,
            }, distanceOverride),
        ]).then(([moments, spaces, events]) => {
            // TODO: Find event reactions
            if (events?.results?.length) {
                findEventReactions({
                    eventIds: events?.results?.map(event => event.id),
                    userHasActivated: true,
                });
            }
            if (moments?.results?.length) {
                findMomentReactions({
                    momentIds: moments?.results?.map(moment => moment.id),
                    userHasActivated: true,
                });
            }
            if (spaces?.results?.length) {
                findSpaceReactions({
                    spaceIds: spaces?.results?.map(space => space.id),
                    userHasActivated: true,
                });
            }
            this.setState({
                lastMomentsRefresh: Date.now(),
            });
        }).catch((err) => console.log(err));
    };

    getSearchRadius = (locationCenter, locationEdge) => {
        let searchRadiusMeters = distanceTo({
            lon: locationCenter.longitude,
            lat: locationCenter.latitude,
        }, {
            // TODO: Use search polygon rather than rough estimate radius
            lon: locationEdge.longitude,
            lat: locationEdge.latitude,
        });
        searchRadiusMeters = Math.max(searchRadiusMeters, Location.AREA_PROXIMITY_METERS);
        searchRadiusMeters = searchRadiusMeters + (searchRadiusMeters * 0.10); // add 10% padding
        return searchRadiusMeters;
    };

    handleLocationDisclosureSelect = (selection) => {
        const { updateLocationDisclosure } = this.props;
        // TODO: Decide if selection should be dynamic
        console.log(selection);
        updateLocationDisclosure(true).then(() => {
            this.toggleLocationUseDisclosure();
            this.handleGpsRecenterPress();
        });
    };

    handleSearchSelect = (selection, shouldTogglePreview = false) => {
        const { setSearchDropdownVisibility } = this.props;

        Keyboard.dismiss();

        setSearchDropdownVisibility(false);

        MapsService.getPlaceDetails({
            apiKey: Platform.OS === 'ios' ? GOOGLE_APIS_IOS_KEY : GOOGLE_APIS_ANDROID_KEY,
            placeId: selection?.place_id,
        }).then((response) => {
            const geometry = response.data?.result?.geometry;
            if (geometry) {
                const latDelta = geometry.viewport.northeast.lat - geometry.viewport.southwest.lat;
                const lngDelta = geometry.viewport.northeast.lng - geometry.viewport.southwest.lng;
                const loc = {
                    latitude: geometry.location.lat,
                    longitude: geometry.location.lng,
                    latitudeDelta: Math.max(latDelta, PRIMARY_LATITUDE_DELTA),
                    longitudeDelta: Math.max(lngDelta, PRIMARY_LONGITUDE_DELTA),
                };
                const searchRadiusMeters = this.getSearchRadius(loc, {
                    longitude: geometry.viewport.northeast.lng,
                    latitude: geometry.viewport.northeast.lat,
                });
                this.animateToWithHelp(() => this.mapRef && this.mapRef.animateToRegion(loc, ANIMATE_TO_REGION_DURATION_SLOW));
                this.handleSearchThisLocation(searchRadiusMeters, geometry.location.lat, geometry.location.lng)
                    .finally(() => {
                        // TODO: Determine if this needs to be canceled when navigating to a new view
                        // We must wait for search to complete so new spaces are available for rendering the preview overlay
                        if (shouldTogglePreview) {
                            this.mapRef.props.onPress({
                                nativeEvent: {
                                    coordinate: {
                                        latitude: geometry.location.lat,
                                        longitude: geometry.location.lng,
                                    },
                                },
                            }, true);
                        }
                    });
            }
        }).catch((error) => {
            console.log(error);
        });
    };

    handleQuickFilterSelect = (index: string) => {
        const { setMapFilters, map, location } = this.props;

        let authorFilters = this.initialAuthorFilters.map(x => ({ ...x, isChecked: true}));
        let categoryFilters = this.initialCategoryFilters.map(x => ({ ...x, isChecked: true}));
        let visibilityFilters = this.initialVisibilityFilters.map(x => ({ ...x, isChecked: true}));

        if (this.quickFilterButtons[index].title === this.translate('pages.map.filterButtons.all')) {
            setMapFilters({
                filtersAuthor: authorFilters,
                filtersCategory: categoryFilters,
                filtersVisibility: visibilityFilters,
            });
        }

        if (this.quickFilterButtons[index].title === this.translate('pages.map.filterButtons.people')) {
            setMapFilters({
                filtersAuthor: authorFilters,
                filtersCategory: categoryFilters,
                filtersVisibility: this.initialVisibilityFilters.map(x => ({
                    ...x,
                    isChecked: x.name === 'moments' || x.name === 'public' || x.name === 'private',
                })),
            });
        }

        if (this.quickFilterButtons[index].title === this.translate('pages.map.filterButtons.places')) {
            setMapFilters({
                filtersAuthor: authorFilters,
                filtersCategory: categoryFilters,
                filtersVisibility: this.initialVisibilityFilters.map(x => ({
                    ...x,
                    isChecked: x.name === 'spaces' || x.name === 'public' || x.name === 'private',
                })),
            });
        }

        if (this.quickFilterButtons[index].title === this.translate('pages.map.filterButtons.events')) {
            setMapFilters({
                filtersAuthor: authorFilters,
                filtersCategory: categoryFilters,
                filtersVisibility: this.initialVisibilityFilters.map(x => ({ ...x, isChecked: x.name.includes('event') || x.name.includes('public')})),
            });
        }

        if (this.quickFilterButtons[index].title === this.translate('pages.map.filterButtons.music')) {
            setMapFilters({
                filtersAuthor: authorFilters,
                filtersCategory: this.initialCategoryFilters.map(x => ({ ...x, isChecked: x.name === 'music' || x.name === 'music/concerts'})),
                filtersVisibility: visibilityFilters,
            });
        }

        // TODO: Eventually we can always use the preview sheet when we implement a people search and moment search
        if (this.quickFilterButtons[index].title !== this.translate('pages.map.filterButtons.people')) {
            const latitude = map?.latitude || location?.user?.latitude;
            const longitude = map?.longitude || location?.user?.longitude;
            this.mapRef.props.onPress({
                nativeEvent: {
                    coordinate: {
                        latitude: latitude,
                        longitude: longitude,
                    },
                },
            }, true);
        } else {
            this.expandBottomSheet(0, true);
        }

        this.setState({
            activeQuickFilterId: index,
        });
    };

    handleSearchThisLocation = (searchRadius?, latitude?, longitude?): Promise<any> => {
        const { region } = this.state;
        const { location } = this.props;
        this.setState({
            isSearchThisLocationBtnVisible: false,
        });

        let lat = latitude;
        let long = longitude;

        if (!latitude || !longitude) {
            lat = region.latitude;
            long = region.longitude;
        }

        let radius = searchRadius || this.getSearchRadius({
            longitude: long,
            latitude: lat,
        }, {
            longitude: long + region.longitudeDelta,
            latitude: lat + region.latitudeDelta,
        });

        if (lat && long) {
            this.setState({
                isSearchLoading: true,
            });

            return this.searchMapAreas({
                latitude: lat,
                longitude: long,
            }, {
                itemsPerPage: AREAS_SEARCH_COUNT_ZOOMED,
                meItemsPerPage: 20,
            }, {
                distanceOverride: radius,
                userLatitude: location?.user?.latitude,
                userLongitude: location?.user?.longitude,
            }).finally(() =>{
                this.setState({
                    isSearchLoading: false,
                });
            });
        }

        return Promise.resolve();
    };

    handleStopTouring = () => {
        const { user, updateTour } = this.props;
        updateTour(user.details.id, {
            isTouring: false,
        });
    };

    isAuthorized = () => {
        const { user } = this.props;
        return UsersService.isAuthorized(
            {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            user
        );
    };

    isAreaActivated = (type: IAreaType, area) => {
        const { reactions, user } = this.props;

        if (isMyContent(area, user)) {
            return true;
        }

        if (type === 'events') {
            return !!reactions.myEventReactions[area.id];
        }

        if (type === 'moments') {
            return !!reactions.myMomentReactions[area.id];
        }

        return !!reactions.mySpaceReactions[area.id];
    };

    onConfirmModalCancel = () => {
        this.setState({
            isConfirmModalVisible: false,
        });
    };

    onConfirmModalAccept = () => {
        const { user, updateUser } = this.props;
        this.setState({
            isConfirmModalVisible: false,
        });

        // Update user property to show confirmed
        updateUser(user.details.id, { hasAgreedToTerms: true }).then(() => {
            this.handleCreate('upload');
        });
    };

    onClusterPress = (/* cluster, markers */) => {
        // if (Platform.OS === 'android') {
        // }
    };

    onPressFindFriends = () => {
        const { navigation } = this.props;

        navigation.navigate('Invite', {
            shouldLaunchContacts: true,
        });
    };

    showAreaAlert = (message?: string, timeout = 2000) => {
        const alertMsg = message || this.translate('pages.map.areaAlerts.walkCloser');
        this.setState({
            alertMessage: alertMsg,
            isAreaAlertVisible: true,
        });

        this.timeoutIdShowMomentAlert = setTimeout(() => {
            this.setState({
                isAreaAlertVisible: false,
            });
        }, timeout);
    };

    hideCreateActions = () => this.toggleCreateActions(true);

    toggleCreateActions = (shouldHide: boolean = false) => {
        const { user } = this.props;
        const { shouldShowCreateActions } = this.state;

        if (Platform.OS === 'ios' && !user.details.hasAgreedToTerms) {
            this.setState({
                isConfirmModalVisible: true,
            });
            return;
        }

        this.setState({
            shouldShowCreateActions: shouldHide ? false : !shouldShowCreateActions,
        });
    };

    toggleLocationUseDisclosure = () => {
        const { isLocationUseDisclosureModalVisible } = this.state;
        this.setState({
            isLocationUseDisclosureModalVisible: !isLocationUseDisclosureModalVisible,
        });
    };

    // Currently not implemented
    toggleMapFollow = () => {
        const {
            shouldFollowUserLocation,
            isScrollEnabled,
        } = this.state;
        const { location } = this.props;

        if (shouldFollowUserLocation === false && location?.user?.longitude && location?.user?.latitude) {
            // Zoom in
            // TODO: Find way to keep pitch while following
            // this.animateToWithHelp(() => {
            //     this.mapRef && this.mapRef.animateCamera({
            //         heading: 0,
            //         pitch: 90,
            //         center: {
            //             longitude: location?.user?.longitude,
            //             latitude: location?.user?.latitude,
            //         },
            //         zoom: 17,
            //     }, {
            //         duration: ANIMATE_TO_REGION_DURATION,
            //     });
            // });
            this.animateToWithHelp(() => {
                this.mapRef && this.mapRef.animateToRegion({
                    longitude: location?.user?.longitude,
                    latitude: location?.user?.latitude,
                    latitudeDelta: PRIMARY_LATITUDE_DELTA,
                    longitudeDelta: PRIMARY_LONGITUDE_DELTA,
                }, ANIMATE_TO_REGION_DURATION);
            });
        } else {
            // Zoom out
            this.animateToWithHelp(() => {
                this.mapRef && this.mapRef.animateToRegion({
                    longitude: location?.user?.longitude,
                    latitude: location?.user?.latitude,
                    latitudeDelta: PRIMARY_LATITUDE_DELTA + (PRIMARY_LATITUDE_DELTA * 0.1),
                    longitudeDelta: PRIMARY_LONGITUDE_DELTA + (PRIMARY_LONGITUDE_DELTA * 0.1),
                }, ANIMATE_TO_REGION_DURATION);
            });
        }

        this.setState({
            shouldFollowUserLocation: !shouldFollowUserLocation,
            isScrollEnabled: !isScrollEnabled,
        });
    };

    toggleMomentBtns = () => {
        if (!this.state.areButtonsVisible) {
            this.bottomSheetRef?.current?.close();
        } else {
            this.expandBottomSheet(0);
        }

        this.setState({
            areButtonsVisible: !this.state.areButtonsVisible,
            areLayersVisible: false,
        });
    };

    toggleNearbySheet = (shouldClose = false) => {
        const { location } = this.props;

        if (!this.state.areButtonsVisible || shouldClose) {
            this.bottomSheetRef?.current?.close();
        } else {
            if (location?.settings?.isGpsEnabled) {
                this.expandBottomSheet(1);
            } else {
                this.expandBottomSheet(2);
            }
        }

        this.setState({
            areButtonsVisible: !this.state.areButtonsVisible,
            areLayersVisible: false,
        });
    };

    onBottomSheetClose = () => {
        this.setState({
            areButtonsVisible: true,
            areLayersVisible: false,
            shouldFollowUserLocation: false,
            isScrollEnabled: true,
        });
    };

    onPreviewBottomSheetOpen = () => {
        this.setState({
            areButtonsVisible: false,
            areLayersVisible: false,
            shouldFollowUserLocation: false,
            isScrollEnabled: true,
        });
    };

    onMapLayout = () => {
        this.setState({ isMapReady: true });
    };

    onRegionChange = (region) => {
        if (region.latitude.toFixed(6) === this.state.region?.latitude?.toFixed(6)
            && region.longitude.toFixed(6) === this.state.region?.longitude?.toFixed(6)) {
            return;
        }

        this.setState({
            isSearchThisLocationBtnVisible: false,
            // region,
        });

        // clearTimeout(this.timeoutIdSearchButton);
        // if (!this.state.shouldIgnoreSearchThisAreaButton) {
        //     this.timeoutIdSearchButton = setTimeout(() => {
        //         this.setState({
        //             isSearchThisLocationBtnVisible: true,
        //         });
        //     }, 500);
        // }
    };

    onRegionChangeComplete = (region, filteredAreasCount: number) => {
        const { updateMapViewCoordinates } = this.props;
        updateMapViewCoordinates({
            latitude: region.latitude,
            longitude: region.longitude,
            latitudeDelta: region.latitudeDelta,
            longitudeDelta: region.longitudeDelta,
        });
        this.setState({
            isSearchThisLocationBtnVisible: false,
            region,
            shouldRenderMapCircles: this.shouldRenderCircles(region, filteredAreasCount),
        });

        clearTimeout(this.timeoutIdSearchButton);
        if (!this.state.shouldIgnoreSearchThisAreaButton) {
            this.timeoutIdSearchButton = setTimeout(() => {
                this.setState({
                    isSearchThisLocationBtnVisible: true,
                });
            }, 750);
        }
    };

    shouldRenderCircles = (region, filteredAreasCount: number) => {
        if (filteredAreasCount > MAX_RENDERED_CIRCLES) {
            return false;
        }

        return region.longitudeDelta <= 0.15 || region.latitudeDelta <= 0.1;
    };

    updateCircleCenter = (center: { longitude: number, latitude: number }) => {
        const { circleCenter } = this.state;

        if (circleCenter.latitude !== center.latitude || circleCenter.longitude !== center.longitude) {
            const { user, reactions, map } = this.props;
            const nearbySpaces = getNearbySpaces({
                latitude: circleCenter.latitude,
                longitude: circleCenter.longitude,
            }, user, reactions, map.spaces);

            this.setState({
                circleCenter: center,
                nearbySpaces,
            });
        }
    };

    updateMapRef = (ref: Ref<MapView>) => { this.mapRef = ref; };

    updateRegion = (region) => {
        const { map } = this.props;
        const mapFilters = {
            filtersAuthor: map.filtersAuthor,
            filtersCategory: map.filtersCategory,
            filtersVisibility: map.filtersVisibility,
        };
        const filteredEvents = this.getFilteredAreas(map.events, mapFilters);
        const filteredMoments = this.getFilteredAreas(map.moments, mapFilters);
        const filteredSpaces = this.getFilteredAreas(map.spaces, mapFilters);
        const filteredAreasCount = filteredEvents.length + filteredMoments.length + filteredSpaces.length;
        this.onRegionChangeComplete(region, filteredAreasCount);
    };

    render() {
        const {
            activeQuickFilterId,
            alertMessage,
            areButtonsVisible,
            areLayersVisible,
            bottomSheetContentType,
            bottomSheetIsTransparent,
            bottomSheetSnapPoints,
            circleCenter,
            exchangeRate,
            shouldShowCreateActions,
            isConfirmModalVisible,
            isLocationReady,
            isLocationUseDisclosureModalVisible,
            isMinLoadTimeComplete,
            isAreaAlertVisible,
            isSearchThisLocationBtnVisible,
            isSearchLoading,
            isScrollEnabled,
            nearbySpaces,
            shouldFollowUserLocation,
            shouldRenderMapCircles,
        } = this.state;
        const { captureClickTarget, location, map, navigation, notifications, route, user } = this.props;
        const searchPredictionResults = map?.searchPredictions?.results || [];
        const isDropdownVisible = map?.searchPredictions?.isSearchDropdownVisible;
        const hasNotifications = notifications.messages && notifications.messages.some(m => m.isUnread);
        const isTouring = !!user?.settings?.isTouring;
        const mapFilters = {
            filtersAuthor: map.filtersAuthor,
            filtersCategory: map.filtersCategory,
            filtersVisibility: map.filtersVisibility,
        };
        const filteredEvents = this.getFilteredAreas(map.events, mapFilters);
        const filteredMoments = this.getFilteredAreas(map.moments, mapFilters);
        const filteredSpaces = this.getFilteredAreas(map.spaces, mapFilters);

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView} onStartShouldSetResponder={(event: any) => {
                    event.persist();
                    if (event?.target?._nativeTag) {
                        captureClickTarget(event?.target?._nativeTag);
                    }
                    return false;
                }}>
                    {!(isLocationReady && isMinLoadTimeComplete) ? (
                        <AnimatedLoader
                            visible={true}
                            overlayColor="rgba(255,255,255,0.75)"
                            source={earthLoader}
                            animationStyle={loaderStyles.lottie}
                            speed={1.5}
                        />
                    ) : (
                        <>
                            {
                                isDropdownVisible &&
                                <SearchTypeAheadResults
                                    handleSelect={this.handleSearchSelect}
                                    searchPredictionResults={searchPredictionResults}
                                    themeSearch={this.themeSearch}
                                />
                            }
                            <TherrMapView
                                areMapActionsVisible={areButtonsVisible}
                                animateToWithHelp={this.animateToWithHelp}
                                circleCenter={circleCenter}
                                expandBottomSheet={this.expandBottomSheet}
                                exchangeRate={exchangeRate}
                                route={route}
                                filteredEvents={filteredEvents}
                                filteredMoments={filteredMoments}
                                filteredSpaces={filteredSpaces}
                                mapRef={this.updateMapRef}
                                navigation={navigation}
                                onRegionChange={this.onRegionChange}
                                onRegionChangeComplete={this.updateRegion}
                                showAreaAlert={this.showAreaAlert}
                                onPreviewBottomSheetClose={this.onBottomSheetClose}
                                onPreviewBottomSheetOpen={this.onPreviewBottomSheetOpen}
                                shouldFollowUserLocation={shouldFollowUserLocation}
                                shouldRenderMapCircles={shouldRenderMapCircles}
                                hideCreateActions={this.hideCreateActions}
                                isScrollEnabled={isScrollEnabled}
                                onMapLayout={this.onMapLayout}
                                // /* react-native-map-clustering */
                                // onClusterPress={this.onClusterPress}
                                // // preserveClusterPressBehavior={true}
                                updateCircleCenter={this.updateCircleCenter}
                            />
                            <AnimatedOverlay
                                animationType="swing"
                                animationDuration={500}
                                easing="linear"
                                visible={isAreaAlertVisible}
                                onClose={this.cancelAreaAlert}
                                closeOnTouchOutside
                                containerStyle={this.theme.styles.overlay}
                                childrenWrapperStyle={mapStyles.momentAlertOverlayContainer}
                            >
                                <Alert
                                    containerStyles={{}}
                                    isVisible={isAreaAlertVisible}
                                    message={alertMessage}
                                    type="error"
                                    themeAlerts={this.themeAlerts}
                                />
                            </AnimatedOverlay>
                        </>
                    )}
                    <QuickFiltersList
                        activeButtonId={activeQuickFilterId}
                        filterButtons={this.quickFilterButtons}
                        onSelect={this.handleQuickFilterSelect}
                        translate={this.translate}
                        themeButtons={this.themeButtons}
                    />
                    {
                        ((isSearchThisLocationBtnVisible || isSearchLoading) && !isDropdownVisible) &&
                        <SearchThisAreaButtonGroup
                            handleSearchLocation={this.handleSearchThisLocation}
                            isSearchLoading={isSearchLoading}
                            translate={this.translate}
                            themeButtons={this.themeButtons}
                        />
                    }
                </SafeAreaView>
                {
                    isLocationReady && isMinLoadTimeComplete && areButtonsVisible &&
                    <>
                        {
                            !areLayersVisible &&
                            <MapActionButtons
                                exchangeRate={exchangeRate}
                                filters={mapFilters}
                                goToMoments={this.goToMoments}
                                goToNotifications={this.goToNotifications}
                                hasNotifications={hasNotifications}
                                handleCreate={this.handleCreate}
                                handleMatchUp={this.handleMatchUpPress}
                                handleGpsRecenter={this.handleGpsRecenterPress}
                                handleOpenMapFilters={this.handleOpenMapFiltersPress}
                                toggleCreateActions={this.toggleCreateActions}
                                toggleFollow={this.toggleMapFollow}
                                shouldShowCreateActions={shouldShowCreateActions}
                                isAuthorized={this.isAuthorized}
                                isFollowEnabled={shouldFollowUserLocation}
                                isGpsEnabled={location?.settings?.isGpsEnabled}
                                nearbySpaces={nearbySpaces}
                                recentEngagements={map.recentEngagements}
                                translate={this.translate}
                                theme={this.theme}
                                themeButtons={this.themeButtons}
                                themeConfirmModal={this.themeConfirmModal}
                                user={user}
                            />
                        }
                    </>
                }
                <ConfirmModal
                    headerText={this.translate('modals.confirmModal.header.eula')}
                    isVisible={isConfirmModalVisible}
                    onCancel={this.onConfirmModalCancel}
                    onConfirm={this.onConfirmModalAccept}
                    text={eula}
                    textConfirm={this.translate('modals.confirmModal.agree')}
                    translate={this.translate}
                    theme={this.theme}
                    themeButtons={this.themeButtons}
                    themeModal={this.themeConfirmModal}
                />
                <LocationUseDisclosureModal
                    isVisible={isLocationUseDisclosureModalVisible}
                    translate={this.translate}
                    onRequestClose={this.toggleLocationUseDisclosure}
                    onSelect={this.handleLocationDisclosureSelect}
                    themeButtons={this.themeButtons}
                    themeDisclosure={this.themeDisclosure}
                />
                <TouringModal
                    isVisible={isTouring}
                    translate={this.translate}
                    onRequestClose={this.handleStopTouring}
                    themeButtons={this.themeButtons}
                    themeTour={this.themeTour}
                    onFindFriends={this.onPressFindFriends}
                    user={user}
                />
                {
                    <BottomSheetPlus
                        sheetRef={(sheetRef: React.RefObject<BottomSheetMethods>) => { this.bottomSheetRef = sheetRef; }}
                        initialIndex={-1}
                        isTransparent={bottomSheetIsTransparent}
                        onClose={this.onBottomSheetClose}
                        themeBottomSheet={this.themeBottomSheet}
                        overrideSnapPoints={bottomSheetSnapPoints}
                    >
                        <MapBottomSheetContent
                            contentType={bottomSheetContentType}
                            navigation={navigation}
                            theme={this.theme}
                            themeBottomSheet={this.themeBottomSheet}
                            themeViewArea={this.themeViewArea}
                            translate={this.translate}
                        />
                    </BottomSheetPlus>
                }
                <MainButtonMenu
                    activeRoute="Map"
                    navigation={navigation}
                    onActionButtonPress={this.toggleMomentBtns}
                    onNearbyPress={this.toggleNearbySheet}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                    themeName={this.props.user?.settings?.mobileThemeName}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Map);
