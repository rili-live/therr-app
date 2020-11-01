import React from 'react';
import { PermissionsAndroid, StatusBar } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
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
    MIN_ZOOM_LEVEL,
} from '../constants';
import * as therrTheme from '../styles/themes/ocean';
import { loaderStyles } from '../styles';
import mapStyles from '../styles/map';

const earthLoader = require('../assets/earth-loader.json');

interface IMapDispatchProps {
    login: Function;
    logout: Function;
    updateLocationPermissions: Function;
}

interface IStoreProps extends IMapDispatchProps {
    location: ILocationState;
    user: IUserState;
}

// Regular component props
export interface IMapProps extends IStoreProps {
    navigation: any;
}

interface IMapState {
    isLocationReady: boolean;
    isMinLoadTimeComplete: boolean;
    longitude: number;
    latitude: number;
    circleCenter: any;
}

const mapStateToProps = (state: any) => ({
    location: state.location,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            login: UsersActions.login,
            logout: UsersActions.logout,
            updateLocationPermissions:
                LocationActions.updateLocationPermissions,
        },
        dispatch
    );

class Map extends React.Component<IMapProps, IMapState> {
    private mapWatchId;
    private timeoutId;
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            isLocationReady: false,
            isMinLoadTimeComplete: false,
            longitude: -96.4683143,
            latitude: 32.8102631,
            circleCenter: {
                longitude: -96.4683143,
                latitude: 32.8102631,
            },
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount = async () => {
        const { location, navigation, updateLocationPermissions } = this.props;

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
                                        if (position && position.coords) {
                                            this.setState({
                                                isLocationReady: true,
                                                latitude:
                                                    position.coords.latitude,
                                                longitude:
                                                    position.coords.longitude,
                                                circleCenter: {
                                                    latitude:
                                                        position.coords
                                                            .latitude,
                                                    longitude:
                                                        position.coords
                                                            .longitude,
                                                },
                                            });
                                        }
                                        return resolve();
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

    onUserLocationChange = (event) => {
        this.setState({
            circleCenter: {
                latitude: event.nativeEvent.coordinate.latitude,
                longitude: event.nativeEvent.coordinate.longitude,
            },
        });
    };

    render() {
        const {
            circleCenter,
            isLocationReady,
            isMinLoadTimeComplete,
            longitude,
            latitude,
        } = this.state;

        return (
            <>
                <StatusBar barStyle="dark-content" />
                {!(isLocationReady && isMinLoadTimeComplete) ? (
                    <AnimatedLoader
                        visible={true}
                        overlayColor="rgba(255,255,255,0.75)"
                        source={earthLoader}
                        animationStyle={loaderStyles.lottie}
                        speed={1.25}
                    />
                ) : (
                    <MapView
                        provider={PROVIDER_GOOGLE}
                        style={mapStyles.mapView}
                        initialRegion={{
                            latitude,
                            longitude,
                            latitudeDelta: INITIAL_LATIUDE_DELTA,
                            longitudeDelta: INITIAL_LONGITUDE_DELTA,
                        }}
                        showsUserLocation={true}
                        showsCompass={true}
                        showsBuildings={true}
                        showsMyLocationButton={true}
                        // followsUserLocation={true}
                        onUserLocationChange={this.onUserLocationChange}
                        minZoomLevel={MIN_ZOOM_LEVEL}
                    >
                        <Circle
                            center={circleCenter}
                            radius={20}
                            strokeWidth={3}
                            strokeColor={therrTheme.colors.secondary}
                            fillColor="rgba(56,130,84,0.15)"
                        />
                    </MapView>
                )}
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Map);
