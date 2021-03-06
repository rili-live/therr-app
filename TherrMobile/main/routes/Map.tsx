import React, { Ref } from 'react';
import { PermissionsAndroid, Platform, StatusBar, View } from 'react-native';
import { StackActions } from '@react-navigation/native';
import { requestMultiple, PERMISSIONS } from 'react-native-permissions';
import MapView from 'react-native-map-clustering';
import { PROVIDER_GOOGLE, Circle, Marker } from 'react-native-maps';
import { Button } from 'react-native-elements';
import AnimatedOverlay from 'react-native-modal-overlay';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IMapState as IMapReduxState, IReactionsState, IUserState } from 'therr-react/types';
import { MapActions, ReactionActions } from 'therr-react/redux/actions';
import Geolocation from '@react-native-community/geolocation';
import AnimatedLoader from 'react-native-animated-loader';
import Alert from '../components/Alert';
import UsersActions from '../redux/actions/UsersActions';
import { ILocationState } from '../types/redux/location';
import LocationActions from '../redux/actions/LocationActions';
import translator from '../services/translator';
import {
    INITIAL_LATIUDE_DELTA,
    INITIAL_LONGITUDE_DELTA,
    MIN_LOAD_TIMEOUT,
    DEFAULT_MOMENT_PROXIMITY,
    MIN_ZOOM_LEVEL,
    MOMENTS_REFRESH_THROTTLE_MS,
} from '../constants';
import * as therrTheme from '../styles/themes';
import styles, { loaderStyles } from '../styles';
import buttonStyles from '../styles/buttons';
import mapStyles from '../styles/map';
import { distanceTo, insideCircle } from 'geolocation-utils';
import requestLocationServiceActivation from '../utilities/requestLocationServiceActivation';

const earthLoader = require('../assets/earth-loader.json');
const mapCustomStyle = require('../styles/map/style.json');

const ANIMATE_TO_REGION_DURATION = 750;
const ANIMATE_TO_REGION_DURATION_FAST = 500;

interface IMapDispatchProps {
    createOrUpdateReaction: Function;
    login: Function;
    logout: Function;
    updateCoordinates: Function;
    searchMoments: Function;
    deleteMoment: Function;
    updateGpsStatus: Function;
    updateLocationPermissions: Function;
}

interface IStoreProps extends IMapDispatchProps {
    location: ILocationState;
    map: IMapReduxState;
    reactions: IReactionsState;
    user: IUserState;
}

// Regular component props
export interface IMapProps extends IStoreProps {
    navigation: any;
}

interface IMapState {
    activeMoment: any;
    activeMomentDetails: any;
    areButtonsVisible: boolean;
    areLayersVisible: boolean;
    followsUserLocation: boolean;
    isMomentAlertVisible: boolean;
    isScrollEnabled: boolean;
    isLocationReady: boolean;
    isMinLoadTimeComplete: boolean;
    lastMomentsRefresh?: number,
    layers: any
    circleCenter: any;
}

const mapStateToProps = (state: any) => ({
    location: state.location,
    map: state.map,
    reactions: state.reactions,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            login: UsersActions.login,
            logout: UsersActions.logout,
            updateCoordinates: MapActions.updateCoordinates,
            searchMoments: MapActions.searchMoments,
            deleteMoment: MapActions.deleteMoment,
            createOrUpdateReaction: ReactionActions.createOrUpdateMomentReactions,
            updateGpsStatus: LocationActions.updateGpsStatus,
            updateLocationPermissions: LocationActions.updateLocationPermissions,
        },
        dispatch
    );

