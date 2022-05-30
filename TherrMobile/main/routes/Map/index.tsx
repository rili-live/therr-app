import React, { Ref } from 'react';
import { Dimensions, PermissionsAndroid, Keyboard, Platform, SafeAreaView, View } from 'react-native';
import { StackActions } from '@react-navigation/native';
import MapView from 'react-native-map-clustering';
import { PROVIDER_GOOGLE, Circle, Marker } from 'react-native-maps';
import AnimatedOverlay from 'react-native-modal-overlay';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MapsService, UsersService, PushNotificationsService } from 'therr-react/services';
import { IAreaType, AccessCheckType, IMapState as IMapReduxState, INotificationsState, IReactionsState, IUserState } from 'therr-react/types';
import { MapActions, ReactionActions, UserInterfaceActions } from 'therr-react/redux/actions';
import { AccessLevels, Location } from 'therr-js-utilities/constants';
import Geolocation from 'react-native-geolocation-service';
import AnimatedLoader from 'react-native-animated-loader';
import { distanceTo, insideCircle } from 'geolocation-utils';
import ImageCropPicker from 'react-native-image-crop-picker';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { GOOGLE_APIS_ANDROID_KEY, GOOGLE_APIS_IOS_KEY } from 'react-native-dotenv';
import MapActionButtons, { ICreateMomentAction } from './MapActionButtons';
import Alert from '../../components/Alert';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import { ILocationState } from '../../types/redux/location';
import LocationActions from '../../redux/actions/LocationActions';
import translator from '../../services/translator';
import {
    INITIAL_LATITUDE_DELTA,
    INITIAL_LONGITUDE_DELTA,
    PRIMARY_LATITUDE_DELTA,
    PRIMARY_LONGITUDE_DELTA,
    MIN_LOAD_TIMEOUT,
    DEFAULT_MOMENT_PROXIMITY,
    MIN_ZOOM_LEVEL,
    MOMENTS_REFRESH_THROTTLE_MS,
    LOCATION_PROCESSING_THROTTLE_MS,
} from '../../constants';
import { buildStyles, loaderStyles } from '../../styles';
import { buildStyles as buildAlertStyles } from '../../styles/alerts';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildLoaderStyles } from '../../styles/loaders';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildDisclosureStyles } from '../../styles/modal/locationDisclosure';
import { buildStyles as buildTourStyles } from '../../styles/modal/tourModal';
import { buildStyles as buildSearchStyles } from '../../styles/modal/typeAhead';
import mapStyles from '../../styles/map';
import mapCustomStyle from '../../styles/map/googleCustom';
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
import MarkerIcon from './MarkerIcon';
import { isMyArea } from '../../utilities/content';
import LocationUseDisclosureModal from '../../components/Modals/LocationUseDisclosureModal';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import eula from './EULA';
import UsersActions from '../../redux/actions/UsersActions';
import TouringModal from '../../components/Modals/TouringModal';

const { height: viewPortHeight, width: viewportWidth } = Dimensions.get('window');
const earthLoader = require('../../assets/earth-loader.json');

const ANIMATE_TO_REGION_DURATION = 750;
const ANIMATE_TO_REGION_DURATION_SLOW = 1500;
const ANIMATE_TO_REGION_DURATION_FAST = 500;
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
    activeMoment: any;
    activeMomentDetails: any;
    activeSpace: any;
    activeSpaceDetails: any;
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
    shouldShowCreateActions: boolean;
    lastMomentsRefresh?: number,
    lastLocationSendForProcessing?: number,
    lastLocationSendForProcessingCoords?: {
        longitude: number,
        latitude: number,
    },
    circleCenter: any;
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
            updateGpsStatus: LocationActions.updateGpsStatus,
            updateLocationDisclosure: LocationActions.updateLocationDisclosure,
            updateLocationPermissions: LocationActions.updateLocationPermissions,
            updateUser: UsersActions.update,
            updateTour: UsersActions.updateTour,
            updateFirstTimeUI: UsersActions.updateFirstTimeUI,
        },
        dispatch
    );

