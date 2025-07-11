import React from 'react';
import axios from 'axios';
import qs from 'qs';
import {
    DeviceEventEmitter,
    Image,
    Linking,
    PermissionsAndroid,
    Platform,
} from 'react-native';
import LocationServicesDialogBox  from 'react-native-android-location-services-dialog-box';
import { checkMultiple, PERMISSIONS } from 'react-native-permissions';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';
import messaging from '@react-native-firebase/messaging';
import LogRocket from '@logrocket/react-native';
import SplashScreen from 'react-native-bootsplash';
import notifee, { Event, EventType } from '@notifee/react-native';
import DeviceInfo from 'react-native-device-info';
import { MessagesService, UsersService } from 'therr-react/services';
import { AccessCheckType, IContentState, IForumsState, INotificationsState, IUserState } from 'therr-react/types';
import { ContentActions, ForumActions, NotificationActions, UserConnectionsActions } from 'therr-react/redux/actions';
import { AccessLevels, BrandVariations, GroupMemberRoles, PushNotifications, UserConnectionTypes } from 'therr-js-utilities/constants';
import { SheetManager, Sheets } from 'react-native-actions-sheet';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import BackgroundGeolocation, {
    Config,
    Subscription,
} from 'react-native-background-geolocation';
import getConfig from '../utilities/getConfig';
import { sendForegroundNotification, wrapOnMessageReceived } from '../utilities/pushNotifications';
import routes from '../routes';
import { buildNavTheme } from '../styles';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import HeaderMenuRight from './HeaderMenuRight';
import LocationActions from '../redux/actions/LocationActions';
import UsersActions from '../redux/actions/UsersActions';
import UIActions from '../redux/actions/UIActions';
import { ILocationState } from '../types/redux/location';
import HeaderMenuLeft from './HeaderMenuLeft';
import translator from '../services/translator';
import { buildStyles } from '../styles';
import { buildStyles as buildBottomSheetStyles } from '../styles/bottom-sheet';
import { buildStyles as buildButtonStyles } from '../styles/buttons';
import { buildStyles as buildFormStyles } from '../styles/forms';
import { buildStyles as buildModalStyles } from '../styles/modal';
import { buildStyles as buildInfoModalStyles } from '../styles/modal/infoModal';
import { buildStyles as buildMenuStyles } from '../styles/modal/headerMenuModal';
import { navigationRef, RootNavigation } from './RootNavigation';
import PlatformNativeEventEmitter from '../PlatformNativeEventEmitter';
import HeaderTherrLogo from './HeaderTherrLogo';
import HeaderSearchInput from './Input/HeaderSearchInput';
import HeaderLinkRight from './HeaderLinkRight';
import { AndroidChannelIds, GROUPS_CAROUSEL_TABS, GROUP_CAROUSEL_TABS, getAndroidChannel } from '../constants';
import { socketIO } from '../socket-io-middleware';
import HeaderSearchUsersInput from './Input/HeaderSearchUsersInput';
import { DEFAULT_PAGE_SIZE } from '../routes/Connect';
import background1 from '../assets/dinner-burgers.webp';
import background2 from '../assets/dinner-overhead.webp';
import background3 from '../assets/dinner-overhead-2.webp';
// import NativeDevSettings from 'react-native/Libraries/NativeModules/specs/NativeDevSettings';
import { isUserAuthenticated, isUserEmailVerified } from '../utilities/authUtils';
import Clipboard from '@react-native-clipboard/clipboard';

// NativeDevSettings.setIsDebuggingRemotely(!!__DEV__);

const preLoadImageList = [background1, background2, background3];

const Stack = createStackNavigator();

const forFade = ({ current }) => ({
    cardStyle: {
        opacity: current.progress,
    },
});

const getRequestHeaders = (user) => ({
    'x-userid': user?.details?.id,
    'x-localecode':  user?.settings?.locale || 'en-us',
    'x-platform': 'mobile',
    'x-brand-variation': BrandVariations.TEEM,
});

interface ILayoutDispatchProps {
    createUserGroup: Function;
    deleteUserGroup: Function;
    getMyAchievements: Function;
    getUserGroups: Function;
    logout: Function;
    addNotification: Function;
    searchActiveMomentsByIds: Function;
    searchActiveSpacesByIds: Function;
    searchCategories: Function;
    archiveForum: Function;
    searchNotifications: Function;
    searchUsers: Function;
    updateActiveMomentsStream: Function;
    updateActiveThoughtsStream: Function;
    updateActiveEventsStream: Function;
    updateGpsStatus: Function;
    updateLocationPermissions: Function;
    updateTour: Function;
    updateUser: Function;
    updateUserConnection: Function;
    updateUserConnectionType: Function;
    // Prefetch
    beginPrefetchRequest: Function;
    completePrefetchRequest: Function;
}

interface IStoreProps extends ILayoutDispatchProps {
    content: IContentState;
    forums: IForumsState;
    location: ILocationState;
    notifications: INotificationsState;
    user: IUserState;
}

// Regular component props
export interface ILayoutProps extends IStoreProps {
    startNavigationTour: () => void;
    stopNavigationTour: () => void;
}

interface ILayoutState {
    targetRouteView: string;
    targetRouteParams: any;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    forums: state.forums,
    location: state.location,
    notifications: state.notifications,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            createUserGroup: UsersActions.createUserGroup,
            deleteUserGroup: UsersActions.deleteUserGroup,
            getMyAchievements: UsersActions.getMyAchievements,
            getUserGroups: UsersActions.getUserGroups,
            logout: UsersActions.logout,
            addNotification: NotificationActions.add,
            searchNotifications: NotificationActions.search,
            searchUsers: UsersActions.search,
            searchActiveMomentsByIds: ContentActions.searchActiveMomentsByIds,
            searchActiveSpacesByIds: ContentActions.searchActiveSpacesByIds,
            searchCategories: ForumActions.searchCategories,
            archiveForum: ForumActions.archiveForum,
            updateActiveMomentsStream: ContentActions.updateActiveMomentsStream,
            updateActiveThoughtsStream: ContentActions.updateActiveThoughtsStream,
            updateActiveEventsStream: ContentActions.updateActiveEventsStream,
            updateGpsStatus: LocationActions.updateGpsStatus,
            updateLocationPermissions: LocationActions.updateLocationPermissions,
            updateTour: UsersActions.updateTour,
            updateUser: UsersActions.update,
            updateUserConnection: UserConnectionsActions.update,
            updateUserConnectionType: UserConnectionsActions.updateType,
            // Prefetch
            beginPrefetchRequest: UIActions.beginPrefetchRequest,
            completePrefetchRequest: UIActions.completePrefetchRequest,
        },
        dispatch
    );