class Map extends React.Component<IMapProps, IMapState> {
    private localeShort = 'en-US'; // TODO: Derive from user locale
    private mapRef: any;
    private mapWatchId;
    private timeoutId;
    private timeoutIdRefreshMoments;
    private timeoutIdShowMoment;
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            activeMoment: {},
            activeMomentDetails: {},
            areButtonsVisible: true,
            areLayersVisible: false,
            followsUserLocation: false,
            isScrollEnabled: true,
            isMomentAlertVisible: false,
            isLocationReady: false,
            isMinLoadTimeComplete: false,
            layers: {
                myMoments: false,
                connectionsMoments: true,
            },
            circleCenter: {
                longitude: -96.4683143,
                latitude: 32.8102631,
            },
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount = async () => {
        const {
            location,
            navigation,
            updateCoordinates,
            updateGpsStatus,
            updateLocationPermissions,
        } = this.props;

        navigation.setOptions({
            title: this.translate('pages.map.headerTitle'),
        });

        this.timeoutId = setTimeout(() => {
            this.setState({
                isMinLoadTimeComplete: true,
            });
        }, MIN_LOAD_TIMEOUT);

        let perms;

        requestLocationServiceActivation({
            isGpsEnabled: location?.settings?.isGpsEnabled,
            translate: this.translate,
        }).then((response: any) => {
            if (response?.status) {
                return updateGpsStatus(response.status);
            }

            return Promise.resolve();
        }).then(() => {
            this.requestOSPermissions().then((permissions) => {
                return new Promise((resolve, reject) => {
                    perms = permissions;
                    // If permissions are granted
                    if (permissions[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]
                        || permissions[PERMISSIONS.IOS.LOCATION_WHEN_IN_USE]) {
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
                                isLocationReady: true,
                                circleCenter: coords,
                            });
                            updateCoordinates(coords);
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
                        Geolocation.getCurrentPosition(
                            positionSuccessCallback,
                            (error) => positionErrorCallback(error, 'get'),
                            positionOptions,
                        );

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
            })
                .then((coords: any) => {
                    Geolocation.clearWatch(this.mapWatchId);
                    Geolocation.stopObserving();
                    this.handleRefreshMoments(true, coords, true);
                })
                .catch((error) => {
                    console.log(error);
                    // TODO: Display message encouraging user to turn on location permissions in settings
                    if (error === 'permissionDenied') {
                        updateLocationPermissions(perms);
                    }
                    this.goToHome();
                });
        }).catch((error) => {
            // TODO: Allow viewing map when gps is disable
            // but disallow GPS required actions like viewing/deleting moments
            console.log(error);
            this.goToHome();
        });
    };

    componentWillUnmount() {
        Geolocation.clearWatch(this.mapWatchId);
        clearTimeout(this.timeoutId);
        clearTimeout(this.timeoutIdRefreshMoments);
        clearTimeout(this.timeoutIdShowMoment);
    }

    requestOSPermissions = () => {
        switch (Platform.OS) {
            case 'ios':
                return this.requestIOSPermissions();
            case 'android':
                return this.requestAndroidPermission();
            default:
                return Promise.reject();
        }
    }

    requestAndroidPermission = () => {
        const {
            updateLocationPermissions,
        } = this.props;

        let permissions;

        return PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]).then((grantedPermissions) => {
            permissions = grantedPermissions;
            updateLocationPermissions(permissions);
            return permissions;
        });
    }

    requestIOSPermissions = () => {
        const {
            updateLocationPermissions,
        } = this.props;

        let permissions;

        return requestMultiple([
            PERMISSIONS.IOS.LOCATION_ALWAYS,
            PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
        ]).then((grantedPermissions) => {
            permissions = grantedPermissions;
            updateLocationPermissions(permissions);
            return permissions;
        });
    }

    goToHome = () => {
        const { navigation } = this.props;

        // navigation.navigate('Home');
        navigation.dispatch(
            StackActions.replace('Home', {})
        );
    };

    cancelMomentAlert = () => {
        this.setState({
            isMomentAlertVisible: false,
        });
    }

    getMomentDetails = (moment) => new Promise((resolve) => {
        const { user } = this.props;
        const details: any = {};

        if (moment.fromUserId === user.details.id) {
            details.userDetails = user.details;
        }

        return resolve(details);
    });

    handleCreateMoment = () => {
        const { location, navigation } = this.props;
        const { circleCenter } = this.state;

        if (location?.settings?.isGpsEnabled) {
            navigation.navigate('EditMoment', circleCenter);
        } else {
            // TODO: Alert that GPS is required to create a moment
        }
    };

    handleCompassRealign = () => {
        this.mapRef && this.mapRef.animateCamera({ heading: 0 });
        this.setState({
            areLayersVisible: false,
        });
    };

    handleGpsRecenter = () => {
        const { circleCenter } = this.state;
        const loc = {
            latitude: circleCenter.latitude,
            longitude: circleCenter.longitude,
            latitudeDelta: INITIAL_LATIUDE_DELTA,
            longitudeDelta: INITIAL_LONGITUDE_DELTA,
        };
        this.mapRef && this.mapRef.animateToRegion(loc, ANIMATE_TO_REGION_DURATION);
        this.setState({
            areLayersVisible: false,
        });
    };

    handleMapPress = ({ nativeEvent }) => {
        const { createOrUpdateReaction, location, map, navigation, user } = this.props;
        const { circleCenter, layers } = this.state;
        let visibleMoments: any[] = [];

        this.setState({
            areLayersVisible: false,
        });

        if (layers.connectionsMoments) {
            visibleMoments = visibleMoments.concat(map.moments);
        }
        if (layers.myMoments) {
            visibleMoments = visibleMoments.concat(map.myMoments);
        }
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
            if (!isProximitySatisfied && selectedMoment.fromUserId !== user.details.id) {
                // Deny activation
                this.showMomentAlert();
            } else {
                // Activate moment
                Promise.all([
                    this.getMomentDetails(selectedMoment),
                    createOrUpdateReaction(selectedMoment.id, {
                        userViewCount: 1,
                        userHasActivated: true,
                    }),
                ])
                    .then(([details]) => {
                        console.log(details);
                        this.setState({
                            activeMoment: selectedMoment,
                            activeMomentDetails: details,
                        }, () => {
                            if (location?.settings?.isGpsEnabled) {
                                navigation.navigate('ViewMoment', {
                                    isMyMoment: selectedMoment.fromUserId === user.details.id,
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
    };

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
        const { map, searchMoments } = this.props;
        const userCoords = coords || {
            longitude: map.longitude,
            latitude: map.latitude,
        };
        console.log('UserCoordds', userCoords);
        // TODO: Consider making this one, dynamic request to add efficiency
        if (shouldSearchAll || layers.myMoments) {
            searchMoments({
                query: 'me',
                itemsPerPage: 20,
                pageNumber: 1,
                order: 'desc',
                filterBy: 'fromUserIds',
                ...userCoords,
            });
        }
        if (shouldSearchAll || layers.connectionsMoments) {
            searchMoments({
                query: 'connections',
                itemsPerPage: 20,
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

    onDeleteMoment = (moment) => {
        const { deleteMoment, user } = this.props;
        if (moment.fromUserId === user.details.id) {
            deleteMoment({ ids: [moment.id] })
                .then(() => {
                    console.log('Moment successfully deleted');
                })
                .catch((err) => {
                    console.log('Error deleting moment', err);
                });
        }
    };

    onUserLocationChange = (event) => {
        const { followsUserLocation } = this.state;
        const coords = {
            latitude: event.nativeEvent.coordinate.latitude,
            longitude: event.nativeEvent.coordinate.longitude,
        };
        // TODO: Add throttle
        this.props.updateCoordinates(coords);
        this.setState({
            circleCenter: coords,
        });

        if (followsUserLocation) {
            const loc = {
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: INITIAL_LATIUDE_DELTA,
                longitudeDelta: INITIAL_LONGITUDE_DELTA,
            };
            this.mapRef && this.mapRef.animateToRegion(loc, ANIMATE_TO_REGION_DURATION_FAST);
        }
    };

    showMomentAlert = () => {
        this.setState({
            isMomentAlertVisible: true,
        });

        this.timeoutIdShowMoment = setTimeout(() => {
            this.setState({
                isMomentAlertVisible: false,
            });
        }, 2000);
    };

    toggleMapFollow = () => {
        const {
            followsUserLocation,
            isScrollEnabled,
        } = this.state;
        const { map } = this.props;

        if (followsUserLocation === false) {
            this.mapRef && this.mapRef.animateToRegion({
                longitude: map.longitude,
                latitude: map.latitude,
                latitudeDelta: INITIAL_LATIUDE_DELTA,
                longitudeDelta: INITIAL_LONGITUDE_DELTA,
            }, ANIMATE_TO_REGION_DURATION);
        }

        this.setState({
            followsUserLocation: !followsUserLocation,
            isScrollEnabled: !isScrollEnabled,
        });
    }

    toggleLayers = () => {
        this.setState({
            areLayersVisible: !this.state.areLayersVisible,
        });
    }

    toggleLayer = (layerName) => {
        const { layers } = this.state;
        layers[layerName] = !layers[layerName];

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
            areButtonsVisible,
            areLayersVisible,
            circleCenter,
            followsUserLocation,
            isLocationReady,
            isMinLoadTimeComplete,
            isMomentAlertVisible,
            isScrollEnabled,
            layers,
        } = this.state;
        const { map } = this.props;

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} />
                {!(isLocationReady && isMinLoadTimeComplete) ? (
                    <AnimatedLoader
                        visible={true}
                        overlayColor="rgba(255,255,255,0.75)"
                        source={earthLoader}
                        animationStyle={loaderStyles.lottie}
                        speed={1.25}
                    />
                ) : (
                    <>
                        <MapView
                            mapRef={(ref: Ref<MapView>) => { this.mapRef = ref; }}
                            provider={PROVIDER_GOOGLE}
                            style={mapStyles.mapView}
                            customMapStyle={mapCustomStyle}
                            initialRegion={{
                                latitude: circleCenter.latitude,
                                longitude: circleCenter.longitude,
                                latitudeDelta: INITIAL_LATIUDE_DELTA,
                                longitudeDelta: INITIAL_LONGITUDE_DELTA,
                            }}
                            onPress={this.handleMapPress}
                            showsUserLocation={true}
                            showsBuildings={true}
                            showsMyLocationButton={false}
                            showsCompass={false}
                            followsUserLocation={followsUserLocation}
                            scrollEnabled={isScrollEnabled}
                            onUserLocationChange={this.onUserLocationChange}
                            minZoomLevel={MIN_ZOOM_LEVEL}
                        >
                            <Circle
                                center={circleCenter}
                                radius={DEFAULT_MOMENT_PROXIMITY} /* meters */
                                strokeWidth={1}
                                strokeColor={therrTheme.colors.primary2}
                                fillColor={therrTheme.colors.map.userCircleFill}
                                zIndex={0}
                            />
                            {
                                layers.connectionsMoments &&
                                map.moments.map((moment) => {
                                    return (
                                        <React.Fragment key={moment.id}>
                                            <Marker
                                                coordinate={{
                                                    longitude: moment.longitude,
                                                    latitude: moment.latitude,
                                                }}
                                                onPress={this.handleMapPress}
                                            />
                                            <Circle
                                                center={{
                                                    longitude: moment.longitude,
                                                    latitude: moment.latitude,
                                                }}
                                                radius={moment.radius} /* meters */
                                                strokeWidth={0}
                                                strokeColor={therrTheme.colors.secondary}
                                                fillColor={moment.id === activeMoment.id ?
                                                    therrTheme.colors.map.momentsCircleFillActive :
                                                    therrTheme.colors.map.momentsCircleFill}
                                                zIndex={1}
                                            />
                                        </React.Fragment>
                                    );
                                })
                            }
                            {
                                layers.myMoments &&
                                map.myMoments.map((moment) => {
                                    return (
                                        <React.Fragment key={moment.id}>
                                            <Marker
                                                coordinate={{
                                                    longitude: moment.longitude,
                                                    latitude: moment.latitude,
                                                }}
                                                onPress={this.handleMapPress}
                                            />
                                            <Circle
                                                center={{
                                                    longitude: moment.longitude,
                                                    latitude: moment.latitude,
                                                }}
                                                radius={moment.radius} /* meters */
                                                strokeWidth={0}
                                                strokeColor={therrTheme.colors.secondary}
                                                fillColor={moment.id === activeMoment.id ?
                                                    therrTheme.colors.map.myMomentsCircleFillActive :
                                                    therrTheme.colors.map.myMomentsCircleFill}
                                                zIndex={1}
                                            />
                                        </React.Fragment>
                                    );
                                })
                            }
                        </MapView>
                        <View style={buttonStyles.collapse}>
                            <Button
                                buttonStyle={buttonStyles.btn}
                                icon={
                                    <FontAwesomeIcon
                                        name="ellipsis-h"
                                        size={20}
                                        style={buttonStyles.btnIcon}
                                    />
                                }
                                raised={true}
                                onPress={() => this.toggleMomentBtns()}
                            />
                        </View>
                        {
                            areButtonsVisible && (
                                <>
                                    <View style={buttonStyles.toggleFollow}>
                                        <Button
                                            buttonStyle={buttonStyles.btn}
                                            icon={
                                                <MaterialIcon
                                                    name={followsUserLocation ? 'near-me' : 'navigation'}
                                                    size={28}
                                                    style={buttonStyles.btnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={() => this.toggleMapFollow()}
                                        />
                                    </View>
                                    <View style={buttonStyles.momentLayers}>
                                        <Button
                                            buttonStyle={buttonStyles.btn}
                                            icon={
                                                <MaterialIcon
                                                    name="layers"
                                                    size={44}
                                                    style={buttonStyles.btnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={() => this.toggleLayers()}
                                        />
                                    </View>
                                    {
                                        areLayersVisible &&
                                        <>
                                            <View style={buttonStyles.momentLayerOption1}>
                                                <Button
                                                    buttonStyle={buttonStyles.btn}
                                                    icon={
                                                        <FontAwesomeIcon
                                                            name="globe"
                                                            size={28}
                                                            style={layers.connectionsMoments ? buttonStyles.btnIcon : buttonStyles.btnIconInactive}
                                                        />
                                                    }
                                                    raised={true}
                                                    onPress={() => this.toggleLayer('connectionsMoments')}
                                                />
                                            </View>
                                            <View style={buttonStyles.momentLayerOption2}>
                                                <Button
                                                    buttonStyle={buttonStyles.btn}
                                                    icon={
                                                        <FontAwesomeIcon
                                                            name="child"
                                                            size={28}
                                                            style={layers.myMoments ? buttonStyles.btnIcon : buttonStyles.btnIconInactive}
                                                        />
                                                    }
                                                    raised={true}
                                                    onPress={() => this.toggleLayer('myMoments')}
                                                />
                                            </View>
                                        </>
                                    }
                                    <View style={buttonStyles.refreshMoments}>
                                        <Button
                                            buttonStyle={buttonStyles.btn}
                                            icon={
                                                <FontAwesomeIcon
                                                    name="sync"
                                                    size={44}
                                                    style={buttonStyles.btnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={() => this.handleRefreshMoments(false)}
                                        />
                                    </View>
                                    <View style={buttonStyles.addMoment}>
                                        <Button
                                            buttonStyle={buttonStyles.btn}
                                            icon={
                                                <FontAwesomeIcon
                                                    name="marker"
                                                    size={44}
                                                    style={buttonStyles.btnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={this.handleCreateMoment}
                                        />
                                    </View>
                                    <View style={buttonStyles.compass}>
                                        <Button
                                            buttonStyle={buttonStyles.btn}
                                            icon={
                                                <FontAwesomeIcon
                                                    name="compass"
                                                    size={28}
                                                    style={buttonStyles.btnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={this.handleCompassRealign}
                                        />
                                    </View>
                                    <View style={buttonStyles.recenter}>
                                        <Button
                                            buttonStyle={buttonStyles.btn}
                                            icon={
                                                <MaterialIcon
                                                    name="gps-fixed"
                                                    size={28}
                                                    style={buttonStyles.btnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={this.handleGpsRecenter}
                                        />
                                    </View>
                                </>
                            )
                        }
                        <AnimatedOverlay
                            animationType="swing"
                            animationDuration={500}
                            easing="linear"
                            visible={isMomentAlertVisible}
                            onClose={this.cancelMomentAlert}
                            closeOnTouchOutside
                            containerStyle={styles.overlay}
                            childrenWrapperStyle={mapStyles.momentAlertOverlayContainer}
                        >
                            <Alert
                                containerStyles={{}}
                                isVisible={isMomentAlertVisible}
                                message={this.translate('pages.map.momentAlerts.walkCloser')}
                                type="error"
                            />
                        </AnimatedOverlay>
                    </>
                )}
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Map);
