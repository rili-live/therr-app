import React from 'react';
import { PermissionsAndroid, StatusBar, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import { Button, Overlay } from 'react-native-elements';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IMapState as IMapReduxState, IUserState } from 'therr-react/types';
import { MapActions } from 'therr-react/redux/actions';
import Geolocation from '@react-native-community/geolocation';
import AnimatedLoader from 'react-native-animated-loader';
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
import { loaderStyles } from '../styles';
import mapStyles from '../styles/map';
import EditMoment from '../components/moments/EditMoment';
import { insideCircle } from 'geolocation-utils';

const earthLoader = require('../assets/earth-loader.json');
const mapCustomStyle = require('../styles/map/style.json');

interface IMapDispatchProps {
    login: Function;
    logout: Function;
    updateCoordinates: Function;
    searchMoments: Function;
    updateLocationPermissions: Function;
}

interface IStoreProps extends IMapDispatchProps {
    location: ILocationState;
    map: IMapReduxState;
    user: IUserState;
}

// Regular component props
export interface IMapProps extends IStoreProps {
    navigation: any;
}

interface IMapState {
    activeButtonId?: number;
    areButtonsVisible: boolean;
    isEditMomentVisible: boolean;
    isLocationReady: boolean;
    isMinLoadTimeComplete: boolean;
    lastMomentsRefresh?: number,
    circleCenter: any;
}

const mapStateToProps = (state: any) => ({
    location: state.location,
    map: state.map,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            login: UsersActions.login,
            logout: UsersActions.logout,
            updateCoordinates: MapActions.updateCoordinates,
            searchMoments: MapActions.searchMoments,
            updateLocationPermissions:
                LocationActions.updateLocationPermissions,
        },
        dispatch
    );

class Map extends React.Component<IMapProps, IMapState> {
    private mapRef;
    private mapWatchId;
    private timeoutId;
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            areButtonsVisible: true,
            isEditMomentVisible: false,
            isLocationReady: false,
            isMinLoadTimeComplete: false,
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

