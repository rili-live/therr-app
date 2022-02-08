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
import * as ImagePicker from 'react-native-image-picker';
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
import FiltersButtonGroup from '../../components/FiltersButtonGroup';
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
    isTouring: boolean;
    shouldIgnoreSearchThisAreaButton: boolean;
    shouldShowCreateActions: boolean;
    lastMomentsRefresh?: number,
    lastLocationSendForProcessing?: number,
    lastLocationSendForProcessingCoords?: {
        longitude: number,
        latitude: number,
    },
    layers: any
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
    private themeMenu = buildMenuStyles();
    private themeDisclosure = buildDisclosureStyles();
    private themeTour = buildTourStyles();
    private themeSearch = buildSearchStyles({ viewPortHeight });
    private timeoutId;
    private timeoutIdGPSStart;
    private timeoutIdRefreshMoments;
    private timeoutIdShowMoment;
    private timeoutIdSearchButton;
    private timeoutIdWaitForSearchSelect;
    private translate: Function;
    private unsubscribeNavigationListener: any;

    constructor(props) {
        super(props);

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
            isTouring: false,
            isAreaAlertVisible: false,
            isLocationUseDisclosureModalVisible: false,
            isLocationReady: false,
            isMinLoadTimeComplete: false,
            isSearchThisLocationBtnVisible: false,
            shouldIgnoreSearchThisAreaButton: false,
            shouldShowCreateActions: false,
            layers: {
                myMoments: true,
                mySpaces: true,
                connectionsMoments: true,
                connectionsSpaces: true,
            },
            circleCenter: {
                longitude: -96.4683143,
                latitude: 32.8102631,
            },
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeAlerts = buildAlertStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeDisclosure = buildDisclosureStyles(props.user.settings?.mobileThemeName);
        this.themeTour = buildTourStyles(props.user.settings?.mobileThemeName);
        this.themeSearch = buildSearchStyles({ viewPortHeight }, props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount = async () => {
        const { navigation, setSearchDropdownVisibility } = this.props;

        this.unsubscribeNavigationListener = navigation.addListener('state', (event) => {
            const route = event.data.state.routes.find(route => route.name === 'Map');
            setSearchDropdownVisibility(false);
            if (route && route.params?.isTourEnabled) {
                this.setState({
                    isTouring: true,
                });
            } else {
                this.setState({
                    isTouring: false,
                });
            }
            clearTimeout(this.timeoutId);
            this.setState({
                isMinLoadTimeComplete: true,
                isLocationReady: true,
            });
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

    componentWillUnmount() {
        Geolocation.clearWatch(this.mapWatchId);
        clearTimeout(this.timeoutId);
        clearTimeout(this.timeoutIdGPSStart);
        clearTimeout(this.timeoutIdRefreshMoments);
        clearTimeout(this.timeoutIdShowMoment);
        clearTimeout(this.timeoutIdSearchButton);
        clearTimeout(this.timeoutIdWaitForSearchSelect);
        this.unsubscribeNavigationListener();
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

        if (!imageResponse.didCancel && !imageResponse.errorCode) {
            return navigation.navigate('AreaImageCrop', {
                ...userCoords,
                areaType,
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

    handleCreateMoment = (action: ICreateMomentAction = 'camera') => {
        const { location, navigation } = this.props;
        const { circleCenter } = this.state;

        if (location?.settings?.isGpsEnabled) {
            // TODO: Store permissions in redux
            const storePermissions = () => {};

            // No need to request camera permissions for text only
            if (action === 'text-only') {
                navigation.navigate('EditMoment', {
                    ...circleCenter,
                    imageDetails: {},
                });
            }

            return requestOSCameraPermissions(storePermissions).then((response) => {
                const permissionsDenied = Object.keys(response).some((key) => {
                    return response[key] !== 'granted';
                });
                if (!permissionsDenied) {
                    if (action === 'camera') {
                        return ImagePicker.launchCamera(
                            {
                                mediaType: 'photo',
                                includeBase64: false,
                                maxHeight: 4 * viewportWidth,
                                maxWidth: 4 * viewportWidth,
                                saveToPhotos: true,
                            },
                            (cameraResponse) => this.handleImageSelect(cameraResponse, circleCenter),
                        );
                    } else if (action === 'upload') {
                        return ImagePicker.launchImageLibrary(
                            {
                                mediaType: 'photo',
                                includeBase64: false,
                                maxHeight: 4 * viewportWidth,
                                maxWidth: 4 * viewportWidth,
                                // selectionLimit: 1,
                            },
                            (cameraResponse) => this.handleImageSelect(cameraResponse, circleCenter),
                        );
                    } else if (action === 'claim') {
                        return ImagePicker.launchImageLibrary(
                            {
                                mediaType: 'photo',
                                includeBase64: false,
                                maxHeight: 4 * viewportWidth,
                                maxWidth: 4 * viewportWidth,
                                // selectionLimit: 1,
                            },
                            (cameraResponse) => this.handleImageSelect(cameraResponse, circleCenter, 'spaces'),
                        );
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
                // Handle Permissions denied
            });

        } else {
            // TODO: Alert that GPS is required to create a moment
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
                    this.handleRefreshMoments(true, coords, true);
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
        const { circleCenter } = this.state;
        const loc = {
            latitude: coords?.latitude || circleCenter.latitude,
            longitude: coords?.longitude || circleCenter.longitude,
            latitudeDelta: delta?.latitudeDelta || PRIMARY_LATITUDE_DELTA,
            longitudeDelta: delta?.longitudeDelta || PRIMARY_LONGITUDE_DELTA,
        };
        this.animateToWithHelp(() => this.mapRef && this.mapRef.animateToRegion(loc, duration || ANIMATE_TO_REGION_DURATION));
        this.setState({
            areLayersVisible: false,
        });
    };

    handleMapPress = ({ nativeEvent }) => {
        const { createOrUpdateMomentReaction, createOrUpdateSpaceReaction, location, map, navigation, setSearchDropdownVisibility, user } = this.props;
        const { circleCenter, layers } = this.state;
        let visibleMoments: any[] = [];
        let visibleSpaces: any[] = [];

        this.setState({
            shouldShowCreateActions: false,
        });

        setSearchDropdownVisibility(false);

        this.setState({
            areLayersVisible: false,
        });

        if (layers.connectionsMoments) {
            visibleMoments = visibleMoments.concat(map.moments);
        }
        // TODO: Utilize mySpaces layer
        if (layers.myMoments) {
            visibleMoments = visibleMoments.concat(map.myMoments);
            visibleSpaces = visibleSpaces.concat(map.mySpaces);
        }

        const pressedSpaces = visibleSpaces.filter((space) => {
            return insideCircle(nativeEvent.coordinate, {
                lon: space.longitude,
                lat: space.latitude,
            }, space.radius);
        });

        if (pressedSpaces.length) {
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
    handleRefreshMoments = (overrideThrottle = false, coords?: any, shouldSearchAll = false) => {
        const { isMinLoadTimeComplete, layers } = this.state;

        if (!isMinLoadTimeComplete) {
            this.timeoutIdRefreshMoments = setTimeout(() => {
                this.handleRefreshMoments(overrideThrottle, coords, shouldSearchAll);
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
        if (shouldSearchAll || layers.myMoments) {
            searchMoments({
                query: 'me',
                itemsPerPage: 50,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                ...userCoords,
            });
        }
        if (shouldSearchAll || layers.connectionsMoments) {
            searchMoments({
                query: 'connections',
                itemsPerPage: 500,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                ...userCoords,
            });
        }
        if (shouldSearchAll || layers.mySpaces) {
            searchSpaces({
                query: 'me',
                itemsPerPage: 50,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                ...userCoords,
            });
        }
        if (shouldSearchAll || layers.connectionsSpaces) {
            searchSpaces({
                query: 'connections',
                itemsPerPage: 500,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                ...userCoords,
            });
        }
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
                // TODO: Determine if it would be best to combine these requests. Implement layers filter through filter button
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
                itemsPerPage: 50,
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
                itemsPerPage: 50,
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
        const { navigation } = this.props;
        navigation.navigate('Map', {
            isTourEnabled: false,
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
            this.handleCreateMoment('upload');
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
            }, 1500);
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

    toggleLayers = () => {
        this.setState({
            areLayersVisible: !this.state.areLayersVisible,
            shouldShowCreateActions: false,
        });
    }

    toggleLayer = (layerName) => {
        const { layers } = this.state;
        layers[layerName] = !layers[layerName];

        if (layerName === 'myMoments') {
            layers.mySpaces = !layers.mySpaces;
        }

        if (layerName === 'connectionsMoments') {
            layers.connectionsSpaces = !layers.connectionsSpaces;
        }

        this.setState({
            layers,
        });
    }

    toggleMomentBtns = () => {
        this.setState({
            areButtonsVisible: !this.state.areButtonsVisible,
            areLayersVisible: false,
        });
    }

    render() {
        const {
            activeMoment,
            activeSpace,
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
            isTouring,
            layers,
        } = this.state;
        const { captureClickTarget, location, map, navigation, notifications, user } = this.props;
        const searchPredictionResults = map?.searchPredictions?.results || [];
        const isDropdownVisible = map?.searchPredictions?.isSearchDropdownVisible;
        const hasNotifications = notifications.messages && notifications.messages.some(m => m.isUnread);

        return (
            <>
                <BaseStatusBar />
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
                                clusterColor={this.theme.colors.primary2}
                            >
                                <Circle
                                    center={circleCenter}
                                    radius={DEFAULT_MOMENT_PROXIMITY} /* meters */
                                    strokeWidth={1}
                                    strokeColor={this.theme.colors.primary2}
                                    fillColor={this.theme.colors.map.userCircleFill}
                                    zIndex={0}
                                />
                                {
                                    layers.connectionsMoments &&
                                    map.moments.map((moment) => {
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
                                                <View>
                                                    <MarkerIcon area={moment} areaType="moments" theme={this.theme} />
                                                </View>
                                            </Marker>
                                        );
                                    })
                                }
                                {
                                    layers.myMoments &&
                                    map.myMoments.map((moment) => {
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
                                                <View style={{ transform: [{ translateY: 0 }] }}>
                                                    <MarkerIcon area={moment} areaType="moments" theme={this.theme} />
                                                </View>
                                            </Marker>
                                        );
                                    })
                                }
                                {
                                    layers.connectionsMoments &&
                                    map.moments.map((moment) => {
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
                                                fillColor={moment.id === activeMoment.id ?
                                                    this.theme.colors.map.momentsCircleFillActive :
                                                    this.theme.colors.map.momentsCircleFill}
                                                zIndex={1}
                                            />
                                        );
                                    })
                                }
                                {
                                    layers.myMoments &&
                                    map.myMoments.map((moment) => {
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
                                                fillColor={moment.id === activeMoment.id ?
                                                    this.theme.colors.map.myMomentsCircleFillActive :
                                                    this.theme.colors.map.myMomentsCircleFill}
                                                zIndex={1}
                                            />
                                        );
                                    })
                                }
                                {
                                    layers.connectionsSpaces &&
                                    map.spaces.map((space) => {
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
                                                <View>
                                                    <MarkerIcon area={space} areaType="spaces" theme={this.theme} />
                                                </View>
                                            </Marker>
                                        );
                                    })
                                }
                                {
                                    layers.mySpaces &&
                                    map.mySpaces.map((space) => {
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
                                                <View style={{ transform: [{ translateY: 0 }] }}>
                                                    <MarkerIcon area={space} areaType="spaces" theme={this.theme} />
                                                </View>
                                            </Marker>
                                        );
                                    })
                                }
                                {
                                    layers.connectionsSpaces &&
                                    map.spaces.map((space) => {
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
                                                fillColor={space.id === activeSpace.id ?
                                                    this.theme.colors.map.spacesCircleFillActive :
                                                    this.theme.colors.map.spacesCircleFill}
                                                zIndex={1}
                                            />
                                        );
                                    })
                                }
                                {
                                    layers.mySpaces &&
                                    map.mySpaces.map((space) => {
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
                                                fillColor={space.id === activeSpace.id ?
                                                    this.theme.colors.map.mySpacesCircleFillActive :
                                                    this.theme.colors.map.mySpacesCircleFill}
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
                                goToMoments={this.goToMoments}
                                goToNotifications={this.goToNotifications}
                                hasNotifications={hasNotifications}
                                handleCreateMoment={this.handleCreateMoment}
                                handleGpsRecenter={this.handleGpsRecenterPress}
                                toggleMomentActions={this.toggleMomentActions}
                                shouldShowCreateActions={shouldShowCreateActions}
                                isAuthorized={this.isAuthorized}
                                isGpsEnabled={location?.settings?.isGpsEnabled}
                                translate={this.translate}
                                themeButtons={this.themeButtons}
                            />
                        }
                        <FiltersButtonGroup
                            areLayersVisible={areLayersVisible}
                            layers={layers}
                            toggleLayer={this.toggleLayer}
                            toggleLayers={this.toggleLayers}
                            goToMoments={this.goToMoments}
                            translate={this.translate}
                            themeButtons={this.themeButtons}
                        />
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
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Map);
