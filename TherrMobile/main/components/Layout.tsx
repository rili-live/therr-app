import React from 'react';
import axios from 'axios';
import {
    DeviceEventEmitter,
    PermissionsAndroid,
    Platform,
    View,
} from 'react-native';
import LocationServicesDialogBox  from 'react-native-android-location-services-dialog-box';
import { checkMultiple, PERMISSIONS } from 'react-native-permissions';
import messaging from '@react-native-firebase/messaging';
import { UsersService } from 'therr-react/services';
import { IForumsState, INotificationsState, IUserState } from 'therr-react/types';
import { ContentActions, ForumActions, NotificationActions } from 'therr-react/redux/actions';
import { AccessLevels } from 'therr-js-utilities/constants';
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
    addNotification: Function;
    insertActiveMoments: Function;
    searchCategories: Function;
    searchNotifications: Function;
    updateGpsStatus: Function;
    updateLocationPermissions: Function;
    updateUser: Function;
}

interface IStoreProps extends ILayoutDispatchProps {
    forums: IForumsState;
    location: ILocationState;
    navigation: any;
    notifications: INotificationsState;
    user: IUserState;
}

// Regular component props
export interface ILayoutProps extends IStoreProps {}

interface ILayoutState {
    isAuthenticated: boolean;
}

const mapStateToProps = (state: any) => ({
    forums: state.forums,
    location: state.location,
    notifications: state.notifications,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            logout: UsersActions.logout,
            addNotification: NotificationActions.add,
            searchNotifications: NotificationActions.search,
            insertActiveMoments: ContentActions.insertActiveMoments,
            searchCategories: ForumActions.searchCategories,
            updateGpsStatus: LocationActions.updateGpsStatus,
            updateLocationPermissions: LocationActions.updateLocationPermissions,
            updateUser: UsersActions.update,
        },
        dispatch
    );

class Layout extends React.Component<ILayoutProps, ILayoutState> {
    private translate;

    private unsubscribePushNotifications;

    constructor(props) {
        super(props);

        this.state = {
            isAuthenticated: false,
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);

        DeviceEventEmitter.addListener('locationProviderStatusChange', function(status) { // only trigger when "providerListener" is enabled
            props.updateGpsStatus(status);
        });
    }

    componentDidUpdate() {
        const {
            forums,
            addNotification,
            insertActiveMoments,
            searchCategories,
            searchNotifications,
            updateLocationPermissions,
            user,
            updateUser,
        } = this.props;

        if (user?.isAuthenticated !== this.state.isAuthenticated) {
            if (user.isAuthenticated) { // Happens after login
                searchNotifications({
                    filterBy: 'userId',
                    query: user.details.id,
                    itemsPerPage: 20,
                    pageNumber: 1,
                    order: 'desc',
                });

                if (!forums?.forumCategories || !forums.forumCategories.length) {
                    searchCategories({
                        itemsPerPage: 100,
                        pageNumber: 1,
                        order: 'desc',
                    }, {});
                }

                if (Platform.OS !== 'ios') {
                    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION)
                        .then((grantStatus) => {
                            updateLocationPermissions({
                                [PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION]: grantStatus,
                            });
                        });
                    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
                        .then((grantStatus) => {
                            updateLocationPermissions({
                                [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: grantStatus,
                            });
                        });
                    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA)
                        .then((grantStatus) => {
                            updateLocationPermissions({
                                [PermissionsAndroid.PERMISSIONS.CAMERA]: grantStatus,
                            });
                        });
                } else {
                    checkMultiple([PERMISSIONS.IOS.LOCATION_ALWAYS]).then((statuses) => {
                        updateLocationPermissions(statuses);
                    });
                }

                this.getIosNotificationPermissions()
                    .then(() => {
                        return messaging().registerDeviceForRemoteMessages();
                    })
                    .then(() => {
                        // Get the token
                        return messaging().getToken();
                    })
                    .then((token) => {
                        axios.defaults.headers['x-user-device-token'] = token;
                        if (user.details.deviceMobileFirebaseToken !== token) {
                            updateUser(user.details.id, { deviceMobileFirebaseToken: token });
                        }
                        this.unsubscribePushNotifications = messaging().onMessage(async remoteMessage => {
                            console.log('Message handled in the foreground!', remoteMessage);
                            let parsedMomentsData;
                            let parsedNotificationData;
                            if (remoteMessage?.data?.momentsActivated) {
                                parsedMomentsData = JSON.parse(remoteMessage.data.momentsActivated);
                                // TODO: Fetch associated media files
                                insertActiveMoments(parsedMomentsData);
                            }
                            if (remoteMessage?.data?.notificationData) {
                                parsedNotificationData = JSON.parse(remoteMessage.data.notificationData);
                                addNotification(parsedNotificationData);
                            }
                        });
                    })
                    .catch((err) => {
                        console.log('NOTIFICATIONS_ERROR', err);
                    });
            }
            this.setState({
                isAuthenticated: user.isAuthenticated,
            });
        }
    }

    componentWillUnmount() {
        if (Platform.OS !== 'ios') {
            LocationServicesDialogBox.stopListener();
        }

        this.unsubscribePushNotifications && this.unsubscribePushNotifications();
    }

    getCurrentScreen = (navigation) => {
        const navState = navigation.dangerouslyGetState();

        return (
            navState.routes[navState.routes.length - 1] &&
            navState.routes[navState.routes.length - 1].name
        );
    };

    getIosNotificationPermissions = () => {
        return messaging().requestPermission()
            .then((authStatus) => {
                const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED
                    || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
                if (enabled) {
                    console.log('Notifications authorization status:', authStatus);
                }
            });
    }

    shouldShowTopRightMenu = () => {
        return UsersService.isAuthorized(
            {
                type: AccessCheckType.ALL,
                levels: [],
            },
            this.props.user
        );
    };

    isUserEmailVerified = () => {
        return UsersService.isAuthorized(
            {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            this.props.user
        );
    };

    logout = (userDetails) => {
        const { logout } = this.props;
        this.unsubscribePushNotifications && this.unsubscribePushNotifications();
        return logout(userDetails);
    }

    render() {
        const { location, notifications, updateGpsStatus, user } = this.props;

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
                                    isEmailVerifed={this.isUserEmailVerified()}
                                />
                            ),
                            headerRight: this.shouldShowTopRightMenu() ? () => (
                                <HeaderMenuRight
                                    navigation={navigation}
                                    notifications={notifications}
                                    styleName={headerStyleName}
                                    isEmailVerifed={this.isUserEmailVerified()}
                                    isVisible={this.shouldShowTopRightMenu()}
                                    location={location}
                                    logout={this.logout}
                                    updateGpsStatus={updateGpsStatus}
                                    user={user}
                                />
                            ) : () => (<View />),
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