        if (location.settings.isGpsEnabled) {
            let grantStatus;

            // TODO: Store permissions response in Mobile only redux
            PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                {
                    title: 'Therr Mobile',
                    message:
                        'Therr App needs access to your location ' +
                        'so you can share moments with connections',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'OK',
                }
            )
                .then(
                    (response) =>
                        new Promise((resolve, reject) => {
                            grantStatus = response;
                            updateLocationPermissions({
                                accessFileLocation: grantStatus,
                            });
                            if (
                                grantStatus ===
                                PermissionsAndroid.RESULTS.GRANTED
                            ) {
                                this.mapWatchId = Geolocation.watchPosition(
                                    (position) => {
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
                                    },
                                    (error) => {
                                        console.log('geolocation error');
                                        return reject(error);
                                    },
                                    {
                                        enableHighAccuracy: true,
                                    }
                                );
                            } else {
                                console.log('Location permission denied');
                                return reject('permissionDenied');
                            }
                        })
                )
                .then((coords: any) => {
                    this.handleRefreshMoments(true, coords);
                    Geolocation.clearWatch(this.mapWatchId);
                })
                .catch((error) => {
                    if (error === 'permissionDenied') {
                        updateLocationPermissions({
                            accessFileLocation: grantStatus,
                        });
                    }
                    this.goToHome();
                });
        } else {
            this.goToHome();
        }
    };

    componentWillUnmount() {
        Geolocation.clearWatch(this.mapWatchId);
        clearTimeout(this.timeoutId);
    }

    goToHome = () => {
        const { navigation } = this.props;

        navigation.navigate('Home');
    };

    cancelEditMoment = () => {
        this.setState({
            isEditMomentVisible: false,
        });
    }

    handleAddMoment = () => {
        this.setState({
            isEditMomentVisible: true,
        });
    };

    handleCompassRealign = () => {
        this.mapRef.animateCamera({ heading: 0 });
    };

    handleGpsRecenter = () => {
        const { circleCenter } = this.state;
        const loc = {
            latitude: circleCenter.latitude,
            longitude: circleCenter.longitude,
            latitudeDelta: INITIAL_LATIUDE_DELTA,
            longitudeDelta: INITIAL_LONGITUDE_DELTA,
        };
        this.mapRef.animateToRegion(loc, 750);
    };

    handleMapPress = ({ nativeEvent }) => {
        const { map } = this.props;
        const pressedMoments = map.moments.filter((moment) => {
            return insideCircle(nativeEvent.coordinate, {
                lon: moment.longitude,
                lat: moment.latitude,
            }, moment.radius);
        });

        if (pressedMoments.length) {
            console.log(pressedMoments[0]);
            this.setState({
                activeButtonId: pressedMoments[0].id,
            });
        } else {
            this.setState({
                activeButtonId: undefined,
            });
        }
    };

    handleLayersPress = () => {}

    handleRefreshMoments = (overrideThrottle = false, coords?: any) => {
        if (!overrideThrottle && this.state.lastMomentsRefresh &&
            (Date.now() - this.state.lastMomentsRefresh <= MOMENTS_REFRESH_THROTTLE_MS)) {
            return;
        }
        const { map, searchMoments } = this.props;
        const userCoords = coords || {
            longitude: map.longitude,
            latitude: map.latitude,
        };
        searchMoments({
            query: '1000',
            itemsPerPage: 20,
            pageNumber: 1,
            order: 'desc',
            filterBy: 'distance',
            ...userCoords,
        });
        this.setState({
            lastMomentsRefresh: Date.now(),
        });
    };

    onUserLocationChange = (event) => {
        const coords = {
            latitude: event.nativeEvent.coordinate.latitude,
            longitude: event.nativeEvent.coordinate.longitude,
        };
        // TODO: Add throttle
        this.props.updateCoordinates(coords);
        this.setState({
            circleCenter: coords,
        });
    };

    toggleMomentBtns = () => {
        this.setState({
            areButtonsVisible: !this.state.areButtonsVisible,
        });
    }

    render() {
        const {
            activeButtonId,
            areButtonsVisible,
            circleCenter,
            isLocationReady,
            isMinLoadTimeComplete,
            isEditMomentVisible,
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
                            ref={(ref) => (this.mapRef = ref)}
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
                            // followsUserLocation={true}
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
                                            strokeColor={therrTheme.colors.secondary}
                                            fillColor={moment.id === activeButtonId ?
                                                therrTheme.colors.map.momentsCircleFillActive :
                                                therrTheme.colors.map.momentsCircleFill}
                                            zIndex={1}
                                        />
                                    );
                                })
                            }
                        </MapView>
                        <View style={mapStyles.collapse}>
                            <Button
                                buttonStyle={mapStyles.momentBtn}
                                icon={
                                    <FontAwesomeIcon
                                        name="ellipsis-h"
                                        size={20}
                                        style={mapStyles.momentBtnIcon}
                                    />
                                }
                                raised={true}
                                onPress={() => this.toggleMomentBtns()}
                            />
                        </View>
                        {
                            areButtonsVisible && (
                                <>
                                    <View style={mapStyles.momentLayers}>
                                        <Button
                                            buttonStyle={mapStyles.momentBtn}
                                            icon={
                                                <MaterialIcon
                                                    name="layers"
                                                    size={44}
                                                    style={mapStyles.momentBtnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={() => this.handleLayersPress()}
                                        />
                                    </View>
                                    <View style={mapStyles.refreshMoments}>
                                        <Button
                                            buttonStyle={mapStyles.momentBtn}
                                            icon={
                                                <FontAwesomeIcon
                                                    name="sync"
                                                    size={44}
                                                    style={mapStyles.momentBtnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={() => this.handleRefreshMoments(false)}
                                        />
                                    </View>
                                    <View style={mapStyles.addMoment}>
                                        <Button
                                            buttonStyle={mapStyles.momentBtn}
                                            icon={
                                                <FontAwesomeIcon
                                                    name="marker"
                                                    size={44}
                                                    style={mapStyles.momentBtnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={this.handleAddMoment}
                                        />
                                    </View>
                                    <View style={mapStyles.compass}>
                                        <Button
                                            buttonStyle={mapStyles.momentBtn}
                                            icon={
                                                <FontAwesomeIcon
                                                    name="compass"
                                                    size={28}
                                                    style={mapStyles.momentBtnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={this.handleCompassRealign}
                                        />
                                    </View>
                                    <View style={mapStyles.recenter}>
                                        <Button
                                            buttonStyle={mapStyles.momentBtn}
                                            icon={
                                                <MaterialIcon
                                                    name="gps-fixed"
                                                    size={28}
                                                    style={mapStyles.momentBtnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={this.handleGpsRecenter}
                                        />
                                    </View>
                                </>
                            )
                        }
                        <Overlay
                            isVisible={isEditMomentVisible}
                            onBackdropPress={() => {}}
                            overlayStyle={mapStyles.editMomentOverlay}
                        >
                            <EditMoment
                                closeOverlay={this.cancelEditMoment}
                                latitude={circleCenter.latitude}
                                longitude={circleCenter.longitude}
                                translate={this.translate}
                            />
                        </Overlay>
                    </>
                )}
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Map);
