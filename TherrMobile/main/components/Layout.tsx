import React from 'react';
// import { DeviceEventEmitter } from 'react-native';
import LocationServicesDialogBox from 'react-native-android-location-services-dialog-box';
import { UsersService } from 'therr-react/services';
import { IUserState } from 'therr-react/types';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import 'react-native-gesture-handler';
import routes from '../routes';
import { theme } from '../styles';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import HeaderMenuRight from './HeaderMenuRight';
import { AccessCheckType } from '../types';
import LocationActions from '../redux/actions/LocationActions';
import UsersActions from '../redux/actions/UsersActions';
import { ILocationState } from '../types/redux/location';
import HeaderMenuLeft from './HeaderMenuLeft';
import translator from '../services/translator';

const Stack = createStackNavigator();

const forFade = ({ current }) => ({
    cardStyle: {
        opacity: current.progress,
    },
});

interface ILayoutDispatchProps {
    logout: Function;
    updateGpsStatus: Function;
}

interface IStoreProps extends ILayoutDispatchProps {
    location: ILocationState;
    user: IUserState;
}

// Regular component props
export interface ILayoutProps extends IStoreProps {}

interface ILayoutState {}

const mapStateToProps = (state: any) => ({
    location: state.location,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            logout: UsersActions.logout,
            updateGpsStatus: LocationActions.updateGpsStatus,
        },
        dispatch
    );

class Layout extends React.Component<ILayoutProps, ILayoutState> {
    constructor(props) {
        super(props);

        this.state = {};

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);

        if (!props.location.settings.isGpsEnabled) {
            LocationServicesDialogBox.checkLocationServicesIsEnabled({
                message:
                    "<h2 style='color: #0af13e'>Use Location?</h2>This app wants to change your device settings:<br/><br/>" +
                    "Use GPS, Wi-Fi, and cell network for location<br/><br/><a href='https://support.google.com/maps/answer/7326816'>Learn more</a>",
                ok: 'YES',
                cancel: 'NO',
                enableHighAccuracy: true, // true => GPS AND NETWORK PROVIDER, false => GPS OR NETWORK PROVIDER
                showDialog: true, // false => Opens the Location access page directly
                openLocationServices: true, // false => Directly catch method is called if location services are turned off
                preventOutSideTouch: false, // true => To prevent the location services window from closing when it is clicked outside
                preventBackClick: false, // true => To prevent the location services popup from closing when it is clicked back button
                providerListener: false, // true ==> Trigger locationProviderStatusChange listener when the location state changes
            })
                .then((success) => {
                    props.updateGpsStatus(success.status);
                })
                .catch((error) => {
                    console.log(error);
                });
        }

        // DeviceEventEmitter.addListener('locationProviderStatusChange', function(status) { // only trigger when "providerListener" is enabled
        //     console.log('locationProviderStatusChange', status); //  status => {enabled: false, status: "disabled"} or {enabled: true, status: "enabled"}
        // });
    }

    componentWillUnmount() {
        // used only when "providerListener" is enabled
        // LocationServicesDialogBox.stopListener(); // Stop the "locationProviderStatusChange" listener
    }

    private translate;


    shouldShowTopRightMenu = () => {
        return UsersService.isAuthorized(
            {
                type: AccessCheckType.ALL,
                levels: [],
            },
            this.props.user
        );
    };

    render() {
        const { logout, user } = this.props;

        return (
            <NavigationContainer theme={theme}>
                <Stack.Navigator
                    screenOptions={({ navigation }) => ({
                        // animationEnabled: false,
                        cardStyleInterpolator: forFade,
                        headerLeft: () => (
                            <HeaderMenuLeft
                                navigation={navigation}
                                isAuthenticated={user.isAuthenticated}
                            />
                        ),
                        headerRight: () => (
                            <HeaderMenuRight
                                navigation={navigation}
                                isVisible={this.shouldShowTopRightMenu()}
                                logout={logout}
                                user={user}
                            />
                        ),
                        headerTitleStyle: {
                            alignSelf: 'center',
                            textAlign: 'center',
                            flex: 1,
                        },
                    })}
                >
                    {routes
                        .filter((route: any) => {
                            if (
                                route.name === 'Login' &&
                                user.isAuthenticated
                            ) {
                                return false;
                            }
                            if (
                                !(
                                    route.options &&
                                    typeof route.options === 'function' &&
                                    route.options().access
                                )
                            ) {
                                return true;
                            }

                            const isAuthorized = UsersService.isAuthorized(
                                route.options().access,
                                user
                            );

                            delete route.options.access;

                            return isAuthorized;
                        })
                        .map((route: any) => {
                            route.name = this.translate(route.name);
                            return <Stack.Screen key={route.name} {...route} />;
                        })}
                </Stack.Navigator>
            </NavigationContainer>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Layout);
