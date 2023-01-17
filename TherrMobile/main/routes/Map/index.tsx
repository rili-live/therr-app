import React, { Ref } from 'react';
import { Dimensions, PermissionsAndroid, Keyboard, Platform, SafeAreaView } from 'react-native';
import { StackActions } from '@react-navigation/native';
import MapView from 'react-native-map-clustering';
import AnimatedOverlay from 'react-native-modal-overlay';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MapsService, UsersService, PushNotificationsService } from 'therr-react/services';
import { AccessCheckType, IMapState as IMapReduxState, INotificationsState, IReactionsState, IUserState } from 'therr-react/types';
import { IAreaType } from 'therr-js-utilities/types';
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
import BottomSheetPlus from '../../components/BottomSheet/BottomSheetPlus';
import MapBottomSheetContent from '../../components/BottomSheet/MapBottomSheetContent';
import TherrMapView from './TherrMapView';
import { isMyContent } from '../../utilities/content';

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
    findMomentReactions: Function;
    findSpaceReactions: Function;
    updateCoordinates: Function;
    searchMoments: Function;
    searchSpaces: Function;
    setInitialUserLocation: Function;
    setSearchDropdownVisibility: Function;
    deleteMoment: Function;
    updateGpsStatus: Function;
    updateLocationDisclosure: Function;
    updateLocationPermissions: Function;
    updateUser: Function;
    updateTour: Function;
    updateFirstTimeUI: Function;
}

interface IStoreProps extends IMapDispatchProps {
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
    areButtonsVisible: boolean;
    areLayersVisible: boolean;
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
    isLocationUseDisclosureModalVisible: boolean;
    isMinLoadTimeComplete: boolean;
    isSearchThisLocationBtnVisible: boolean;
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
            updateCoordinates: MapActions.updateCoordinates,
            searchMoments: MapActions.searchMoments,
            searchSpaces: MapActions.searchSpaces,
            setInitialUserLocation: MapActions.setInitialUserLocation,
            setSearchDropdownVisibility: MapActions.setSearchDropdownVisibility,
            deleteMoment: MapActions.deleteMoment,
            createOrUpdateMomentReaction: ReactionActions.createOrUpdateMomentReaction,
            createOrUpdateSpaceReaction: ReactionActions.createOrUpdateSpaceReaction,
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
    private localeShort = 'en-US'; // TODO: Derive from user locale
    private mapRef: any;
    private mapWatchId;
    private theme = buildStyles();
    private themeAlerts = buildAlertStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeBottomSheet = buildBottomSheetStyles();
    private themeButtons = buildButtonStyles();
    private themeLoader = buildLoaderStyles();
    private themeMenu = buildMenuStyles();
    private themeDisclosure = buildDisclosureStyles();
    private themeTour = buildTourStyles();
    private themeSearch = buildSearchStyles({ viewPortHeight });
    private timeoutIdLocationReady;
    private timeoutIdRefreshMoments;
    private timeoutIdShowMomentAlert;
    private timeoutIdSearchButton;
    private timeoutIdWaitForSearchSelect;
    private translate: Function;
    private unsubscribeBlurListener: any;
    private unsubscribeFocusListener: any;
    private unsubscribeNavigationListener: any;

    constructor(props) {
        super(props);

        const routeLongitude = props.route?.params?.longitude;
        const routeLatitude = props.route?.params?.latitude;

        this.state = {
            areButtonsVisible: true,
            areLayersVisible: false,
            region: {},
            shouldFollowUserLocation: false,
            isConfirmModalVisible: false,
            isScrollEnabled: true,
            isAreaAlertVisible: false,
            isLocationUseDisclosureModalVisible: false,
            isLocationReady: false,
            isMinLoadTimeComplete: false,
            isSearchThisLocationBtnVisible: false,
            shouldIgnoreSearchThisAreaButton: false,
            shouldRenderMapCircles: false,
            shouldShowCreateActions: false,
            circleCenter: {
                longitude: routeLongitude || DEFAULT_LONGITUDE,
                latitude: routeLatitude || DEFAULT_LATITUDE,
            },
        };

        this.reloadTheme();
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount = async () => {
        const { navigation, setSearchDropdownVisibility, updateFirstTimeUI, updateTour, route, user } = this.props;

        if (user.details?.loginCount < 3 && !user.settings?.hasCompletedFTUI) {
            updateTour(user.details.id, {
                isTouring: true,
            });
            updateFirstTimeUI(true);
        }

        if (!route.params?.longitude || !route.params?.latitude) {
            this.handleSearchSelect(DEFAULT_MAP_SEARCH);
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
            this.expandBottomSheet(-1);
            this.setState({
                areButtonsVisible: true,
            });
            setSearchDropdownVisibility(false);
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
    }

    clearTimeouts = () => {
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
        }, ANIMATE_TO_REGION_DURATION_SLOW + 2000); // Add some buffer room
    };

