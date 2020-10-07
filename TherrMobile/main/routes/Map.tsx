import React from 'react';
import { PermissionsAndroid, StatusBar } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
import Geolocation from '@react-native-community/geolocation';
import UsersActions from '../redux/actions/UsersActions';

interface IMapDispatchProps {
    login: Function;
    logout: Function;
}

interface IStoreProps extends IMapDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IMapProps extends IStoreProps {
    navigation: any;
}

interface IMapState {
    longitude: number;
    latitude: number;
}

const mapStateToProps = (state: any) => ({
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
            longitude: -96.4683143,
            latitude: 32.8102631,
        };
    }

    componentDidMount = async () => {
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
            .then((granted) => {
                if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                    Geolocation.getCurrentPosition((position) => {
                        console.log(position);
                        if (position && position.coords) {
                            this.setState({
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                            });
                        }
                    });
                } else {
                    console.log('Location permission denied');
                }
            })
            .catch((error) => {
                console.log('error', error);
            });
    };

    goToHome = () => {
        const { navigation } = this.props;

        navigation.navigate('Home');
    };

    onRegionChange = (region) => {
        console.log('change', region);
    };

    render() {
        const { longitude, latitude } = this.state;
        console.log(longitude, latitude);

        return (
            <>
                <StatusBar barStyle="dark-content" />
                <MapView
                    provider={PROVIDER_GOOGLE}
                    style={{ flex: 1 }}
                    region={{
                        latitude,
                        longitude,
                        latitudeDelta: 0.0922,
                        longitudeDelta: 0.0421,
                    }}
                    showsUserLocation={true}
                    onRegionChange={this.onRegionChange}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Map);
