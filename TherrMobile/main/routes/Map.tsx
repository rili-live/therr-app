import React from 'react';
import { PermissionsAndroid, StatusBar, Text } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
import Geolocation from '@react-native-community/geolocation';
import UsersActions from '../redux/actions/UsersActions';
import { ILocationState } from '../types/redux/location';

const INITIAL_LATIUDE_DELTA = 0.00122;
const INITIAL_LONGITUDE_DELTA = 0.00051;
const MIN_ZOOM_LEVEL = 5;

interface IMapDispatchProps {
    login: Function;
    logout: Function;
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
        },
        dispatch
    );

class Map extends React.Component<IMapProps, IMapState> {
    constructor(props) {
        super(props);

        this.state = {
            isLocationReady: false,
            longitude: -96.4683143,
            latitude: 32.8102631,
            circleCenter: {
                longitude: -96.4683143,
                latitude: 32.8102631,
            },
        };
    }

    componentDidMount = async () => {
        const { location } = this.props;

        if (location.settings.isGpsEnabled) {
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
                    (granted) =>
                        new Promise((resolve, reject) => {
                            if (
                                granted === PermissionsAndroid.RESULTS.GRANTED
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
                .catch(() => {
                    this.goToHome();
                });
        } else {
            this.goToHome();
        }
    };

    componentWillUnmount() {
        Geolocation.clearWatch(this.mapWatchId);
    }

    private mapWatchId;

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
            longitude,
            latitude,
        } = this.state;

        return (
            <>
                <StatusBar barStyle="dark-content" />
                {!isLocationReady ? (
                    <Text>Loading...</Text>
                ) : (
                    <MapView
                        provider={PROVIDER_GOOGLE}
                        style={{ flex: 1 }}
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
                            strokeColor="#388254"
                            fillColor="rgba(56,130,84,0.15)"
                        />
                    </MapView>
                )}
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Map);
