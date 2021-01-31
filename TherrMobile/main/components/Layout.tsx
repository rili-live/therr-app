import React from 'react';
import { DeviceEventEmitter, PermissionsAndroid, Platform } from 'react-native';
import LocationServicesDialogBox  from 'react-native-android-location-services-dialog-box';
import { checkMultiple, PERMISSIONS } from 'react-native-permissions';
import { UsersService } from 'therr-react/services';
import { IUserState } from 'therr-react/types';
import { NotificationActions } from 'therr-react/redux/actions';
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
import styles from '../styles';
import * as therrTheme from '../styles/themes';

const Stack = createStackNavigator();

const forFade = ({ current }) => ({
    cardStyle: {
        opacity: current.progress,
    },
});

interface ILayoutDispatchProps {
    logout: Function;
    searchNotifications: Function;
    updateGpsStatus: Function;
    updateLocationPermissions: Function;
}

interface IStoreProps extends ILayoutDispatchProps {
    location: ILocationState;
    user: IUserState;
}

// Regular component props
export interface ILayoutProps extends IStoreProps {}

interface ILayoutState {
    userId: number | null;
}

const mapStateToProps = (state: any) => ({
    location: state.location,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            logout: UsersActions.logout,
            searchNotifications: NotificationActions.search,
            updateGpsStatus: LocationActions.updateGpsStatus,
            updateLocationPermissions: LocationActions.updateLocationPermissions,
        },
        dispatch
    );

class Layout extends React.Component<ILayoutProps, ILayoutState> {
    static getDerivedStateFromProps(nextProps: ILayoutProps, nextState: ILayoutState) {
        if (nextProps.user.details && nextProps.user.isAuthenticated && nextProps.user.details.id !== nextState.userId) {
            nextProps.searchNotifications({
                filterBy: 'userId',
                query: nextProps.user.details.id,
                itemsPerPage: 20,
                pageNumber: 1,
                order: 'desc',
            });

            if (Platform.OS !== 'ios') {
                PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION)
                    .then((grantStatus) => {
                        nextProps.updateLocationPermissions({
                            [PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION]: grantStatus,
                        });
                    });
                PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
                    .then((grantStatus) => {
                        nextProps.updateLocationPermissions({
                            [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: grantStatus,
                        });
                    });
            } else {
                checkMultiple([PERMISSIONS.IOS.LOCATION_ALWAYS]).then((statuses) => {
                    nextProps.updateLocationPermissions(statuses);
                });
            }

            return {
                userId: nextProps.user.details.id,
            };
        }
        return {};
    }

    private translate;

    constructor(props) {
        super(props);

        this.state = {
            userId: null,
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);

        DeviceEventEmitter.addListener('locationProviderStatusChange', function(status) { // only trigger when "providerListener" is enabled
            props.updateGpsStatus(status);
        });
    }

    componentWillUnmount() {
        if (Platform.OS !== 'ios') {
            LocationServicesDialogBox.stopListener();
        }
    }

    getCurrentScreen = (navigation) => {
        const navState = navigation.dangerouslyGetState();

        return (
            navState.routes[navState.routes.length - 1] &&
            navState.routes[navState.routes.length - 1].name
        );
    };

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
        const { location, logout, updateGpsStatus, user } = this.props;

        return (
            <NavigationContainer theme={theme}>
                <Stack.Navigator
                    screenOptions={({ navigation }) => {
                        const isMap = this.getCurrentScreen(navigation) === 'Map';
                        const isMoment = this.getCurrentScreen(navigation) === 'ViewMoment'
                            || this.getCurrentScreen(navigation) === 'EditMoment';
                        let headerStyleName: any = 'light';
                        let headerTitleColor = therrTheme.colors.textWhite;
                        if (isMap) {
                            headerStyleName = 'dark';
                            headerTitleColor = therrTheme.colors.secondaryFaded;
                        }
                        if (isMoment) {
                            headerStyleName = 'beemo';
                            headerTitleColor = therrTheme.colors.beemoTextBlack;
                        }

                        return ({
                            animationEnabled: true,
                            cardStyleInterpolator: forFade,
                            headerLeft: () => (
                                <HeaderMenuLeft
                                    styleName={headerStyleName}
                                    navigation={navigation}
                                    isAuthenticated={user.isAuthenticated}
                                />
                            ),
                            headerRight: () => (
                                <HeaderMenuRight
                                    navigation={navigation}
                                    styleName={headerStyleName}
                                    isVisible={this.shouldShowTopRightMenu()}
                                    location={location}
                                    logout={logout}
                                    updateGpsStatus={updateGpsStatus}
                                    user={user}
                                />
                            ),
                            headerTitleStyle: {
                                ...styles.headerTitleStyle,
                                color: headerTitleColor,
                                textShadowOffset: isMap ? { width: 1, height: 1 } : { width: 0, height: 0 },
                                textShadowRadius: isMap ? 1 : 0,
                            },
                            headerStyle: styles.headerStyle,
                            headerTransparent: false,
                        });
                    }}
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