    hasNoMapfilters = () => {
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
        if (this.hasNoMapfilters()) {
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
            passesFilterVisibility = mapFilters.filtersVisibility.some(filter => {
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
        this.setState({
            isAreaAlertVisible: false,
        });
    };

    expandBottomSheet = (index = 1, shouldToggle = false) => {
        const { areButtonsVisible, areLayersVisible } = this.state;
        this.setState({
            areButtonsVisible: false,
            areLayersVisible: false,
        });
        if (index < 0) {
            this.bottomSheetRef?.current?.close();
        } else {
            if (shouldToggle && !areButtonsVisible && !areLayersVisible) {
                // UX: Helps users more easily understand that they can hide the bottom sheet and show buttons
                this.bottomSheetRef?.current?.close();
            } else {
                this.bottomSheetRef?.current?.snapToIndex(index);
            }
        }
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

    handleCreate = (action: ICreateMomentAction = 'moment') => {
        const { location, navigation } = this.props;
        const { circleCenter } = this.state;

        this.setState({
            shouldShowCreateActions: false,
        });

        if (location?.settings?.isGpsEnabled) {
            // TODO: Store permissions in redux
            const storePermissions = () => {};

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
            this.showAreaAlert();
        }
    };

    handleGpsRecenterPress = () => {
        const {
            location,
            map,
            setInitialUserLocation,
            updateCoordinates,
            updateGpsStatus,
            updateLocationDisclosure,
            updateLocationPermissions,
        } = this.props;

        ReactNativeHapticFeedback.trigger('impactLight', hapticFeedbackOptions);

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
                            if (map.longitude && map.latitude && map.hasUserLocationLoaded) {
                                const coords = {
                                    longitude: map.longitude,
                                    latitude: map.latitude,
                                };
                                this.setState({
                                    circleCenter: coords,
                                });
                                updateCoordinates(coords);
                                this.handleGpsRecenter(coords, null, ANIMATE_TO_REGION_DURATION);
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
                                this.setState({
                                    circleCenter: coords,
                                });
                                setInitialUserLocation();
                                updateCoordinates(coords);
                                this.handleGpsRecenter(coords, null, ANIMATE_TO_REGION_DURATION_SLOW);
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
        });
    };

    handleOpenMapFiltersPress = () => {
        const { navigation } = this.props;
        navigation.navigate('MapFilteredSearch');
    };

    // TODO: Call this when user has traveled a certain distance from origin
    handleRefreshMoments = (overrideThrottle = false, coords?: any) => {
        const { isMinLoadTimeComplete } = this.state;

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
        const { findMomentReactions, findSpaceReactions, map, searchMoments, searchSpaces } = this.props;
        const userCoords = coords || {
            longitude: map.longitude,
            latitude: map.latitude,
        };
        // TODO: Consider making this one, dynamic request to add efficiency
        searchMoments({
            query: 'me',
            itemsPerPage: 50,
            pageNumber: 1,
            order: 'desc',
            filterBy: 'fromUserIds',
            ...userCoords,
        });
        searchSpaces({
            query: 'me',
            itemsPerPage: 50,
            pageNumber: 1,
            order: 'desc',
            filterBy: 'fromUserIds',
            ...userCoords,
        });
        Promise.all([
            searchMoments({
                query: 'connections',
                itemsPerPage: AREAS_SEARCH_COUNT,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                ...userCoords,
            }),
            searchSpaces({
                query: 'connections',
                itemsPerPage: AREAS_SEARCH_COUNT,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                ...userCoords,
            }),
        ]).then(([moments, spaces]) => {
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
        });
        this.setState({
            lastMomentsRefresh: Date.now(),
        });
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

    handleSearchSelect = (selection) => {
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
                this.handleSearchThisLocation(searchRadiusMeters, geometry.location.lat, geometry.location.lng);
            }
        }).catch((error) => {
            console.log(error);
        });
    };

    handleSearchThisLocation = (searchRadius?, latitude?, longitude?) => {
        const { findMomentReactions, findSpaceReactions, searchMoments, searchSpaces } = this.props;
        const { region } = this.state;
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
            searchMoments({
                query: 'me',
                itemsPerPage: 20,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                latitude: lat,
                longitude: long,
            }, {
                distanceOverride: radius,
            });
            searchSpaces({
                query: 'me',
                itemsPerPage: 20,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                latitude: lat,
                longitude: long,
            }, {
                distanceOverride: radius,
            });
            Promise.all([
                searchMoments({
                    query: 'connections',
                    itemsPerPage: AREAS_SEARCH_COUNT_ZOOMED,
                    pageNumber: 1,
                    order: 'desc',
                    filterBy: 'fromUserIds',
                    latitude: lat,
                    longitude: long,
                }, {
                    distanceOverride: radius,
                }),
                searchSpaces({
                    query: 'connections',
                    itemsPerPage: AREAS_SEARCH_COUNT_ZOOMED,
                    pageNumber: 1,
                    order: 'desc',
                    filterBy: 'fromUserIds',
                    latitude: lat,
                    longitude: long,
                }, {
                    distanceOverride: radius,
                }),
            ]).then(([moments, spaces]) => {
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
            });
        }
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

    showAreaAlert = () => {
        this.setState({
            isAreaAlertVisible: true,
        });

        this.timeoutIdShowMomentAlert = setTimeout(() => {
            this.setState({
                isAreaAlertVisible: false,
            });
        }, 2000);
    };

    hideMomentActions = () => this.toggleMomentActions(true);

    toggleMomentActions = (shouldHide: boolean = false) => {
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
        const { map } = this.props;

        if (shouldFollowUserLocation === false) {
            this.animateToWithHelp(() => {
                this.mapRef && this.mapRef.animateToRegion({
                    longitude: map.longitude,
                    latitude: map.latitude,
                    latitudeDelta: PRIMARY_LATITUDE_DELTA,
                    longitudeDelta: PRIMARY_LONGITUDE_DELTA,
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
        });
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
        this.setState({
            circleCenter: center,
        });
    };

    updateMapRef = (ref: Ref<MapView>) => { this.mapRef = ref; };

    updateRegion = (region) => {
        const { map } = this.props;
        const mapFilters = {
            filtersAuthor: map.filtersAuthor,
            filtersCategory: map.filtersCategory,
            filtersVisibility: map.filtersVisibility,
        };
        const filteredMoments = this.getFilteredAreas(map.moments, mapFilters);
        const filteredSpaces = this.getFilteredAreas(map.spaces, mapFilters);
        const filteredAreasCount = filteredMoments.length + filteredSpaces.length;
        this.onRegionChangeComplete(region, filteredAreasCount);
    };

    render() {
        const {
            areButtonsVisible,
            areLayersVisible,
            circleCenter,
            shouldShowCreateActions,
            isConfirmModalVisible,
            isLocationReady,
            isLocationUseDisclosureModalVisible,
            isMinLoadTimeComplete,
            isAreaAlertVisible,
            isSearchThisLocationBtnVisible,
            isScrollEnabled,
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
                                animateToWithHelp={this.animateToWithHelp}
                                circleCenter={circleCenter}
                                expandBottomSheet={this.expandBottomSheet}
                                route={route}
                                filteredMoments={filteredMoments}
                                filteredSpaces={filteredSpaces}
                                mapRef={this.updateMapRef}
                                navigation={navigation}
                                onRegionChange={this.onRegionChange}
                                onRegionChangeComplete={this.updateRegion}
                                showAreaAlert={this.showAreaAlert}
                                shouldFollowUserLocation={shouldFollowUserLocation}
                                shouldRenderMapCircles={shouldRenderMapCircles}
                                hideCreateActions={this.hideMomentActions}
                                isScrollEnabled={isScrollEnabled}
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
                                    message={this.translate('pages.map.areaAlerts.walkCloser')}
                                    type="error"
                                    themeAlerts={this.themeAlerts}
                                />
                            </AnimatedOverlay>
                        </>
                    )}
                    {
                        (isSearchThisLocationBtnVisible && !isDropdownVisible) &&
                        <SearchThisAreaButtonGroup
                            handleSearchLocation={this.handleSearchThisLocation}
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
                                filters={mapFilters}
                                goToMoments={this.goToMoments}
                                goToNotifications={this.goToNotifications}
                                hasNotifications={hasNotifications}
                                handleCreate={this.handleCreate}
                                handleGpsRecenter={this.handleGpsRecenterPress}
                                handleOpenMapFilters={this.handleOpenMapFiltersPress}
                                toggleMomentActions={this.toggleMomentActions}
                                shouldShowCreateActions={shouldShowCreateActions}
                                isAuthorized={this.isAuthorized}
                                isGpsEnabled={location?.settings?.isGpsEnabled}
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
                />
                {
                    <BottomSheetPlus
                        sheetRef={(sheetRef: React.RefObject<BottomSheetMethods>) => { this.bottomSheetRef = sheetRef; }}
                        initialIndex={-1}
                        onClose={this.onBottomSheetClose}
                        themeBottomSheet={this.themeBottomSheet}
                    >
                        <MapBottomSheetContent
                            navigation={navigation}
                            theme={this.theme}
                            translate={this.translate}
                        />
                    </BottomSheetPlus>
                }
                <MainButtonMenu
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