class Layout extends React.Component<ILayoutProps, ILayoutState> {
    private authCredentialListener;
    private nativeEventListener;
    private translate;
    private unsubscribePushNotifications;
    private urlEventListener;
    private routeNameRef: any = {};
    private theme = buildStyles();
    private themeBottomSheet = buildBottomSheetStyles();
    private themeButtons = buildButtonStyles();
    private themeForms = buildFormStyles();
    private themeInfoModal = buildInfoModalStyles();
    private themeModal = buildModalStyles();
    private themeMenu = buildMenuStyles();
    subscriptions: Subscription[] = [];

    constructor(props) {
        super(props);

        this.state = {
            targetRouteView: '',
            targetRouteParams: {},
        };

        this.reloadTheme();
        this.translate = (key: string, params?: any) =>
            translator(props?.user?.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        // (Notifee) Push Notification Click Handlers
        this.handleNotifeeBackgroundNotificationEvent();
        this.handleNotifeeForegroundNotificationEvent();

        if (Platform.OS === 'android') {
            Linking.getInitialURL().then(this.handleAppUniversalLinkURL);
        }
        // (Firebase) Push Notifications Click Handler
        this.nativeEventListener = PlatformNativeEventEmitter?.addListener('new-intent-action', this.handleFirebasePushNotificationEvent);
        // Universal links handler
        this.urlEventListener = Linking.addEventListener('url', this.handleUrlEvent);

        if (appleAuth.isSupported) {
            this.authCredentialListener = appleAuth.onCredentialRevoked(async () => {
                console.warn('Apple credential revoked');
                this.logout(this.props?.user?.details);
            });
        }

        DeviceEventEmitter.addListener('locationProviderStatusChange', (status) => { // only trigger when "providerListener" is enabled
            this.props.updateGpsStatus(status);
        });

        this.subscriptions.push(BackgroundGeolocation.onLocation((/* location */) => {
            analytics().logEvent('background_location_on_location', {
                userId: this.props.user?.details?.id,
            }).catch((err) => console.log(err));
        }, (error) => {
            analytics().logEvent('background_location_error', {
                userId: this.props.user?.details?.id,
            }).catch((err) => console.log(err));
            console.log('BackgroundGeolocation-[onLocation] ERROR:', error);
        }));
        // this.subscriptions.push(BackgroundGeolocation.onMotionChange((event) => {
        //     console.log('BackgroundGeolocation-[onMotionChange]', event);
        // }));
        // this.subscriptions.push(BackgroundGeolocation.onActivityChange((event) => {
        //     console.log('BackgroundGeolocation-[onActivityChange]', event);
        // }));
        this.subscriptions.push(BackgroundGeolocation.onProviderChange((event) => {
            // TODO: This might be the same as DeviceEventEmitter.addListener('locationProviderStatusChange'...above
            console.log('BackgroundGeolocation-[onProviderChange]', event);
        }));

        this.readyAndStartBackgroundGeolocation();
        this.prefetchContent();
    }

    componentDidUpdate(prevProps: ILayoutProps) {
        const { targetRouteView, targetRouteParams } = this.state;
        const {
            forums,
            addNotification,
            location,
            searchCategories,
            searchActiveMomentsByIds,
            searchActiveSpacesByIds,
            updateLocationPermissions,
            user,
            updateUser,
        } = this.props;

        if (prevProps.user?.settings?.mobileThemeName !== user?.settings?.mobileThemeName) {
            this.reloadTheme(true);
        }

        if (user?.isAuthenticated !== prevProps.user?.isAuthenticated) {
            if (user.isAuthenticated) { // Happens after login
                const token = user?.details?.idToken;
                if (token) {
                    this.readyAndStartBackgroundGeolocation();
                }

                if (user.details?.id) {
                    crashlytics().setUserId(user.details?.id?.toString());
                    if (!__DEV__) {
                        LogRocket.identify(user.details?.id, {
                            name: `${user.details?.firstName} ${user.details?.lastName}`,
                            email: user.details?.email,

                            // Add your own custom user variables here, ie:
                        });
                    }
                }

                if (targetRouteView) {
                    RootNavigation.reset({
                        index: 0,
                        routes: [
                            { name: 'Areas' },
                            { name: targetRouteView, params: targetRouteParams },
                        ],
                    });
                }

                this.prefetchContent();

                if (!forums?.forumCategories || !forums.forumCategories.length) {
                    searchCategories({
                        itemsPerPage: 100,
                        pageNumber: 1,
                        order: 'desc',
                    }, {});
                }

                if (Platform.OS !== 'ios') {
                    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
                        .then((grantStatus) => {
                            updateLocationPermissions({
                                [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: grantStatus,
                            });
                        });
                    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION)
                        .then((grantStatus) => {
                            updateLocationPermissions({
                                [PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION]: grantStatus,
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
                            await wrapOnMessageReceived(true, remoteMessage);

                            if (remoteMessage?.data?.areasActivated) {
                                const parsedAreasData = typeof (remoteMessage?.data?.areasActivated) === 'string'
                                    ? JSON.parse(remoteMessage?.data?.areasActivated)
                                    : [];
                                const momentsData = parsedAreasData.filter(area => area.momentId);
                                const spacesData = parsedAreasData.filter(area => area.spaceId);
                                if (parsedAreasData.length) {
                                    sendForegroundNotification({
                                        title: this.translate('alertTitles.newAreasActivated'),
                                        body: this.translate('alertMessages.newAreasActivated', {
                                            total: momentsData.length + spacesData.length,
                                        }),
                                        android: {
                                            pressAction: { id: PushNotifications.PressActionIds.discovered, launchActivity: 'default' },
                                        },
                                    }, getAndroidChannel(AndroidChannelIds.contentDiscovery, false));
                                    if (momentsData.length) {
                                        searchActiveMomentsByIds({
                                            userLatitude: location?.user?.latitude,
                                            userLongitude: location?.user?.longitude,
                                            withMedia: true,
                                            withUser: true,
                                            blockedUsers: user.details.blockedUsers,
                                            shouldHideMatureContent: user.details.shouldHideMatureContent,
                                        }, momentsData.map(moment => moment.momentId));
                                    }
                                    if (spacesData.length) {
                                        searchActiveSpacesByIds({
                                            userLatitude: location?.user?.latitude,
                                            userLongitude: location?.user?.longitude,
                                            withMedia: true,
                                            withUser: true,
                                            blockedUsers: user.details.blockedUsers,
                                            shouldHideMatureContent: user.details.shouldHideMatureContent,
                                        }, spacesData.map(space => space.spaceId));
                                    }
                                }
                                // TODO: Fetch associated media files
                                // TODO: Fetch and call insertActiveMoments to "activate" moments on map and discovered
                            }
                            if (remoteMessage?.data?.notificationData) {
                                const parsedNotificationData = typeof (remoteMessage?.data?.notificationData) === 'string'
                                    ? JSON.parse(remoteMessage?.data?.notificationData)
                                    : {};
                                addNotification(parsedNotificationData);
                            }
                        });
                    })
                    .catch((err) => {
                        console.log('NOTIFICATIONS_ERROR', err);
                    });
            } else {
                BackgroundGeolocation.stop();
            }
        }
    }

    componentWillUnmount() {
        this.nativeEventListener?.remove();
        this.urlEventListener?.remove();

        if (Platform.OS !== 'ios') {
            LocationServicesDialogBox.stopListener();
        }

        if (this.authCredentialListener) {
            this.authCredentialListener();
        }

        this.unsubscribePushNotifications && this.unsubscribePushNotifications();
        this.subscriptions.forEach((subscription) => subscription.remove());
    }

    // IMPORTANT: This should only be called once per session
    readyAndStartBackgroundGeolocation = () => {
        const userToken = this.props?.user?.details?.idToken;
        if (this.props.user?.isAuthenticated && userToken
            && this.props.user?.settings?.settingsPushBackground) {
            const backgroundConfig: Config = {
                // Geolocation Config
                desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_MEDIUM,
                distanceFilter: 15,
                // Activity Recognition
                stopTimeout: 5,
                // Application config
                // debug: true, // <-- enable this hear sounds for background-geolocation life-cycle.
                logLevel: BackgroundGeolocation.LOG_LEVEL_ERROR,
                stopOnTerminate: false,   // <-- Allow the background-service to continue tracking when user closes the app.
                startOnBoot: true,        // <-- Auto start tracking when device is powered-up.
                triggerActivities: 'on_foot, walking, running',
                notification: {
                    color: '#0f7b82',
                    smallIcon: 'drawable/ic_notification_icon',
                    text: this.translate('alertTitles.backgroundLocationNotification'),
                    channelName: this.translate('alertTitles.backgroundLocationNotificationChannel'),
                    // channelId: AndroidChannelIds.rewardsFinder,
                    priority: BackgroundGeolocation.NOTIFICATION_PRIORITY_MIN,
                },
                backgroundPermissionRationale: {
                    title: this.translate('alertTitles.backgroundLocation'),
                    message: this.translate('alertMessages.backgroundLocation'),
                    positiveAction: this.translate('alertActions.acceptBackgroundLocation'),
                },
                disableLocationAuthorizationAlert: true,
                // locationAuthorizationAlert
                locationUpdateInterval: 1000 * 60,
                // HTTP / SQLite config
                url: `${getConfig().baseApiGatewayRoute}/push-notifications-service/location/process-user-background-location`,
                batchSync: false,       // <-- [Default: false] Set true to sync locations to server in a single HTTP request.
                autoSync: true,         // <-- [Default: true] Set true to sync each location to server as it arrives.
                headers: {              // <-- Optional HTTP headers
                    ...getRequestHeaders(this?.props?.user),
                    authorization: `Bearer ${userToken}`,
                },
                params: {               // <-- Optional HTTP params
                    // 'auth_token': 'maybe_your_server_authenticates_via_token_YES?',
                    userId: this.props?.user?.details?.id,
                    platformOS: Platform.OS,
                    deviceModel: DeviceInfo.getModel(),
                    isDeviceTablet: DeviceInfo.isTablet(),
                },
            };

            /// 2. ready the plugin.
            BackgroundGeolocation.ready(backgroundConfig).then((state) => {
                analytics().logEvent('background_location_ready', {
                    isEnabled: state.enabled,
                    userId: this.props.user?.details?.id,
                }).catch((err) => console.log(err));

                // Start background location
                if (this.props.user?.isAuthenticated && userToken) {
                    BackgroundGeolocation.start();
                }
            });
        }
    };

    reloadTheme = (shouldForceUpdate: boolean = false) => {
        const themeName = this.props?.user?.settings?.mobileThemeName;
        this.theme = buildStyles(themeName);
        this.themeBottomSheet = buildBottomSheetStyles(themeName);
        this.themeButtons = buildButtonStyles(themeName);
        this.themeForms = buildFormStyles(themeName);
        this.themeMenu = buildMenuStyles(themeName);
        this.themeInfoModal = buildInfoModalStyles(themeName);
        this.themeModal = buildModalStyles(themeName);
        if (shouldForceUpdate) {
            this.forceUpdate();
        }
    };

    prefetchContent = () => {
        const {
            content,
            getMyAchievements,
            getUserGroups,
            searchNotifications,
            searchUsers,
            user,
            updateActiveMomentsStream,
            updateActiveThoughtsStream,
            updateActiveEventsStream,
            beginPrefetchRequest,
            completePrefetchRequest,
        } = this.props;
        if (user.isAuthenticated) {
            // Pre-load activated content
            if (!content?.content?.activeMoments?.length) {
                beginPrefetchRequest({
                    isLoadingActiveMoments: true,
                });
                updateActiveMomentsStream({
                    withMedia: true,
                    withUser: true,
                    offset: 0,
                    ...content.activeAreasFilters,
                    blockedUsers: user.details.blockedUsers,
                    shouldHideMatureContent: user.details.shouldHideMatureContent,
                }).catch((err) => {
                    console.log(err);
                }).finally(() => {
                    completePrefetchRequest({
                        isLoadingActiveMoments: false,
                    });
                });
            }
            if (!content?.content?.activeThoughts?.length) {
                beginPrefetchRequest({
                    isLoadingActiveThoughts: true,
                });
                updateActiveThoughtsStream({
                    withUser: true,
                    withReplies: true,
                    offset: 0,
                    // ...content.activeAreasFilters,
                    blockedUsers: user.details.blockedUsers,
                    shouldHideMatureContent: user.details.shouldHideMatureContent,
                }).catch((err) => {
                    console.log(err);
                }).finally(() => {
                    completePrefetchRequest({
                        isLoadingActiveThoughts: false,
                    });
                });
            }
            if (!content?.content?.activeEvents?.length) {
                beginPrefetchRequest({
                    isLoadingActiveEvents: true,
                });
                updateActiveEventsStream({
                    withMedia: true,
                    withUser: true,
                    offset: 0,
                    ...content.activeAreasFilters,
                    blockedUsers: user.details.blockedUsers,
                    shouldHideMatureContent: user.details.shouldHideMatureContent,
                }).catch((err) => {
                    console.log(err);
                }).finally(() => {
                    completePrefetchRequest({
                        isLoadingActiveEvents: false,
                    });
                });
            }

            // Pre-load notifications
            beginPrefetchRequest({
                isLoadingAchievements: true,
                isLoadingUsers: true,
                isLoadingGroups: true,
                isLoadingNotifications: true,
            });
            searchNotifications({
                filterBy: 'userId',
                query: user.details.id,
                itemsPerPage: 20,
                pageNumber: 1,
                order: 'desc',
            }).catch((err) => {
                console.log(err);
            }).finally(() => {
                completePrefetchRequest({
                    isLoadingNotifications: false,
                });
            });

            // Pre-load achievements
            getMyAchievements().catch((err) => {
                console.log(err);
            }).finally(() => {
                completePrefetchRequest({
                    isLoadingAchievements: false,
                });
            });

            searchUsers(
                {
                    query: '',
                    limit: DEFAULT_PAGE_SIZE,
                    offset: 0,
                    withMedia: true,
                },
            ).catch((err) => {
                console.log(err);
            }).finally(() => {
                completePrefetchRequest({
                    isLoadingUsers: false,
                });
            });

            getUserGroups().catch((err) => {
                console.log(err);
            }).finally(() => {
                completePrefetchRequest({
                    isLoadingGroups: false,
                });
            });
        }
    };

    actionSheetShow = (sheetId: 'group-sheet' | 'user-sheet', options: {
        payload: Partial<Sheets[typeof sheetId]['payload']>;
        // onClose?: (data: Sheets[typeof sheetId]['returnValue'] | undefined) => void;
        context?: string;
    }) => {
        if (sheetId === 'group-sheet') {
            const payload = options.payload as  Partial<Sheets['group-sheet']['payload']>;
            const { user } = this.props;
            const canJoinGroup = !user?.myUserGroups[payload.group.id]?.role;
            const hasGroupEditAccess = user?.myUserGroups[payload.group.id]?.role === GroupMemberRoles.ADMIN;
            const isGroupMember = user?.myUserGroups[payload.group.id]?.role && user?.myUserGroups[payload.group.id]?.role !== GroupMemberRoles.ADMIN;
            const hasGroupArchiveAccess = user?.details?.id === payload.group.authorId;
            return SheetManager.show<typeof sheetId>(sheetId, {
                payload: {
                    group: payload.group,
                    themeForms: this.themeForms,
                    translate: this.translate,
                    canJoinGroup,
                    hasGroupArchiveAccess,
                    hasGroupEditAccess,
                    isGroupMember,
                    onPressArchiveGroup: this.onPressArchiveGroup,
                    onPressEditGroup: this.onPressEditGroup,
                    onPressJoinGroup: this.onPressJoinGroup,
                    onPressLeaveGroup: this.onPressLeaveGroup,
                    onPressShareGroup: this.onPressShareGroup,
                },
            });
        } else if (sheetId === 'user-sheet') {
            // const payload = options.payload as  Partial<Sheets['user-sheet']['payload']>;
            const { user } = this.props;
            return SheetManager.show<typeof sheetId>(sheetId, {
                payload: {
                    userInView: user?.userInView,
                    themeForms: this.themeForms,
                    translate: this.translate,
                    onPressUpdatedConnectionType: this.onPressUpdatedConnectionType,
                },
            });
        }
    };

    onPressArchiveGroup = (group: any) => {
        const route = RootNavigation.getCurrentRoute();
        if (route?.name === 'ViewGroup') {
            this.props.archiveForum(group.id).then(() => {
                Toast.show({
                    type: 'info',
                    text1: this.translate('forms.editGroup.archiveSuccess'),
                    visibilityTime: 2500,
                });
                RootNavigation.navigate('Groups', {
                    activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
                });
            }).catch(() =>{
                Toast.show({
                    type: 'error',
                    text1: this.translate('forms.editGroup.backendErrorMessage'),
                    visibilityTime: 2500,
                });
            });
        }

        SheetManager.hide('group-sheet');
    };

    onPressEditGroup = (group: any) => {
        const route = RootNavigation.getCurrentRoute();
        if (route?.name === 'ViewGroup') {
            RootNavigation.navigate('EditGroup', {
                group,
            });
        }

        SheetManager.hide('group-sheet');
    };

    onPressLeaveGroup = (group: any) => {
        const { deleteUserGroup } = this.props;
        const route = RootNavigation.getCurrentRoute();
        if (route?.name === 'ViewGroup') {
            deleteUserGroup(group.id).then(() => {
                Toast.show({
                    type: 'success',
                    text1: this.translate('alertTitles.exitedGroup'),
                    visibilityTime: 2500,
                });
            }).catch(() => {
                Toast.show({
                    type: 'error',
                    text1: this.translate('forms.editGroup.backendErrorMessage'),
                    visibilityTime: 2500,
                });
            });
            RootNavigation.navigate('Groups', {
                activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
            });
        }

        SheetManager.hide('group-sheet');
    };

    onPressJoinGroup = (group: any) => {
        const { createUserGroup } = this.props;
        const route = RootNavigation.getCurrentRoute();
        if (route?.name === 'ViewGroup') {
            createUserGroup({
                groupId: group.id,
            }).then(() => {
                Toast.show({
                    type: 'success',
                    text1: this.translate('alertTitles.joinedGroup'),
                    visibilityTime: 2500,
                });
            }).catch(() => {
                Toast.show({
                    type: 'error',
                    text1: this.translate('forms.editGroup.backendErrorMessage'),
                    visibilityTime: 2500,
                });
            });
            RootNavigation.navigate('Groups', {
                activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
            });
        }

        SheetManager.hide('group-sheet');
    };

    onPressShareGroup = (group: any) => {
        const route = RootNavigation.getCurrentRoute();
        if (route?.name === 'ViewGroup') {
            Clipboard.setString(`https://www.therr.com/groups/${group.id}`);

        }

        SheetManager.hide('group-sheet');
    };

    onPressUpdatedConnectionType = (userId: string, type: 1 | 2 | 3 | 4 | 5) => {
        const { updateUserConnectionType } = this.props;
        const route = RootNavigation.getCurrentRoute();
        if (route?.name === 'ViewUser') {
            updateUserConnectionType(userId, type).then(() => {
                Toast.show({
                    type: 'success',
                    text1: this.translate('alertTitles.updated'),
                    visibilityTime: 2500,
                });
            }).catch(() => {
                Toast.show({
                    type: 'error',
                    text1: this.translate('alertTitles.backendErrorMessage'),
                    visibilityTime: 2500,
                });
            });
        }

        SheetManager.hide('user-sheet');
    };

    handleFirebasePushNotificationEvent = (data: false | { action: string }) => {
        const { user } = this.props;
        const isNotAuthorized = UsersService.isAuthorized(
            {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            },
            user
        );

        let targetRouteView = '';
        let targetRouteParams: any = {};
        if (data && !Array.isArray(data) && typeof(data) === 'object') {
            if (data.action === PushNotifications.AndroidIntentActions.Therr.ACHIEVEMENT_COMPLETED
                || data.action === PushNotifications.AndroidIntentActions.Therr.UNCLAIMED_ACHIEVEMENTS_REMINDER) {
                targetRouteView = 'Achievements';
            } else if (data.action === PushNotifications.AndroidIntentActions.Therr.CREATE_A_MOMENT_REMINDER) {
                targetRouteView = 'Map';
            } else if (data.action === PushNotifications.AndroidIntentActions.Therr.LATEST_POST_LIKES_STATS) {
                targetRouteView = 'ViewUser';
            } else if (data.action === PushNotifications.AndroidIntentActions.Therr.UNREAD_NOTIFICATIONS_REMINDER) {
                targetRouteView = 'Notifications';
            } else if (data.action === PushNotifications.AndroidIntentActions.Therr.NEW_GROUP_INVITE
                || data.action === PushNotifications.AndroidIntentActions.Therr.NEW_GROUP_MEMBERS) {
                targetRouteView = 'Groups';
                targetRouteParams = {
                    activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
                };
            }
        }

        if (isNotAuthorized) {
            this.setState({
                targetRouteView,
                targetRouteParams,
            });
            RootNavigation.navigate('Login');
        } else if (targetRouteView) {
            RootNavigation.navigate(targetRouteView, targetRouteParams);
        }
    };

    /**
     * Abstract handler for all/most notifee push notification interactions
     */
    handleNotifeeNotificationEvent = (event: Event, isInForeground: boolean, didCauseAppOpen = false): Promise<any> => {
        const { type, detail } = event;
        const { notification, pressAction } = detail;

        if (type === EventType.ACTION_PRESS || type === EventType.PRESS) {
            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.markAsRead) {
                // Remove the notification
                return notifee.cancelNotification(notification?.id);
            }

            const { user } = this.props;
            const isUserAuthorized = UsersService.isAuthorized(
                {
                    type: AccessCheckType.ALL,
                    levels: [AccessLevels.EMAIL_VERIFIED],
                },
                user
            );

            // NOTE: Consider only showing notifications if `isInForeground` is false. Otherwise, notifications
            // only appear after the user clicks the app when is was minimized

            // DEBUG logging only
            if (user?.details?.id === 'a730f85b-bc3a-46ab-97e9-48b8e5875f83') {
                MessagesService.sendAppLog({
                    'notification.id': notification?.id,
                    'notification.pressAction.id': pressAction?.id,
                    'notification.isInForeground': isInForeground,
                    'notification.eventType': type,
                    'notification.didCauseAppOpen': didCauseAppOpen,
                    'notification.isUserAuthorized': isUserAuthorized,
                    platformOS: Platform.OS,
                }, 'info');
            }

            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.exchange) {
                if (isUserAuthorized) {
                    RootNavigation.navigate('ExchangePointsDisclaimer');
                }
                return Promise.resolve();
            }

            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.drafts) {
                if (isUserAuthorized) {
                    RootNavigation.navigate('MyDrafts');
                }
                return Promise.resolve();
            }

            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.discovered) {
                if (isUserAuthorized) {
                    RootNavigation.navigate('Areas');
                }
                return Promise.resolve();
            }

            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.momentView) {
                let area: any = {};
                if (typeof notification?.data?.area === 'string') {
                    area = JSON.parse(notification?.data?.area as string || '{}');
                } else if (typeof notification?.data?.area === 'object') {
                    area = notification?.data?.area;
                }

                if (area?.id) {
                    RootNavigation.navigate('ViewMoment', {
                        isMyContent: area?.fromUserId === user?.details?.id,
                        previousView: 'Map',
                        moment: {
                            id: area?.id,
                        },
                        momentDetails: area,
                    });
                }
                return Promise.resolve();
            }

            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.spaceView) {
                let area: any = {};
                if (typeof notification?.data?.area === 'string') {
                    area = JSON.parse(notification?.data?.area as string || '{}');
                } else if (typeof notification?.data?.area === 'object') {
                    area = notification?.data?.area;
                }

                if (area?.id) {
                    RootNavigation.navigate('ViewSpace', {
                        isMyContent: area?.fromUserId === user?.details?.id,
                        previousView: 'Map',
                        space: {
                            id: area?.id,
                        },
                        spaceDetails: area,
                    });
                }
                return Promise.resolve();
            }

            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.thoughtView) {
                let thought: any = {};
                if (typeof notification?.data?.thought === 'string') {
                    thought = JSON.parse(notification?.data?.thought as string || '{}');
                } else if (typeof notification?.data?.thought === 'object') {
                    thought = notification?.data?.thought;
                }

                if (thought?.id) {
                    RootNavigation.navigate('ViewThought', {
                        isMyContent: thought?.fromUserId === user?.details?.id,
                        previousView: 'Map',
                        thought: {
                            id: thought?.id,
                        },
                        thoughtDetails: thought,
                    });
                }
                return Promise.resolve();
            }

            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.nudge) {
                let area: any = {};
                if (typeof notification?.data?.area === 'string') {
                    area = JSON.parse(notification?.data?.area as string || '{}');
                } else if (typeof notification?.data?.area === 'object') {
                    area = notification?.data?.area;
                }

                // TODO: Implement better user experience to simplify performing action to earn rewards
                if (area?.id) {
                    RootNavigation.navigate('ViewSpace', {
                        isMyContent: area?.fromUserId === user?.details?.id,
                        previousView: 'Map',
                        space: {
                            id: area?.id,
                        },
                        spaceDetails: area,
                    });
                }
                return Promise.resolve();
            }

            if (notification?.id
                && (pressAction?.id === PushNotifications.PressActionIds.groupView || pressAction?.id === PushNotifications.PressActionIds.groupReplyToMsg)) {
                const groupId = notification?.data?.groupId as string;

                if (groupId) {
                    const routeParams = {
                        activeTab: GROUP_CAROUSEL_TABS.CHAT,
                        id: groupId,
                    };

                    if (!isUserAuthorized) {
                        this.setState({
                            targetRouteView: 'ViewGroup',
                            targetRouteParams: routeParams,
                        });

                        return Promise.resolve();
                    }

                    RootNavigation.navigate('ViewGroup',routeParams);
                }

                return Promise.resolve();
            }

            if (notification?.id
                && (pressAction?.id === PushNotifications.PressActionIds.dmView || pressAction?.id === PushNotifications.PressActionIds.dmReplyToMsg)) {
                let fromUserDetails: any = {};
                if (typeof notification?.data?.fromUser === 'string') {
                    fromUserDetails = JSON.parse(notification?.data?.fromUser as string || '{}');
                } else if (typeof notification?.data?.fromUser === 'object') {
                    fromUserDetails = notification?.data?.fromUser;
                }
                if (fromUserDetails?.id) {
                    const routeParams = {
                        connectionDetails: {
                            id: fromUserDetails.id,
                            userName: fromUserDetails.userName, // TODO: Ensure username rather than full name
                        },
                    };

                    if (!isUserAuthorized) {
                        this.setState({
                            targetRouteView: 'DirectMessage',
                            targetRouteParams: routeParams,
                        });

                        return Promise.resolve();
                    }

                    RootNavigation.navigate('DirectMessage', routeParams);
                }
                return Promise.resolve();
            }

            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.userView) {
                let fromUserDetails: any = {};
                if (typeof notification?.data?.fromUser === 'string') {
                    fromUserDetails = JSON.parse(notification?.data?.fromUser as string || '{}');
                } else if (typeof notification?.data?.fromUser === 'object') {
                    fromUserDetails = notification?.data?.fromUser;
                }
                if (fromUserDetails?.id) {
                    const routeParams = {
                        userInView: {
                            id: fromUserDetails.id,
                        },
                    };

                    if (!isUserAuthorized) {
                        this.setState({
                            targetRouteView: 'ViewUser',
                            targetRouteParams: routeParams,
                        });

                        return Promise.resolve();
                    }

                    RootNavigation.navigate('ViewUser', routeParams);
                }
                return Promise.resolve();
            }

            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.userAcceptConnectionRequest) {
                let fromUserDetails: any = {};
                if (typeof notification?.data?.fromUser === 'string') {
                    fromUserDetails = JSON.parse(notification?.data?.fromUser as string || '{}');
                } else if (typeof notification?.data?.fromUser === 'object') {
                    fromUserDetails = notification?.data?.fromUser;
                }
                if (fromUserDetails?.id) {
                    const routeParams = {
                        userInView: {
                            id: fromUserDetails.id,
                        },
                    };

                    if (!isUserAuthorized) {
                        this.setState({
                            targetRouteView: 'ViewUser',
                            targetRouteParams: routeParams,
                        });

                        return Promise.resolve();
                    }

                    this.props.updateUserConnection({
                        connection: {
                            otherUserId: fromUserDetails.id,
                            requestStatus: UserConnectionTypes.COMPLETE,
                        },
                        user: user.details,
                    }).then(() => {
                        Toast.show({
                            type: 'success',
                            text1: this.translate('alertTitles.connectionAccepted'),
                            visibilityTime: 2500,
                        });
                    }).catch(() => {
                        Toast.show({
                            type: 'error',
                            text1: this.translate('alertTitles.backendErrorMessage'),
                            visibilityTime: 2500,
                        });
                    }).finally(() => {
                        RootNavigation.navigate('ViewUser', routeParams);
                    });
                }
                return Promise.resolve();
            }

            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.discovered) {
                return Promise.resolve();
            }
        }

        if (type === EventType.DISMISSED) {
            return Promise.resolve();
        }

        if (isInForeground) {
            // TODO: Display in-app toast notification?
        }

        return Promise.resolve();
    };

    handleNotifeeBackgroundNotificationEvent = () => {
        return notifee.onBackgroundEvent((event) => this.handleNotifeeNotificationEvent(event, false));
    };

    handleNotifeeForegroundNotificationEvent = () => {
        return notifee.onForegroundEvent((event) => this.handleNotifeeNotificationEvent(event, true));
    };

    /**
     * Notifee Push Notification caused app to open
     */
    handleOpenByNotifeeNotification = () => notifee.getInitialNotification()
        .then((initialNotification) => {
            if (initialNotification) {
                const event = {
                    type: EventType.PRESS,
                    detail: {
                        notification: initialNotification.notification,
                        pressAction: initialNotification.pressAction,
                    },
                };
                this.handleNotifeeNotificationEvent(event, false, true);
            }
        }).catch((err) => {
            console.log(err);
        });

    handleUrlEvent = (event) => {
        this.handleAppUniversalLinkURL(event.url);
    };

    /**
     * Firebase Push Notification caused app to open
     */
    handleAppUniversalLinkURL = (url) => {
        const { user } = this.props;
        const urlSplit = url?.split('?') || [];
        const viewMomentRegex = RegExp('moments/[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}/view', 'i');
        const viewMomentFromDesktopRegex = RegExp('moments/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})', 'i');
        const viewSpaceRegex = RegExp('spaces/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})/view', 'i');
        const viewSpaceFromDesktopRegex = RegExp('spaces/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})', 'i');
        const viewUserRegex = RegExp('users/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})/view', 'i');
        const viewUserFromDesktopRegex = RegExp('users/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})', 'i');
        const viewEventRegex = RegExp('events/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})', 'i');
        const viewGroupRegex = RegExp('groups/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})', 'i');
        const isUserLoggedIn = isUserAuthenticated(user);
        const isUserMissingProps = UsersService.isAuthorized(
            {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            },
            user
        );
        const isUserEmailVerified = UsersService.isAuthorized(
            {
                type: AccessCheckType.ANY,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            },
            user
        );

        if (url?.includes('therr.com/?access_token=')) {
            // Route for 3rd party OAuth (Facebook, Instagram, etc.)
            // TODO: This is needs updated and tested
            const urlWithNoHash = url.split('#_');
            const cleanUrl = urlWithNoHash[0] || url;
            const queryStringSplit = cleanUrl.split('?');
            let authResult = {};
            if (!queryStringSplit[1]) {
                authResult = { error: 'missing-query-params' };
            } else {
                authResult = qs.parse(queryStringSplit[1]);
            }
            RootNavigation.replace('SocialSync', {
                authResult,
            });
        } else if (url?.includes('verify-account')) {
            if (urlSplit[1] && urlSplit[1].includes('token=')) {
                const verificationToken = urlSplit[1]?.split('token=')[1];
                if (!isUserLoggedIn && !isUserEmailVerified) {
                    RootNavigation.navigate('EmailVerification', {
                        verificationToken,
                    });
                }
            }
        } else if (url?.includes('therr.com/emails/unsubscribe')) {
            if (isUserLoggedIn && !isUserMissingProps) {
                RootNavigation.navigate('ManageNotifications');
            } else {
                this.setState({
                    targetRouteView: 'ManageNotifications',
                });
            }
        } else if (url?.includes('therr.com/achievements')) {
            if (isUserLoggedIn && !isUserMissingProps) {
                RootNavigation.navigate('Achievements');
            } else {
                this.setState({
                    targetRouteView: 'Achievements',
                });
            }
        } else if (url?.includes('therr.com/app-feedback')) {
            if (isUserLoggedIn && !isUserMissingProps) {
                RootNavigation.navigate('Home');
            } else {
                this.setState({
                    targetRouteView: 'Home',
                });
            }
        } else if (url?.match(viewMomentRegex) || url?.match(viewMomentFromDesktopRegex)) {
            const momentId = (url?.match(viewMomentRegex) || url?.match(viewMomentFromDesktopRegex))[1];
            let targetRouteParams: any = {};
            if (momentId) {
                targetRouteParams = {
                    moment: {
                        id: momentId,
                    },
                };
            }
            if (isUserLoggedIn && !isUserMissingProps) {
                RootNavigation.navigate('ViewMoment', targetRouteParams);
            } else {
                this.setState({
                    targetRouteView: 'ViewMoment',
                    targetRouteParams,
                });
            }
        } else if (url?.match(viewSpaceRegex) || url?.match(viewSpaceFromDesktopRegex)) {
            const spaceId = (url?.match(viewSpaceRegex) || url?.match(viewSpaceFromDesktopRegex))[1];
            let targetRouteParams: any = {};
            if (spaceId) {
                targetRouteParams = {
                    space: {
                        id: spaceId,
                    },
                };
            }
            if (isUserLoggedIn && !isUserMissingProps) {
                RootNavigation.navigate('ViewSpace', targetRouteParams);
            } else {
                this.setState({
                    targetRouteView: 'ViewSpace',
                    targetRouteParams,
                });
            }
        } else if (url?.match(viewUserRegex) || url?.match(viewUserFromDesktopRegex)) {
            const userId = (url?.match(viewUserRegex) || url?.match(viewUserFromDesktopRegex))[1];
            let targetRouteParams: any = {};
            if (userId) {
                targetRouteParams = {
                    userInView: {
                        id: userId,
                    },
                };
            }
            if (isUserLoggedIn && !isUserMissingProps) {
                RootNavigation.navigate('ViewUser', targetRouteParams);
            } else {
                this.setState({
                    targetRouteView: 'ViewUser',
                    targetRouteParams,
                });
            }
        } else if (url?.match(viewEventRegex)) {
            const eventId = (url?.match(viewEventRegex))[1];
            let targetRouteParams: any = {};
            if (eventId) {
                targetRouteParams = {
                    previousView: 'Areas',
                    event: {
                        id: eventId,
                    },
                    eventDetails: {},
                };
            }
            if (isUserLoggedIn && !isUserMissingProps) {
                RootNavigation.navigate('ViewEvent', targetRouteParams);
            } else {
                this.setState({
                    targetRouteView: 'ViewEvent',
                    targetRouteParams,
                });
            }
        } else if (url?.match(viewGroupRegex)) {
            const groupId = (url?.match(viewGroupRegex))[1];
            let targetRouteParams: any = {};
            if (groupId) {
                targetRouteParams = {
                    id: groupId,
                };
            }
            if (isUserLoggedIn && !isUserMissingProps) {
                RootNavigation.navigate('ViewGroup', targetRouteParams);
            } else {
                this.setState({
                    targetRouteView: 'ViewGroup',
                    targetRouteParams,
                });
            }
        } else if (Platform.OS !== 'ios') {
            // IOS will use the notifee foreground listener instead
            this.handleOpenByNotifeeNotification();
        }
    };

    getCurrentScreen = (navigation) => {
        const navState = navigation.getState();

        return navState.routes[navState.routes.length - 1]?.name;
    };

    getCurrentScreenParams = (navigation) => {
        const navState = navigation.getState();

        return navState.routes?.[navState.routes.length - 1]?.params || {};
    };

    getIosNotificationPermissions = () => {
        // TODO: Determine if 2nd then is even necessary
        return notifee.requestPermission()
            .then((permissions) => {
                if (permissions?.authorizationStatus !== 1) {
                    console.log('Notifee authorization status:', permissions);
                }
                return messaging().requestPermission();
            })
            .then((authStatus) => {
                const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED
                    || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
                if (!enabled) {
                    console.log('Notifications authorization status:', authStatus);
                }
            });
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

    isUserEmailVerified = () => {
        return isUserEmailVerified(this.props.user);
    };

    isUserAuthenticated = () => {
        return isUserAuthenticated(this.props.user);
    };

    logout = async (userDetails) => {
        const { logout } = this.props;

        this.unsubscribePushNotifications && this.unsubscribePushNotifications();
        socketIO.disconnect();

        this.setState({
            targetRouteView: '',
            targetRouteParams: {},
        });

        this.subscriptions.forEach((subscription) => subscription.remove());
        BackgroundGeolocation.stop().catch((err) => {
            console.error(`Failed to stop background location after logout: ${err}`);
            analytics().logEvent('background_location_stop_error', {
                userId: this.props.user?.details?.id,
            }).catch((err) => console.log(err));
        });

        return logout(userDetails);
    };

    render() {
        const {
            location,
            notifications,
            updateGpsStatus,
            user,
        } = this.props;

        return (
            <NavigationContainer
                theme={buildNavTheme(this.theme)}
                ref={navigationRef}
                onReady={() => {
                    this.routeNameRef.current = navigationRef?.getCurrentRoute()?.name;
                    Promise.allSettled(preLoadImageList.map((image) => {
                        const img = Image.resolveAssetSource(image).uri;
                        return Image.prefetch(img);
                    })).finally(() => {
                        // TODO: Update users lastSessionStartAt property to track user activity
                        SplashScreen.hide({ fade: true });
                    });
                }}
                onStateChange={async () => {
                    const previousRouteName = this.routeNameRef.current;
                    const currentRouteName = navigationRef?.getCurrentRoute()?.name;
                    if (currentRouteName !== 'Map') {
                        // Prevent stuck tour on wrong routes
                        this.props.stopNavigationTour();
                    }

                    if (previousRouteName !== currentRouteName) {
                        await analytics().logScreenView({
                            screen_name: currentRouteName,
                            screen_class: currentRouteName,
                            is_authenticated: this.isUserAuthenticated() ? 'yes' : 'no',
                        });
                    }
                    this.routeNameRef.current = currentRouteName;
                }}
            >
                <Stack.Navigator
                    screenOptions={({ navigation }) => {
                        const themeName = this.props?.user?.settings?.mobileThemeName;
                        const currentScreen = this.getCurrentScreen(navigation);
                        const currentScreenParams = this.getCurrentScreenParams(navigation);
                        const isConnect = currentScreen === 'Connect';
                        const isAreas = currentScreen === 'Areas';
                        const isMoment = currentScreen === 'ViewMoment' || currentScreen === 'EditMoment';
                        const isMap = currentScreen === 'Map';
                        const hasLogoHeaderTitle = currentScreen === 'Login'
                            || currentScreen === 'Landing'
                            || currentScreen === 'Home'
                            || currentScreen === 'ForgotPassword'
                            || currentScreen === 'Nearby'
                            || currentScreen === 'EmailVerification'
                            || currentScreen === 'Register';
                        const isAccentPage = currentScreen === 'EditMoment'
                            || currentScreen === 'EditSpace'
                            || currentScreen === 'ViewMoment'
                            || currentScreen === 'ViewGroup'
                            || currentScreen === 'ViewSpace';
                        let headerTitle;
                        let headerStyle = this.theme.styles.headerStyle;
                        let headerStyleName: any = 'light';
                        let headerTitleColor = themeName === 'light'
                            ? this.theme.colors.primary3
                            : this.theme.colors.textWhite;
                        if (isMoment) {
                            headerStyleName = 'accent';
                            headerTitleColor = this.theme.colors.accentLogo;
                        }
                        if (isAccentPage) {
                            headerStyle = this.theme.styles.headerStyleAccent;
                        }
                        if (hasLogoHeaderTitle) {
                            headerTitle = () => <HeaderTherrLogo navigation={navigation} theme={this.theme} />;
                        }
                        if (isAreas) {
                            headerTitle = () => <HeaderSearchInput
                                isAdvancedSearch
                                navigation={navigation}
                                theme={this.theme}
                                themeForms={this.themeForms}
                            />;
                        }
                        if (isMap) {
                            headerTitle = () => <HeaderSearchInput
                                navigation={navigation}
                                theme={this.theme}
                                themeForms={this.themeForms}
                            />;
                        }
                        if (isConnect) {
                            headerTitle = () => <HeaderSearchUsersInput
                                navigation={navigation}
                                theme={this.theme}
                                themeForms={this.themeForms}
                            />;
                        }

                        return ({
                            animationEnabled: true,
                            cardStyleInterpolator: forFade,
                            headerLeft: () => <HeaderMenuLeft
                                styleName={headerStyleName}
                                navigation={navigation}
                                isAuthenticated={user.isAuthenticated}
                                isEmailVerifed={this.isUserEmailVerified()}
                                theme={this.theme}
                            />,
                            headerRight: () => this.shouldShowTopRightMenu() ?
                                <HeaderMenuRight
                                    currentScreen={currentScreen}
                                    currentScreenParams={currentScreenParams}
                                    navigation={navigation}
                                    notifications={notifications}
                                    styleName={headerStyleName}
                                    isEmailVerifed={this.isUserEmailVerified()}
                                    isVisible={this.shouldShowTopRightMenu()}
                                    location={location}
                                    logout={this.logout}
                                    updateGpsStatus={updateGpsStatus}
                                    user={user}
                                    showActionSheet={this.actionSheetShow}
                                    startNavigationTour={this.props.startNavigationTour}
                                    theme={this.theme}
                                    themeButtons={this.themeButtons}
                                    themeInfoModal={this.themeInfoModal}
                                    themeMenu={this.themeMenu}
                                /> :
                                <HeaderLinkRight
                                    navigation={navigation}
                                    themeForms={this.themeForms}
                                    styleName={headerStyleName}
                                />,
                            headerTitleStyle: {
                                ...this.theme.styles.headerTitleStyle,
                                color: headerTitleColor,
                                textShadowOffset: { width: 0, height: 0 },
                                textShadowRadius: 0,
                                maxWidth: 250,
                            },
                            headerTitleAlign: 'center',
                            headerStyle,
                            headerTransparent: false,
                            headerBackVisible: false,
                            headerBackTitleVisible: false,
                            headerTitle,
                        });
                    }}
                >
                    {routes
                        .filter((route: any) => {
                            if (
                                !(
                                    route.options &&
                                    typeof route.options === 'function' &&
                                    route.options().access
                                )
                            ) {
                                return true;
                            }

                            if (route.name === 'Landing' && user?.details?.id) {
                                return false;
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