class Map extends React.Component<IMapProps, IMapState> {
    private localeShort = 'en-US'; // TODO: Derive from user locale
    private mapRef: any;
    private mapWatchId;
    private theme = buildStyles();
    private themeAlerts = buildAlertStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeButtons = buildButtonStyles();
    private themeLoader = buildLoaderStyles();
    private themeMenu = buildMenuStyles();
    private themeDisclosure = buildDisclosureStyles();
    private themeTour = buildTourStyles();
    private themeSearch = buildSearchStyles({ viewPortHeight });
    private timeoutId;
    private timeoutIdGoToArea;
    private timeoutIdRefreshMoments;
    private timeoutIdShowMoment;
    private timeoutIdSearchButton;
    private timeoutIdWaitForSearchSelect;
    private translate: Function;
    private unsubscribeFocusListener: any;
    private unsubscribeNavigationListener: any;

    constructor(props) {
        super(props);

        const routeLongitude = props.route?.params?.longitude;
        const routeLatitude = props.route?.params?.latitude;

        this.state = {
            activeMoment: {},
            activeMomentDetails: {},
            activeSpace: {},
            activeSpaceDetails: {},
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
            shouldShowCreateActions: false,
            circleCenter: {
                longitude: routeLongitude || -99.458829,
                latitude: routeLatitude || 39.7629981,
            },
        };

        this.reloadTheme();
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount = async () => {
        const { navigation, route, setSearchDropdownVisibility, updateFirstTimeUI, updateTour, user } = this.props;

        if (user.details?.loginCount < 5 && !user.settings?.hasCompletedFTUI) {
            updateTour(user.details.id, {
                isTouring: true,
            });
            updateFirstTimeUI(true);
        }

        this.handleSearchSelect(DEFAULT_MAP_SEARCH);

        this.unsubscribeNavigationListener = navigation.addListener('state', () => {
            setSearchDropdownVisibility(false);
            clearTimeout(this.timeoutId);
            this.setState({
                isMinLoadTimeComplete: true,
                isLocationReady: true,
            });
        });

        this.unsubscribeFocusListener = navigation.addListener('focus', () => {
            setSearchDropdownVisibility(false);
            clearTimeout(this.timeoutId);

            // TODO: Determine why the mapview interferes with this animation
            // This is sloppy/bad code. We should find a better way
            /** Animate to region when user selection area location from other views (earth icon) */
            if (Platform.OS === 'ios' && route.params?.latitude && route.params?.longitude) {
                const loc = {
                    latitude: route.params.latitude,
                    longitude: route.params.longitude,
                    latitudeDelta: route.params.longitudeDelta || PRIMARY_LATITUDE_DELTA,
                    longitudeDelta: route.params.latitudeDelta || PRIMARY_LONGITUDE_DELTA,
                };

                const weirdTimeout = 512;

                this.timeoutIdGoToArea = setTimeout(() => {
                    this.animateToWithHelp(() => this?.mapRef.animateToRegion(loc, ANIMATE_TO_REGION_DURATION));
                }, weirdTimeout);
            }
        });

        navigation.setOptions({
            title: this.translate('pages.map.headerTitle'),
        });

        this.timeoutId = setTimeout(() => {
            this.setState({
                isMinLoadTimeComplete: true,
                isLocationReady: true,
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
        clearTimeout(this.timeoutId);
        clearTimeout(this.timeoutIdGoToArea);
        clearTimeout(this.timeoutIdRefreshMoments);
        clearTimeout(this.timeoutIdShowMoment);
        clearTimeout(this.timeoutIdSearchButton);
        clearTimeout(this.timeoutIdWaitForSearchSelect);
        if (this.unsubscribeNavigationListener) {
            this.unsubscribeNavigationListener();
        }
        if (this.unsubscribeFocusListener) {
            this.unsubscribeFocusListener();
        }
    }

    reloadTheme = (shouldForceUpdate: boolean = false) => {
        const themeName = this.props.user.settings?.mobileThemeName;
        this.theme = buildStyles(themeName);
        this.themeAlerts = buildAlertStyles(themeName);
        this.themeConfirmModal = buildConfirmModalStyles(themeName);
        this.themeButtons = buildButtonStyles(themeName);
        this.themeLoader = buildLoaderStyles(themeName);
        this.themeMenu = buildMenuStyles(themeName);
        this.themeDisclosure = buildDisclosureStyles(themeName);
        this.themeTour = buildTourStyles(themeName);
        this.themeSearch = buildSearchStyles({ viewPortHeight }, themeName);

        if (shouldForceUpdate) {
            this.forceUpdate();
        }
    }

    animateToWithHelp = (doAnimate) => {
        this.setState({
            shouldIgnoreSearchThisAreaButton: true,
        });
        doAnimate();
        clearTimeout(this.timeoutIdSearchButton);
        clearTimeout(this.timeoutIdWaitForSearchSelect);
        this.timeoutIdWaitForSearchSelect = setTimeout(() => {
            this.setState({
                shouldIgnoreSearchThisAreaButton: false,
            });
        }, ANIMATE_TO_REGION_DURATION_SLOW + 2000); // Add some buffer room
    }

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
    }

    getAreaDetails = (area) => new Promise((resolve) => {
        const { user } = this.props;
        const details: any = {};

        if (isMyArea(area, user)) {
            details.userDetails = user.details;
        }

        return resolve(details);
    });

    handleImageSelect = (imageResponse, userCoords, areaType: IAreaType = 'moments') => {
        const { navigation } = this.props;
        const routeName = areaType === 'spaces' ? 'EditSpace' : 'EditMoment';

        if (!imageResponse.didCancel && !imageResponse.errorCode) {
            return navigation.navigate(routeName, {
                ...userCoords,
                imageDetails: imageResponse,
            });
        }
    }

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
    }

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
                navigation.navigate('EditMoment', {
                    ...circleCenter,
                    imageDetails: {},
                });
                return;
            }

            if (action === 'claim') {
                navigation.navigate('EditSpace', {
                    ...circleCenter,
                    imageDetails: {},
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

    // TODO: Ask for location permissions if not enabled
    handleCompassRealign = () => {
        this.mapRef && this.mapRef.animateCamera({ heading: 0 });
        this.setState({
            areLayersVisible: false,
        });
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

        this.setState({
            shouldShowCreateActions: false,
        });

        this.timeoutId = setTimeout(() => {
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
    }

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
    }

    /**
     * On press handler for any map press. Handles pressing an area, and determines when view or bottom-sheet menu to open
     */
    handleMapPress = ({ nativeEvent }) => {
        const {
            createOrUpdateMomentReaction,
            createOrUpdateSpaceReaction,
            location,
            map,
            navigation,
            setSearchDropdownVisibility,
            user,
        } = this.props;
        const { circleCenter } = this.state;
        const mapFilters = {
            filtersAuthor: map.filtersAuthor,
            filtersCategory: map.filtersCategory,
            filtersVisibility: map.filtersVisibility,
        };
        let visibleMoments: any[] = this.getFilteredAreas(map.moments.concat(map.myMoments), mapFilters);
        let visibleSpaces: any[] = this.getFilteredAreas(map.spaces.concat(map.mySpaces), mapFilters);

        this.setState({
            shouldShowCreateActions: false,
        });

        setSearchDropdownVisibility(false);

        this.setState({
            areLayersVisible: false,
        });

        const pressedSpaces = visibleSpaces.filter((space) => {
            return insideCircle(nativeEvent.coordinate, {
                lon: space.longitude,
                lat: space.latitude,
            }, space.radius);
        });

        if (pressedSpaces.length) {
            ReactNativeHapticFeedback.trigger('impactLight', hapticFeedbackOptions);

            this.setState({
                activeMoment: {},
                activeMomentDetails: {},
            });

            const selectedSpace = pressedSpaces[0];
            const distToCenter = distanceTo({
                lon: circleCenter.longitude,
                lat: circleCenter.latitude,
            }, {
                lon: selectedSpace.longitude,
                lat: selectedSpace.latitude,
            });
            const isProximitySatisfied = distToCenter - selectedSpace.radius <= selectedSpace.maxProximity;
            if (!isProximitySatisfied
                && !isMyArea(selectedSpace, user)
                && !(selectedSpace.userHasActivated && !selectedSpace.doesRequireProximityToView)) {
                // Deny activation
                this.showAreaAlert();
            } else {
                // Activate space
                createOrUpdateSpaceReaction(selectedSpace.id, {
                    userViewCount: 1,
                    userHasActivated: true,
                });
                this.getAreaDetails(selectedSpace)
                    .then((details) => {
                        this.setState({
                            activeSpace: selectedSpace,
                            activeSpaceDetails: details,
                        }, () => {
                            if (location?.settings?.isGpsEnabled) {
                                navigation.navigate('ViewSpace', {
                                    isMyArea: isMyArea(selectedSpace, user),
                                    space: selectedSpace,
                                    spaceDetails: details,
                                });
                            } else {
                                // TODO: Alert that GPS is required to create a space
                                this.showAreaAlert();
                            }
                        });
                    })
                    .catch(() => {
                        // TODO: Add error handling
                        console.log('Failed to get space details!');
                    });
            }
        } else {
            this.setState({
                activeSpace: {},
                activeSpaceDetails: {},
            });

            const pressedMoments = visibleMoments.filter((moment) => {
                return insideCircle(nativeEvent.coordinate, {
                    lon: moment.longitude,
                    lat: moment.latitude,
                }, moment.radius);
            });

            if (pressedMoments.length) {
                const selectedMoment = pressedMoments[0];
                const distToCenter = distanceTo({
                    lon: circleCenter.longitude,
                    lat: circleCenter.latitude,
                }, {
                    lon: selectedMoment.longitude,
                    lat: selectedMoment.latitude,
                });
                const isProximitySatisfied = distToCenter - selectedMoment.radius <= selectedMoment.maxProximity;
                if (!isProximitySatisfied
                    && !isMyArea(selectedMoment, user)
                    && !(selectedMoment.userHasActivated && !selectedMoment.doesRequireProximityToView)) {
                    // Deny activation
                    this.showAreaAlert();
                } else {
                    // Activate moment
                    createOrUpdateMomentReaction(selectedMoment.id, {
                        userViewCount: 1,
                        userHasActivated: true,
                    }, selectedMoment.fromUserId, user.details.userName);
                    this.getAreaDetails(selectedMoment)
                        .then((details) => {
                            this.setState({
                                activeMoment: selectedMoment,
                                activeMomentDetails: details,
                            }, () => {
                                if (location?.settings?.isGpsEnabled) {
                                    navigation.navigate('ViewMoment', {
                                        isMyArea: isMyArea(selectedMoment, user),
                                        moment: selectedMoment,
                                        momentDetails: details,
                                    });
                                } else {
                                    // TODO: Alert that GPS is required to create a moment
                                    this.showAreaAlert();
                                }
                            });
                        })
                        .catch(() => {
                            // TODO: Add error handling
                            console.log('Failed to get moment details!');
                        });
                }
            } else {
                this.setState({
                    activeMoment: {},
                    activeMomentDetails: {},
                });
            }
        }
    };

    // TODO: Call this when user has traveled a certain distance from origin
    handleRefreshMoments = (overrideThrottle = false, coords?: any) => {
        const { isMinLoadTimeComplete } = this.state;

        if (!isMinLoadTimeComplete) {
            this.timeoutIdRefreshMoments = setTimeout(() => {
                this.handleRefreshMoments(overrideThrottle, coords);
            }, 50);

            return;
        }

        clearTimeout(this.timeoutIdRefreshMoments);

        this.setState({
            areLayersVisible: false,
        });
        if (!overrideThrottle && this.state.lastMomentsRefresh &&
            (Date.now() - this.state.lastMomentsRefresh <= MOMENTS_REFRESH_THROTTLE_MS)) {
            return;
        }
        const { map, searchMoments, searchSpaces } = this.props;
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
        searchMoments({
            query: 'connections',
            itemsPerPage: 500,
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
        searchSpaces({
            query: 'connections',
            itemsPerPage: 500,
            pageNumber: 1,
            order: 'desc',
            filterBy: 'fromUserIds',
            ...userCoords,
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
    }

    handleLocationDisclosureSelect = (selection) => {
        const { updateLocationDisclosure } = this.props;
        // TODO: Decide if selection should be dynamic
        console.log(selection);
        updateLocationDisclosure(true).then(() => {
            this.toggleLocationUseDisclosure();
            this.handleGpsRecenterPress();
        });
    }

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
    }

    handleSearchThisLocation = (searchRadius?, latitude?, longitude?) => {
        const { searchMoments, searchSpaces } = this.props;
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
                query: 'connections',
                itemsPerPage: 200,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                latitude: lat,
                longitude: long,
            }, {
                distanceOverride: radius,
            });
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
                query: 'connections',
                itemsPerPage: 200,
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
        }
    }

    handleStopTouring = () => {
        const { user, updateTour } = this.props;
        updateTour(user.details.id, {
            isTouring: false,
        });
    }

    isAuthorized = () => {
        const { user } = this.props;
        return UsersService.isAuthorized(
            {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            user
        );
    }

    onConfirmModalCancel = () => {
        this.setState({
            isConfirmModalVisible: false,
        });
    }

    onConfirmModalAccept = () => {
        const { user, updateUser } = this.props;
        this.setState({
            isConfirmModalVisible: false,
        });

        // Update user property to show confirmed
        updateUser(user.details.id, { hasAgreedToTerms: true }).then(() => {
            this.handleCreate('upload');
        });
    }

    onDeleteMoment = (moment) => {
        const { deleteMoment, user } = this.props;
        if (isMyArea(moment, user)) {
            deleteMoment({ ids: [moment.id] })
                .then(() => {
                    console.log('Moment successfully deleted');
                })
                .catch((err) => {
                    console.log('Error deleting moment', err);
                });
        }
    };

    toggleLocationUseDisclosure = () => {
        const { isLocationUseDisclosureModalVisible } = this.state;
        this.setState({
            isLocationUseDisclosureModalVisible: !isLocationUseDisclosureModalVisible,
        });
    }

    onUserLocationChange = (event) => {
        const {
            shouldFollowUserLocation,
            lastLocationSendForProcessing,
            lastLocationSendForProcessingCoords,
        } = this.state;
        const {
            map,
            updateCoordinates,
        } = this.props;
        const coords = {
            latitude: event.nativeEvent.coordinate.latitude,
            longitude: event.nativeEvent.coordinate.longitude,
        };
        // TODO: Add throttle
        updateCoordinates(coords);
        this.setState({
            circleCenter: coords,
        });

        if (shouldFollowUserLocation) {
            const loc = {
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: PRIMARY_LATITUDE_DELTA,
                longitudeDelta: PRIMARY_LONGITUDE_DELTA,
            };
            this.animateToWithHelp(() => this.mapRef && this.mapRef.animateToRegion(loc, ANIMATE_TO_REGION_DURATION_FAST));
        }


        if (!map.hasUserLocationLoaded) {
            return;
        }

        if (lastLocationSendForProcessing) {
            if (Date.now() - lastLocationSendForProcessing <= LOCATION_PROCESSING_THROTTLE_MS) {
                return;
            }

            if (lastLocationSendForProcessingCoords) {
                const timeOfTravel = Date.now() - lastLocationSendForProcessing;
                const distanceTraveledMeters = distanceTo({
                    lon: coords.longitude,
                    lat: coords.latitude,
                }, {
                    lon: lastLocationSendForProcessingCoords.longitude,
                    lat: lastLocationSendForProcessingCoords.latitude,
                });
                const kmPerHour = distanceTraveledMeters / (timeOfTravel * 60 * 60);

                if (distanceTraveledMeters < 5) {
                    return;
                }

                if (kmPerHour > 15) { // Don't send location until user slows down to a walking pace
                    return;
                }
            }
        }

        // Send location to backend for processing
        PushNotificationsService.postLocationChange({
            longitude: coords.longitude,
            latitude: coords.latitude,
            lastLocationSendForProcessing,
            radiusOfAwareness: map.radiusOfAwareness,
            radiusOfInfluence: map.radiusOfInfluence,
        });

        this.setState({
            lastLocationSendForProcessing: Date.now(),
            lastLocationSendForProcessingCoords: {
                longitude: coords.longitude,
                latitude: coords.latitude,
            },
        });
    };

    onRegionChange = (region) => {
        if (region.latitude.toFixed(6) === this.state.region?.latitude?.toFixed(6)
            && region.longitude.toFixed(6) === this.state.region?.longitude?.toFixed(6)) {
            return;
        }

        this.setState({
            isSearchThisLocationBtnVisible: false,
            region,
        });

        clearTimeout(this.timeoutIdSearchButton);
        if (!this.state.shouldIgnoreSearchThisAreaButton) {
            this.timeoutIdSearchButton = setTimeout(() => {
                this.setState({
                    isSearchThisLocationBtnVisible: true,
                });
            }, 1000);
        }
    }

    onRegionChangeComplete = () => {
        this.setState({
            isSearchThisLocationBtnVisible: false,
        });
    }

    showAreaAlert = () => {
        this.setState({
            isAreaAlertVisible: true,
        });

        this.timeoutIdShowMoment = setTimeout(() => {
            this.setState({
                isAreaAlertVisible: false,
            });
        }, 2000);
    };

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
    }

    toggleMomentBtns = () => {
        this.setState({
            areButtonsVisible: !this.state.areButtonsVisible,
            areLayersVisible: false,
        });
    }

    getFilteredAreas = (areas, mapFilters) => {
        // Filter for duplicates
        const areasMap = {};
        areas.forEach(area => areasMap[area.id] = area);
        let filteredAreas: any = Object.values(areasMap);
        if ((!mapFilters.filtersAuthor?.length && !mapFilters.filtersCategory?.length && !mapFilters.filtersVisibility?.length)
            || (mapFilters.filtersAuthor[0]?.isChecked && mapFilters.filtersCategory[0]?.isChecked && mapFilters.filtersVisibility[0]?.isChecked)) {
            return filteredAreas;
        }

        const filteredAreasMap = {};
        // Only requires one loop to check each area
        filteredAreas.forEach(area => {
            if (this.shouldRenderArea(area, mapFilters)) {
                filteredAreasMap[area.id] = area;
            }
        });

        return Object.values(filteredAreasMap);
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

                return (isMyArea(area, user) && filter.name === 'me') || (!isMyArea(area, user) && filter.name === 'notMe');
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
    }

    getMomentCircleFillColor = (moment) => {
        const { user } = this.props;
        const { activeMoment } = this.state;

        if (moment.id === activeMoment.id) {
            return isMyArea(moment, user) ? this.theme.colors.map.myMomentsCircleFillActive  : this.theme.colors.map.momentsCircleFillActive;
        }

        return isMyArea(moment, user) ? this.theme.colors.map.myMomentsCircleFill : this.theme.colors.map.momentsCircleFill;
    }

    getSpaceCircleFillColor = (space) => {
        const { user } = this.props;
        const { activeSpace } = this.state;

        if (space.id === activeSpace.id) {
            return isMyArea(space, user) ? this.theme.colors.map.mySpacesCircleFillActive  : this.theme.colors.map.spacesCircleFillActive;
        }

        return isMyArea(space, user) ? this.theme.colors.map.mySpacesCircleFill : this.theme.colors.map.spacesCircleFill;
    }

    render() {
        const {
            areButtonsVisible,
            areLayersVisible,
            circleCenter,
            shouldFollowUserLocation,
            shouldShowCreateActions,
            isConfirmModalVisible,
            isLocationReady,
            isLocationUseDisclosureModalVisible,
            isMinLoadTimeComplete,
            isAreaAlertVisible,
            isScrollEnabled,
            isSearchThisLocationBtnVisible,
        } = this.state;
        const { captureClickTarget, location, map, navigation, notifications, user } = this.props;
        const searchPredictionResults = map?.searchPredictions?.results || [];
        const isDropdownVisible = map?.searchPredictions?.isSearchDropdownVisible;
        const hasNotifications = notifications.messages && notifications.messages.some(m => m.isUnread);
        const isTouring = !!user?.settings?.isTouring;
        const mapFilters = {
            filtersAuthor: map.filtersAuthor,
            filtersCategory: map.filtersCategory,
            filtersVisibility: map.filtersVisibility,
        };
        const filteredMoments = this.getFilteredAreas(map.moments.concat(map.myMoments), mapFilters);
        const filteredSpaces = this.getFilteredAreas(map.spaces.concat(map.mySpaces), mapFilters);

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
                            <MapView
                                mapRef={(ref: Ref<MapView>) => { this.mapRef = ref; }}
                                provider={PROVIDER_GOOGLE}
                                style={mapStyles.mapView}
                                customMapStyle={mapCustomStyle}
                                initialRegion={{
                                    latitude: circleCenter.latitude,
                                    longitude: circleCenter.longitude,
                                    latitudeDelta: map.hasUserLocationLoaded ? PRIMARY_LATITUDE_DELTA : INITIAL_LATITUDE_DELTA,
                                    longitudeDelta: map.hasUserLocationLoaded ? PRIMARY_LONGITUDE_DELTA : INITIAL_LONGITUDE_DELTA,
                                }}
                                onPress={this.handleMapPress}
                                onRegionChange={this.onRegionChange}
                                onRegionChangeComplete={this.onRegionChangeComplete}
                                onUserLocationChange={this.onUserLocationChange}
                                showsUserLocation={true}
                                showsBuildings={true}
                                showsMyLocationButton={false}
                                showsCompass={false}
                                followsUserLocation={shouldFollowUserLocation}
                                scrollEnabled={isScrollEnabled}
                                minZoomLevel={MIN_ZOOM_LEVEL}
                                /* react-native-map-clustering */
                                clusterColor={this.theme.colors.brandingBlueGreen}
                                clusterFontFamily={this.theme.styles.headerTitleStyle.fontFamily}
                                clusterTextColor={this.theme.colors.brandingWhite}
                            >
                                <Circle
                                    center={circleCenter}
                                    radius={DEFAULT_MOMENT_PROXIMITY} /* meters */
                                    strokeWidth={1}
                                    strokeColor={this.theme.colors.brandingBlueGreen}
                                    fillColor={this.theme.colors.map.userCircleFill}
                                    zIndex={0}
                                />
                                {
                                    filteredMoments.map((moment) => {
                                        return (
                                            <Marker
                                                anchor={{
                                                    x: 0.5,
                                                    y: 0.5,
                                                }}
                                                key={moment.id}
                                                coordinate={{
                                                    longitude: moment.longitude,
                                                    latitude: moment.latitude,
                                                }}
                                                onPress={this.handleMapPress}
                                                stopPropagation={true}
                                            >
                                                <View style={{ /* transform: [{ translateY: 0 }] */ }}>
                                                    <MarkerIcon area={moment} areaType="moments" theme={this.theme} />
                                                </View>
                                            </Marker>
                                        );
                                    })
                                }
                                {
                                    filteredMoments.map((moment) => {
                                        return (
                                            <Circle
                                                key={moment.id}
                                                center={{
                                                    longitude: moment.longitude,
                                                    latitude: moment.latitude,
                                                }}
                                                radius={moment.radius} /* meters */
                                                strokeWidth={0}
                                                strokeColor={this.theme.colors.secondary}
                                                fillColor={this.getMomentCircleFillColor(moment)}
                                                zIndex={1}
                                            />
                                        );
                                    })
                                }
                                {
                                    filteredSpaces.map((space) => {
                                        return (
                                            <Marker
                                                anchor={{
                                                    x: 0.5,
                                                    y: 0.5,
                                                }}
                                                key={space.id}
                                                coordinate={{
                                                    longitude: space.longitude,
                                                    latitude: space.latitude,
                                                }}
                                                onPress={this.handleMapPress}
                                                stopPropagation={true}
                                            >
                                                <View style={{ /* transform: [{ translateY: 0 }] */ }}>
                                                    <MarkerIcon area={space} areaType="spaces" theme={this.theme} />
                                                </View>
                                            </Marker>
                                        );
                                    })
                                }
                                {
                                    filteredSpaces.map((space) => {
                                        return (
                                            <Circle
                                                key={space.id}
                                                center={{
                                                    longitude: space.longitude,
                                                    latitude: space.latitude,
                                                }}
                                                radius={space.radius} /* meters */
                                                strokeWidth={0}
                                                strokeColor={this.theme.colors.secondary}
                                                fillColor={this.getSpaceCircleFillColor(space)}
                                                zIndex={1}
                                            />
                                        );
                                    })
                                }
                            </MapView>
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
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.toggleMomentBtns}
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
