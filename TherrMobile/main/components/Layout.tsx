import React from 'react';
import axios from 'axios';
import qs from 'qs';
import {
    AppState,
    AppStateStatus,
    Image,
    Linking,
    NativeModules,
    NativeEventSubscription,
    PermissionsAndroid,
    Platform,
} from 'react-native';
import { checkMultiple, PERMISSIONS } from 'react-native-permissions';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import { getAnalytics, logEvent, logScreenView } from '@react-native-firebase/analytics';
import { getCrashlytics, log as crashlyticsLog, recordError, setUserId as setCrashlyticsUserId } from '@react-native-firebase/crashlytics';
import {
    getInitialNotification,
    getMessaging,
    getToken,
    hasPermission,
    onMessage,
    onNotificationOpenedApp,
    registerDeviceForRemoteMessages,
    AuthorizationStatus,
} from '@react-native-firebase/messaging';
import LogRocket from '@logrocket/react-native';
import SplashScreen from 'react-native-bootsplash';
import notifee, { Event, EventType } from '@notifee/react-native';
import { MessagesService, UsersService } from 'therr-react/services';
import { AccessCheckType, IContentState, IForumsState, INotificationsState, IUserState } from 'therr-react/types';
import { IUIState } from '../types/redux/ui';
import { ContentActions, ForumActions, HabitActions, NotificationActions, SocketActions, UserConnectionsActions } from 'therr-react/redux/actions';
import { AccessLevels, BrandVariations, FeatureFlags, GroupMemberRoles, PushNotifications, UserConnectionTypes } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';
import { SheetManager, Sheets } from 'react-native-actions-sheet';
import { NavigationContainer, type ParamListBase } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';
import 'react-native-gesture-handler';
import { showToast } from '../utilities/toasts';
import getConfig from '../utilities/getConfig';
import { sendForegroundNotification, wrapOnMessageReceived } from '../utilities/pushNotifications';
import routes from '../routes';
import { buildNavTheme, getHeaderTopInset } from '../styles';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import HeaderMenuRight from './HeaderMenuRight';
import LocationActions from '../redux/actions/LocationActions';
import UsersActions from '../redux/actions/UsersActions';
import UIActions from '../redux/actions/UIActions';
import { ILocationState } from '../types/redux/location';
import HeaderMenuLeft from './HeaderMenuLeft';
import translator from '../utilities/translator';
import { buildStyles } from '../styles';
import { buildStyles as buildBottomSheetStyles } from '../styles/bottom-sheet';
import { buildStyles as buildButtonStyles } from '../styles/buttons';
import { buildStyles as buildFormStyles } from '../styles/forms';
import { buildStyles as buildModalStyles } from '../styles/modal';
import { buildStyles as buildConfirmModalStyles } from '../styles/modal/confirmModal';
import { buildStyles as buildInfoModalStyles } from '../styles/modal/infoModal';
import { buildStyles as buildMenuStyles } from '../styles/modal/headerMenuModal';
import { buildStyles as buildDisclosureStyles } from '../styles/modal/locationDisclosure';
import permissions, { PermType } from '../utilities/permissionsOrchestrator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PermissionPrimerModal from './Modals/PermissionPrimerModal';
import AppReviewPromptModal, { AppReviewPromptOutcome } from './Modals/AppReviewPromptModal';
import {
    markReviewPromptCompleted,
    markReviewPromptDeclined,
    markReviewPromptShown,
    shouldShowReviewPrompt,
} from '../utilities/appReviewPrompt';
import { openStoreReviewPage } from '../utilities/appStoreReviewLink';
import { openSupportEmail } from '../utilities/supportContact';
import { navigationRef, RootNavigation } from './RootNavigation';
import PlatformNativeEventEmitter from '../PlatformNativeEventEmitter';
import HeaderTherrLogo from './HeaderTherrLogo';
import SplashLogoSpinner from './SplashLogoSpinner';
import HeaderSearchInput from './Input/HeaderSearchInput';
import HeaderLinkRight from './HeaderLinkRight';
import { AndroidChannelIds, GROUPS_CAROUSEL_TABS, GROUP_CAROUSEL_TABS, getAndroidChannel } from '../constants';
import { socketIO, updateSocketToken } from '../socket-io-middleware';
import HeaderSearchUsersInput from './Input/HeaderSearchUsersInput';
import { DEFAULT_PAGE_SIZE } from '../routes/Connect';
import background1 from '../assets/landing-jungle.webp';
import background2 from '../assets/landing-tree.webp';
import background3 from '../assets/landing-chameleon.webp';
import { isUserAuthenticated, isUserEmailVerified } from '../utilities/authUtils';
import { getBrandInitialRouteName } from '../utilities/brandLandingRoute';
import Clipboard from '@react-native-clipboard/clipboard';
import { buildGroupUrl } from '../utilities/shareUrls';
import getDeviceTimeZone from '../utilities/deviceTimeZone';

const preLoadImageList = [background1, background2, background3];

// Android app-shortcut intent-action suffixes (long-press launcher icon).
// Matched by suffix so the same JS handles every brand binary regardless of
// its package prefix (app.therrmobile.* / com.therr.mobile.* / ...). See
// android/app/src/main/res/xml/shortcuts.xml.
const QUICK_ACTION_SUFFIXES = {
    CREATE_MOMENT: '.QUICK_CREATE_MOMENT',
    CREATE_THOUGHT: '.QUICK_CREATE_THOUGHT',
};

const Stack = createNativeStackNavigator<ParamListBase, undefined>();

const isLocationServicesEnabled = () => getConfig()?.featureFlags?.[FeatureFlags.ENABLE_LOCATION_SERVICES] !== false;

interface ILayoutDispatchProps {
    createUserGroup: Function;
    deleteUserGroup: Function;
    getActivePacts: Function;
    acceptPact: Function;
    renewPact: Function;
    createCheckin: Function;
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
    refreshConnection: Function;
    // Prefetch
    beginPrefetchRequest: Function;
    completePrefetchRequest: Function;
}

interface IStoreProps extends ILayoutDispatchProps {
    content: IContentState;
    forums: IForumsState;
    location: ILocationState;
    notifications: INotificationsState;
    ui: IUIState;
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
    permissionPrimerType: PermType | null;
    shouldSpinSplashLogo: boolean;
    isSplashSpinnerVisible: boolean;
    isAppReviewPromptVisible: boolean;
}

/**
 * Delay before the review prompt is considered on a cold start, measured from the splash
 * handoff. Long enough that the first screen has settled and the user is looking at their
 * own content rather than at a loading state.
 */
const APP_REVIEW_PROMPT_COLD_START_DELAY_MS = 8000;
/** Same idea on a warm return, where there is no splash and no first fetch to wait on. */
const APP_REVIEW_PROMPT_FOREGROUND_DELAY_MS = 3000;
/** How long the app must have been away for a return to count as the user coming back to it. */
const APP_REVIEW_PROMPT_MIN_AWAY_MS = 60000;

const mapStateToProps = (state: any) => ({
    content: state.content,
    forums: state.forums,
    location: state.location,
    notifications: state.notifications,
    ui: state.ui,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            createUserGroup: UsersActions.createUserGroup,
            deleteUserGroup: UsersActions.deleteUserGroup,
            getActivePacts: HabitActions.getActivePacts,
            acceptPact: HabitActions.acceptPact,
            renewPact: HabitActions.renewPact,
            createCheckin: HabitActions.createCheckin,
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
            refreshConnection: SocketActions.refreshConnection,
            // Prefetch
            beginPrefetchRequest: UIActions.beginPrefetchRequest,
            completePrefetchRequest: UIActions.completePrefetchRequest,
        },
        dispatch
    );

class Layout extends React.Component<ILayoutProps, ILayoutState> {
    private authCredentialListener;
    private fcmOpenedUnsubscribe;
    private nativeEventListener;
    private translate;
    private unsubscribePushNotifications;
    private urlEventListener;
    private routeNameRef: any = {};
    // Latest navigation state, mirrored on every state change so it survives the
    // locale-keyed remount of the NavigationContainer (see `render`).
    private lastNavigationState: any = undefined;
    private theme = buildStyles();
    private themeBottomSheet = buildBottomSheetStyles();
    private themeButtons = buildButtonStyles();
    private themeForms = buildFormStyles();
    private themeInfoModal = buildInfoModalStyles();
    private themeModal = buildModalStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeMenu = buildMenuStyles();
    private themeDisclosure = buildDisclosureStyles();
    private permissionPrimerResolve: ((allowed: boolean) => void) | null = null;
    private unsubscribeNotificationsGranted: (() => void) | null = null;
    private fcmRegistrationStarted = false;
    private appStateListener: NativeEventSubscription | null = null;
    private lastBackgroundedAt: number | null = null;
    private appReviewPromptTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(props) {
        super(props);

        this.state = {
            targetRouteView: '',
            targetRouteParams: {},
            permissionPrimerType: null,
            shouldSpinSplashLogo: false,
            isSplashSpinnerVisible: true,
            isAppReviewPromptVisible: false,
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
            // App-shortcut cold-start: a shortcut tapped while the app is killed
            // launches via onCreate (not onNewIntent), so read the launch intent's
            // action once and route it through the same handler as the warm path.
            NativeModules.InitialIntent?.getInitialAction?.()
                .then((action: string | null) => {
                    if (action) {
                        this.handleFirebasePushNotificationEvent({ action });
                    }
                })
                .catch((err) => console.log('INITIAL_INTENT_ACTION_ERROR', err));
        }
        // (Firebase) Push Notifications Click Handler (Android intent-filter path)
        this.nativeEventListener = PlatformNativeEventEmitter?.addListener('new-intent-action', this.handleFirebasePushNotificationEvent);

        // (Firebase) iOS APNS-alert path: tap on a backgrounded-state notification
        this.fcmOpenedUnsubscribe = onNotificationOpenedApp(getMessaging(), (remoteMessage) => {
            this.handleRemoteMessageTap(remoteMessage);
        });
        // (Firebase) iOS APNS-alert path: tap on a killed-state notification that launched the app
        getInitialNotification(getMessaging())
            .then((remoteMessage) => {
                if (remoteMessage) {
                    this.handleRemoteMessageTap(remoteMessage);
                }
            })
            .catch((err) => console.log('FCM_INITIAL_NOTIFICATION_ERROR', err));
        // Universal links handler
        this.urlEventListener = Linking.addEventListener('url', this.handleUrlEvent);

        // Returning to the app is the calmest moment we get: nothing is mid-flow and no
        // other modal is being opened, which is where the review prompt belongs.
        this.appStateListener = AppState.addEventListener('change', this.handleAppStateChange);

        if (appleAuth.isSupported) {
            this.authCredentialListener = appleAuth.onCredentialRevoked(async () => {
                console.warn('Apple credential revoked');
                this.logout(this.props?.user?.details);
            });
        }

        // Socket reconnection handlers (ensure token is refreshed on reconnect).
        // Store references so we can detach them in componentWillUnmount; otherwise
        // each Layout remount (login/logout cycle) accumulates duplicate handlers.
        socketIO.on('reconnect_attempt', this.handleSocketReconnectAttempt);
        socketIO.on('reconnect', this.handleSocketReconnect);

        this.prefetchContent();

        // Wire the permissions orchestrator: a single primer modal lives at the
        // root, opened by any call site that goes through `permissions.request`.
        permissions.registerPrimerListener(({ type, resolve }) => {
            this.permissionPrimerResolve = resolve;
            this.setState({ permissionPrimerType: type });
        });
        // Whenever notifications are granted (login already-granted path or
        // post-primer OS approval), register the FCM device token and the
        // foreground message handler. Replaces the unconditional chain that
        // used to run on auth state change.
        this.unsubscribeNotificationsGranted = permissions.onGranted('notifications', () => {
            this.registerDeviceForFCM();
        });

        if (this.props.user?.isAuthenticated) {
            // Persisted-session launch: componentDidUpdate's auth-transition gate
            // doesn't fire when the user is already authenticated at mount, so
            // reset to the brand-appropriate landing screen here.
            if (CURRENT_BRAND_VARIATION === BrandVariations.HABITS) {
                this.resetToHabitsLanding();
            }
            // Returning session: try silent FCM registration and give the
            // soft-ask a chance via the second-session fallback.
            this.tryRegisterDeviceTokenIfAuthorized();
            permissions.requestIfAppropriate('notifications', { trigger: 'secondSession' });
        }
    }

    componentDidUpdate(prevProps: ILayoutProps) {
        const { targetRouteView, targetRouteParams } = this.state;
        const {
            forums,
            searchCategories,
            updateLocationPermissions,
            user,
        } = this.props;

        if (prevProps.user?.settings?.mobileThemeName !== user?.settings?.mobileThemeName) {
            this.reloadTheme(true);
        }

        if (user?.isAuthenticated !== prevProps.user?.isAuthenticated) {
            if (user.isAuthenticated) { // Happens after login
                // One-shot drain: if the user opened a /claim-pact/<token> link
                // before authenticating, redeem it now so the inviter's gate
                // (PactOnboardingGuard) can lift on their first refresh.
                AsyncStorage.getItem('pendingPactClaimToken')
                    .then((pendingToken) => {
                        if (!pendingToken) return undefined;
                        return axios.post('/users-service/habits/pacts/claim', { token: pendingToken })
                            .then(() => {
                                // Refresh active pacts so PactOnboardingGuard lifts
                                // immediately — without this the invitee's first
                                // screen is an empty gate until manual refresh.
                                this.props.getActivePacts();
                            })
                            .finally(() => AsyncStorage.removeItem('pendingPactClaimToken'));
                    })
                    .catch((err) => {
                        console.log('PACT_CLAIM_DRAIN_ERROR', err?.message);
                        AsyncStorage.removeItem('pendingPactClaimToken').catch(() => undefined);
                    });

                if (user.details?.id) {
                    setCrashlyticsUserId(getCrashlytics(), user.details?.id?.toString());
                    if (!__DEV__) {
                        LogRocket.identify(user.details?.id, {
                            name: `${user.details?.firstName} ${user.details?.lastName}`,
                            email: user.details?.email,

                            // Add your own custom user variables here, ie:
                        });
                    }
                }

                if (CURRENT_BRAND_VARIATION === BrandVariations.HABITS) {
                    // HABITS has its own dashboard; the targetRouteView path
                    // below routes through Areas, which is feature-flagged off
                    // for HABITS and would otherwise leave the user on a
                    // fallback screen (e.g., Home) after login.
                    this.resetToHabitsLanding();
                } else if (targetRouteView) {
                    RootNavigation.reset({
                        index: 0,
                        routes: [
                            { name: 'Areas' },
                            { name: targetRouteView, params: targetRouteParams },
                        ],
                    });
                }

                this.prefetchContent();

                const featureFlags = getConfig().featureFlags || {};
                if (featureFlags.ENABLE_FORUMS && (!forums?.forumCategories || !forums.forumCategories.length)) {
                    searchCategories({
                        itemsPerPage: 100,
                        pageNumber: 1,
                        order: 'desc',
                    }, {});
                }

                if (Platform.OS !== 'ios') {
                    if (isLocationServicesEnabled()) {
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
                    }
                    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA)
                        .then((grantStatus) => {
                            updateLocationPermissions({
                                [PermissionsAndroid.PERMISSIONS.CAMERA]: grantStatus,
                            });
                        });
                } else if (isLocationServicesEnabled()) {
                    checkMultiple([PERMISSIONS.IOS.LOCATION_ALWAYS]).then((statuses) => {
                        updateLocationPermissions(statuses);
                    });
                }

                // Silent token registration only — no OS prompt fires here.
                // Notification permission asks are anchored to engagement triggers
                // and a second-session fallback via permissionsOrchestrator.
                this.tryRegisterDeviceTokenIfAuthorized();
            } else {
                // Tear down the FCM subscription so a subsequent login re-registers
                // (refreshes the device token and re-attaches axios headers).
                if (this.unsubscribePushNotifications) {
                    this.unsubscribePushNotifications();
                    this.unsubscribePushNotifications = undefined;
                }
                this.fcmRegistrationStarted = false;
            }
        }
    }

    componentWillUnmount() {
        this.nativeEventListener?.remove();
        this.urlEventListener?.remove();
        this.appStateListener?.remove();

        if (this.appReviewPromptTimeout) {
            clearTimeout(this.appReviewPromptTimeout);
            this.appReviewPromptTimeout = null;
        }

        if (this.authCredentialListener) {
            this.authCredentialListener();
        }

        socketIO.off('reconnect_attempt', this.handleSocketReconnectAttempt);
        socketIO.off('reconnect', this.handleSocketReconnect);

        this.unsubscribePushNotifications && this.unsubscribePushNotifications();
        this.fcmOpenedUnsubscribe && this.fcmOpenedUnsubscribe();
        this.unsubscribeNotificationsGranted?.();
        this.unsubscribeNotificationsGranted = null;
        permissions.registerPrimerListener(null);
    }

    // For HABITS, the first authenticated reset goes to a one-time push opt-in
    // screen (the highest-leverage retention lever — the user needs to know
    // when their pact invite is accepted). Subsequent launches skip straight
    // to HabitsDashboard.
    //
    // If the user only has EMAIL_VERIFIED_MISSING_PROPERTIES (and not full
    // EMAIL_VERIFIED), HabitsDashboard is filtered out of the navigator by the
    // route-filter below (it requires AccessPresets.EMAIL_VERIFIED), and the
    // reset would silently fail with a "RESET was not handled" warning while
    // the user lands on whichever fallback route their access level allows.
    // Route them to CreateProfile instead so they can complete their profile
    // and self-upgrade to EMAIL_VERIFIED.
    resetToHabitsLanding = async () => {
        if (!isUserEmailVerified(this.props.user)) {
            this.resetToRouteIfNeeded('CreateProfile');
            return;
        }
        let optInShown = 'true';
        try {
            optInShown = (await AsyncStorage.getItem('HABITS_PUSH_OPTIN_SHOWN')) || '';
        } catch {
            // best-effort — fall through to dashboard if AsyncStorage is broken
            optInShown = 'true';
        }
        const target = optInShown ? 'HabitsDashboard' : 'HabitsPushOptIn';
        this.resetToRouteIfNeeded(target);
    };

    /**
     * The navigator now mounts directly on the brand landing screen (see
     * `getBrandInitialRouteName`), so the persisted-session reset is usually a
     * no-op. Dispatching it anyway remounted the landing screen and re-ran its
     * fetches for no reason, so only reset when the stack is not already
     * exactly `[routeName]`.
     */
    resetToRouteIfNeeded = (routeName: string) => {
        const currentRouteName = RootNavigation.getCurrentRoute()?.name;
        const stackDepth = navigationRef.isReady()
            ? (navigationRef.getRootState()?.routes?.length || 0)
            : 0;

        if (currentRouteName === routeName && stackDepth <= 1) {
            return;
        }

        RootNavigation.reset({
            index: 0,
            routes: [{ name: routeName }],
        });
    };

    handleSocketReconnectAttempt = () => {
        updateSocketToken(this.props.user);
    };

    handleSocketReconnect = () => {
        if (this.props.user && this.props.user.isAuthenticated) {
            this.props.refreshConnection(this.props.user);
        }
    };

    handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState !== 'active') {
            // Keep the *first* transition away: iOS reports 'inactive' before 'background',
            // and overwriting would read as a much shorter absence than it was.
            if (this.lastBackgroundedAt === null) {
                this.lastBackgroundedAt = Date.now();
            }

            return;
        }

        const backgroundedAt = this.lastBackgroundedAt;
        this.lastBackgroundedAt = null;

        // Only a deliberate return counts. The app also goes inactive for an OS permission
        // dialog, the camera, and the share sheet — all of which are the middle of a flow the
        // user started, and the worst possible moment to interrupt with a review prompt.
        if (backgroundedAt !== null && Date.now() - backgroundedAt >= APP_REVIEW_PROMPT_MIN_AWAY_MS) {
            this.scheduleAppReviewPromptCheck(APP_REVIEW_PROMPT_FOREGROUND_DELAY_MS);
        }
    };

    /**
     * Whether this is a moment the prompt may interrupt. Everything here is a
     * "the user is busy with something else" check — eligibility itself (how engaged the
     * user is, how recently they were last asked) lives in `utilities/appReviewPrompt`.
     */
    isAppReviewPromptInterruptible = (): boolean => {
        const {
            isAppReviewPromptVisible,
            isSplashSpinnerVisible,
            permissionPrimerType,
        } = this.state;

        return this.isUserAuthenticated()
            && !isAppReviewPromptVisible
            && !isSplashSpinnerVisible
            && !permissionPrimerType
            && !this.props.user?.settings?.isTouring;
    };

    scheduleAppReviewPromptCheck = (delayMs: number) => {
        // A single pending check at a time. Foregrounding twice in quick succession (a
        // permission dialog, a share sheet) should not queue up two prompts.
        if (this.appReviewPromptTimeout) {
            return;
        }

        this.appReviewPromptTimeout = setTimeout(() => {
            this.appReviewPromptTimeout = null;
            this.checkAppReviewPrompt();
        }, delayMs);
    };

    checkAppReviewPrompt = () => {
        if (!this.isAppReviewPromptInterruptible()) {
            return;
        }

        shouldShowReviewPrompt().then((shouldShow) => {
            // Re-check: the read is async, and a permission primer or the tour may have
            // opened while it was in flight.
            if (!shouldShow || !this.isAppReviewPromptInterruptible()) {
                return;
            }

            // Stamped on display rather than on an answer, so a prompt the user swipes away
            // still starts the quiet period.
            markReviewPromptShown();
            this.setState({ isAppReviewPromptVisible: true });
            logEvent(getAnalytics(), 'app_review_prompt_shown', {
                userId: this.props.user?.details?.id,
            }).catch((err) => console.log(err));
        }).catch((err) => console.log('APP_REVIEW_PROMPT_CHECK_ERROR', err));
    };

    handleAppReviewPromptClose = (outcome: AppReviewPromptOutcome) => {
        this.setState({ isAppReviewPromptVisible: false });

        logEvent(getAnalytics(), 'app_review_prompt_closed', {
            userId: this.props.user?.details?.id,
            outcome,
        }).catch((err) => console.log(err));

        if (outcome === 'reviewRequested') {
            openStoreReviewPage().then((didOpen) => {
                // Only terminal if the store actually opened. If nothing could handle the
                // link the user never got the chance to review, so leave them askable.
                if (didOpen) {
                    markReviewPromptCompleted();
                }
            }).catch((err) => console.log('APP_REVIEW_STORE_LINK_ERROR', err));

            return;
        }

        if (outcome === 'feedbackRequested') {
            markReviewPromptDeclined();
            openSupportEmail(this.translate('modals.appReviewPrompt.emailSubject'))
                .catch((err) => console.log('APP_REVIEW_SUPPORT_LINK_ERROR', err));

            return;
        }

        if (outcome === 'declined') {
            markReviewPromptDeclined();
        }

        // 'dismissed' leaves the user eligible for a later prompt; the shown-stamp above
        // already started the quiet period.
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
        this.themeConfirmModal = buildConfirmModalStyles(themeName);
        this.themeDisclosure = buildDisclosureStyles(themeName);
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
            // Skip data fetches for features the current brand has disabled.
            // Otherwise we hit endpoints (e.g., /reactions-service/moments/active/search)
            // for content the brand never displays, generating 401/404 noise and
            // — worst case — auth-recovery cascades on a still-valid session.
            const featureFlags = getConfig().featureFlags || {};

            // Pre-load activated content
            if (featureFlags.ENABLE_MOMENTS && !content?.activeMoments?.length) {
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
            if (featureFlags.ENABLE_THOUGHTS && !content?.activeThoughts?.length) {
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
            if (featureFlags.ENABLE_EVENTS && !content?.activeEvents?.length) {
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

            if (featureFlags.ENABLE_NOTIFICATIONS) {
                beginPrefetchRequest({
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
            }

            if (featureFlags.ENABLE_ACHIEVEMENTS) {
                beginPrefetchRequest({
                    isLoadingAchievements: true,
                });
                getMyAchievements().catch((err) => {
                    console.log(err);
                }).finally(() => {
                    completePrefetchRequest({
                        isLoadingAchievements: false,
                    });
                });
            }

            if (featureFlags.ENABLE_CONNECT) {
                beginPrefetchRequest({
                    isLoadingUsers: true,
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
            }

            if (featureFlags.ENABLE_GROUPS) {
                beginPrefetchRequest({
                    isLoadingGroups: true,
                });
                getUserGroups().catch((err) => {
                    console.log(err);
                }).finally(() => {
                    completePrefetchRequest({
                        isLoadingGroups: false,
                    });
                });
            }
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
            const hasGroupEditAccess = user?.myUserGroups[payload.group.id]?.role === GroupMemberRoles.ADMIN
                || user?.details?.id === payload.group?.authorId;
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
                showToast.info({
                    text1: this.translate('forms.editGroup.archiveSuccess'),
                });
                RootNavigation.navigate('Groups', {
                    activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
                });
            }).catch(() =>{
                showToast.error({
                    text1: this.translate('forms.editGroup.backendErrorMessage'),
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
                showToast.success({
                    text1: this.translate('alertTitles.exitedGroup'),
                });
            }).catch(() => {
                showToast.error({
                    text1: this.translate('forms.editGroup.backendErrorMessage'),
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
                showToast.success({
                    text1: this.translate('alertTitles.joinedGroup'),
                });
            }).catch(() => {
                showToast.error({
                    text1: this.translate('forms.editGroup.backendErrorMessage'),
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
            const locale = this.props.user?.settings?.locale || 'en-us';
            Clipboard.setString(buildGroupUrl(locale, group.id));

        }

        SheetManager.hide('group-sheet');
    };

    onPressUpdatedConnectionType = (userId: string, type: 1 | 2 | 3 | 4 | 5) => {
        const { updateUserConnectionType } = this.props;
        const route = RootNavigation.getCurrentRoute();
        if (route?.name === 'ViewUser') {
            updateUserConnectionType(userId, type).then(() => {
                showToast.success({
                    text1: this.translate('alertTitles.updated'),
                });
            }).catch(() => {
                showToast.error({
                    text1: this.translate('alertTitles.backendErrorMessage'),
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
        if (data && !Array.isArray(data) && typeof (data) === 'object') {
            // Each native build only declares its own brand's intent filters,
            // so the action string we receive will already be brand-scoped.
            // Pick the matching enum so Teem/Habits taps route correctly when
            // running on those brand binaries.
            const brandIntents = CURRENT_BRAND_VARIATION === BrandVariations.HABITS
                ? PushNotifications.AndroidIntentActions.Habits
                : CURRENT_BRAND_VARIATION === BrandVariations.TEEM
                    ? PushNotifications.AndroidIntentActions.Teem
                    : PushNotifications.AndroidIntentActions.Therr;

            // The HABITS-only keys (PACT_*, PARTNER_*, STREAK_*,
            // DAILY_HABIT_REMINDER, MORNING_MOTIVATION, EVENING_CHECK_IN) exist
            // on HabitsAndroidIntentActions and on neither of the other two, so
            // reading them off the union is a compile error even though the
            // comparison is exactly what we want at runtime: on a Therr binary
            // the lookup is `undefined` and no habits branch can match, which is
            // correct — that build declares no habits intent filters, so the
            // action string can never arrive.
            //
            // `?? '\u0000'` rather than `undefined` so an FCM payload with no
            // `action` cannot accidentally equal a missing key.
            const brandIntent = (key: string): string => (brandIntents as Record<string, string | undefined>)[key] ?? '\u0000';

            // Intent extras arrive as strings and are absent unless the backend
            // put them in the FCM data map.
            const intentData = data as Record<string, any>;
            const intentPactId = typeof intentData.pactId === 'string' && intentData.pactId ? intentData.pactId : undefined;
            const intentHabitGoalId = typeof intentData.habitGoalId === 'string' && intentData.habitGoalId
                ? intentData.habitGoalId
                : undefined;

            if (data.action === brandIntents.ACHIEVEMENT_COMPLETED
                || data.action === brandIntents.UNCLAIMED_ACHIEVEMENTS_REMINDER) {
                targetRouteView = 'Achievements';
            } else if (data.action === brandIntents.CREATE_A_MOMENT_REMINDER) {
                targetRouteView = 'Map';
            } else if (data.action === brandIntents.CREATE_YOUR_PROFILE_REMINDER) {
                targetRouteView = 'ManageAccount';
            } else if (data.action === brandIntents.COMPLETE_DRAFT_REMINDER) {
                targetRouteView = 'MyDrafts';
            } else if (data.action === brandIntents.LATEST_POST_LIKES_STATS
                || data.action === brandIntents.LATEST_POST_VIEWCOUNT_STATS) {
                // Author's own post stats — open their profile so they can
                // see the affected post in the user's content carousel.
                targetRouteView = 'ViewUser';
                if (user?.details?.id) {
                    targetRouteParams = { userInView: { id: user.details.id } };
                }
            } else if (data.action === brandIntents.UNREAD_NOTIFICATIONS_REMINDER) {
                targetRouteView = 'Notifications';
            } else if (data.action === brandIntents.INVITE_FRIENDS_REMINDER) {
                targetRouteView = 'Invite';
            } else if (data.action === brandIntents.NEW_AREAS_ACTIVATED) {
                targetRouteView = 'Areas';
            } else if (data.action === brandIntents.NEW_GROUP_INVITE
                || data.action === brandIntents.NEW_GROUP_MEMBERS) {
                targetRouteView = 'Groups';
                targetRouteParams = {
                    activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
                };
            } else if (data.action === brandIntents.NEW_GROUP_MESSAGE) {
                targetRouteView = 'Groups';
                targetRouteParams = {
                    activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
                };
            } else if (data.action === brandIntents.NEW_DIRECT_MESSAGE) {
                // Without the conversation's other-user-id we can only land
                // on the messaging hub; the per-thread navigation happens via
                // the data-only path on Notifee/handleRemoteMessageTap.
                targetRouteView = 'Notifications';
            } else if (data.action === brandIntents.NEW_CONNECTION
                || data.action === brandIntents.NEW_CONNECTION_REQUEST) {
                targetRouteView = 'Connect';
            } else if (data.action === brandIntents.NEW_LIKE_RECEIVED
                || data.action === brandIntents.NEW_SUPER_LIKE_RECEIVED
                || data.action === brandIntents.NEW_THOUGHT_REPLY_RECEIVED
                || data.action === brandIntents.NEW_THOUGHT_REPOST_RECEIVED) {
                targetRouteView = 'Notifications';
            } else if (data.action === brandIntents.NUDGE_SPACE_ENGAGEMENT) {
                targetRouteView = 'Areas';
            } else if (data.action === brandIntents.POST_VISIT_REVIEW_REMINDER) {
                targetRouteView = 'BookMarked';
            } else if (data.action === brandIntents.REPORT_CONFIRMED) {
                targetRouteView = 'Notifications';
            } else if (data.action === brandIntent('PACT_INVITATION')
                || data.action === brandIntent('PACT_NUDGE')) {
                targetRouteView = 'HabitsDashboard';
                targetRouteParams = { initialTab: 'pending' };
            } else if (data.action === brandIntent('PACT_ACCEPTED')
                || data.action === brandIntent('PACT_DECLINED')
                || data.action === brandIntent('PACT_COMPLETED')
                || data.action === brandIntent('PACT_EXPIRING')
                || data.action === brandIntent('PARTNER_CHECKED_IN')
                || data.action === brandIntent('PARTNER_MISSED_DAY')
                || data.action === brandIntent('PARTNER_CELEBRATED')) {
                // The manifest has declared every one of these actions since the
                // habits work landed, but none of them were compared here — so
                // `targetRouteView` stayed '' and the `else if (targetRouteView)`
                // below was falsy: tapping a habits notification on the Android
                // intent path navigated nowhere at all.
                //
                // `data.pactId` reaches the intent extras only when the backend
                // put it in the FCM data map, which it now does; without it the
                // dashboard is the honest destination.
                targetRouteView = intentPactId ? 'PactDetail' : 'HabitsDashboard';
                targetRouteParams = intentPactId ? { pactId: intentPactId } : {};
            } else if (data.action === brandIntent('STREAK_AT_RISK')
                || data.action === brandIntent('DAILY_HABIT_REMINDER')
                || data.action === brandIntent('MORNING_MOTIVATION')
                || data.action === brandIntent('EVENING_CHECK_IN')) {
                targetRouteView = intentHabitGoalId ? 'HabitDetail' : 'HabitsDashboard';
                targetRouteParams = intentHabitGoalId
                    ? { habitGoalId: intentHabitGoalId }
                    : { initialTab: 'habits' };
            } else if (data.action === brandIntent('STREAK_MILESTONE')
                || data.action === brandIntent('STREAK_BROKEN')
                || data.action === brandIntent('NEW_PERSONAL_RECORD')) {
                targetRouteView = intentHabitGoalId ? 'HabitDetail' : 'MyHabits';
                targetRouteParams = intentHabitGoalId ? { habitGoalId: intentHabitGoalId } : {};
            } else if (data.action?.endsWith(QUICK_ACTION_SUFFIXES.CREATE_MOMENT)) {
                // App-shortcut: jump straight into moment creation. EditMoment
                // destructures route.params (and calls nearbySpaces.find), so we
                // must pass a non-empty param object. Seed the location from the
                // user's last-known coords, matching the in-app create button.
                targetRouteView = 'EditMoment';
                targetRouteParams = {
                    imageDetails: {},
                    nearbySpaces: [],
                    latitude: user?.details?.lastKnownLatitude,
                    longitude: user?.details?.lastKnownLongitude,
                };
            } else if (data.action?.endsWith(QUICK_ACTION_SUFFIXES.CREATE_THOUGHT)) {
                // App-shortcut: jump straight into thought creation (no location).
                targetRouteView = 'EditThought';
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
     * Maps a PushNotifications.Types value (carried in `data.type` on every
     * FCM payload — see push-notifications-service createMessage) to a route.
     *
     * Used as the universal fallback in handleNotifeeNotificationEvent so
     * notifications that lack a notificationPressActionId still land on a
     * sensible screen instead of dropping the user on the launch view. This
     * matters most for:
     *  - iOS APNs alert taps (createNotificationMessage payloads have no
     *    notificationPressActionId, so handleRemoteMessageTap synthesizes
     *    `default` and falls through every press-action branch).
     *  - Android FCM-rendered notifications with no clickAction / unmatched
     *    intent action.
     *  - Brand variants whose intent strings don't match the legacy
     *    handleFirebasePushNotificationEvent checks.
     */
    getRouteFromNotificationType = (
        notificationType: string | undefined,
        data: { [key: string]: any } | undefined,
    ): { targetRouteView: string; targetRouteParams: any } | null => {
        if (!notificationType) {
            return null;
        }

        const { user } = this.props;
        const currentUserId = user?.details?.id;

        // Object payloads are JSON-stringified by the backend
        // (push-notifications-service firebaseAdmin.ts createMessage), so
        // parse here defensively rather than assuming a type.
        const parseObject = (key: string): any => {
            const value = data?.[key];
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch {
                    return null;
                }
            }
            if (typeof value === 'object' && value !== null) {
                return value;
            }
            return null;
        };

        const area = parseObject('area');
        const fromUser = parseObject('fromUser');
        const thought = parseObject('thought');
        const groupId = typeof data?.groupId === 'string' ? data.groupId : undefined;
        const postType = typeof data?.postType === 'string' ? data.postType : undefined;
        // HABITS routing ids. The backend promotes these out of the copy config
        // into the FCM data map (push-notifications-service firebaseAdmin.ts) —
        // before that they were carried all the way from the producer, used to
        // render the body, and dropped, which is why every habits notification
        // could only ever open a list.
        //
        // `habitGoalId` is present only when the notification names exactly one
        // habit: the digest rolls a user's whole day into one nudge, and a
        // roll-up covering three habits has no single habit to open.
        const habitGoalId = typeof data?.habitGoalId === 'string' && data.habitGoalId ? data.habitGoalId : undefined;
        const pactId = typeof data?.pactId === 'string' && data.pactId ? data.pactId : undefined;

        // Falls back to the dashboard rather than to the in-app Notifications
        // list. That list has no habits rows at all — `Notifications.Types`
        // (therr-js-utilities) declares none — so routing there was a dead end
        // that looked like a broken notification.
        const buildPactRoute = () => (pactId
            ? { targetRouteView: 'PactDetail', targetRouteParams: { pactId } }
            : { targetRouteView: 'HabitsDashboard', targetRouteParams: {} });

        const buildHabitRoute = (initialTab?: string) => (habitGoalId
            ? { targetRouteView: 'HabitDetail', targetRouteParams: { habitGoalId } }
            : { targetRouteView: 'HabitsDashboard', targetRouteParams: initialTab ? { initialTab } : {} });

        const buildMomentRoute = (m: any) => ({
            targetRouteView: 'ViewMoment',
            targetRouteParams: {
                isMyContent: m?.fromUserId === currentUserId,
                previousView: 'Map',
                moment: { id: m.id },
                momentDetails: m,
            },
        });
        const buildSpaceRoute = (s: any) => ({
            targetRouteView: 'ViewSpace',
            targetRouteParams: {
                isMyContent: s?.fromUserId === currentUserId,
                previousView: 'Map',
                space: { id: s.id },
                spaceDetails: s,
            },
        });
        const buildThoughtRoute = (t: any) => ({
            targetRouteView: 'ViewThought',
            targetRouteParams: {
                isMyContent: t?.fromUserId === currentUserId,
                previousView: 'Map',
                thought: { id: t.id },
                thoughtDetails: t,
            },
        });

        switch (notificationType) {
            // Automation reminders
            case PushNotifications.Types.createYourProfileReminder:
                return { targetRouteView: 'ManageAccount', targetRouteParams: {} };
            case PushNotifications.Types.createAMomentReminder:
                return { targetRouteView: 'Map', targetRouteParams: {} };
            case PushNotifications.Types.completeDraftReminder:
                return { targetRouteView: 'MyDrafts', targetRouteParams: {} };
            case PushNotifications.Types.latestPostLikesStats:
                if (currentUserId) {
                    return { targetRouteView: 'ViewUser', targetRouteParams: { userInView: { id: currentUserId } } };
                }
                return { targetRouteView: 'Notifications', targetRouteParams: {} };
            case PushNotifications.Types.latestPostViewcountStats:
                if (area?.id) return buildMomentRoute(area);
                if (currentUserId) {
                    return { targetRouteView: 'ViewUser', targetRouteParams: { userInView: { id: currentUserId } } };
                }
                return { targetRouteView: 'Notifications', targetRouteParams: {} };
            case PushNotifications.Types.unreadNotificationsReminder:
                return { targetRouteView: 'Notifications', targetRouteParams: {} };
            case PushNotifications.Types.unclaimedAchievementsReminder:
                return { targetRouteView: 'Achievements', targetRouteParams: {} };
            case PushNotifications.Types.inviteFriendsReminder:
                return { targetRouteView: 'Invite', targetRouteParams: {} };

            // Event-driven
            case PushNotifications.Types.achievementCompleted:
                return { targetRouteView: 'Achievements', targetRouteParams: {} };
            case PushNotifications.Types.connectionRequestAccepted:
            case PushNotifications.Types.newConnectionRequest:
                if (fromUser?.id) {
                    return { targetRouteView: 'ViewUser', targetRouteParams: { userInView: { id: fromUser.id } } };
                }
                return { targetRouteView: 'Connect', targetRouteParams: {} };
            case PushNotifications.Types.newDirectMessage:
                if (fromUser?.id) {
                    return {
                        targetRouteView: 'DirectMessage',
                        targetRouteParams: {
                            connectionDetails: { id: fromUser.id, userName: fromUser.userName },
                        },
                    };
                }
                return { targetRouteView: 'Notifications', targetRouteParams: {} };
            case PushNotifications.Types.newGroupInvite:
            case PushNotifications.Types.newGroupMembers:
                return {
                    targetRouteView: 'Groups',
                    targetRouteParams: { activeTab: GROUPS_CAROUSEL_TABS.GROUPS },
                };
            case PushNotifications.Types.newGroupMessage:
                if (groupId) {
                    return {
                        targetRouteView: 'ViewGroup',
                        targetRouteParams: { activeTab: GROUP_CAROUSEL_TABS.CHAT, id: groupId },
                    };
                }
                return {
                    targetRouteView: 'Groups',
                    targetRouteParams: { activeTab: GROUPS_CAROUSEL_TABS.GROUPS },
                };
            case PushNotifications.Types.newLikeReceived:
            case PushNotifications.Types.newSuperLikeReceived:
                if (postType === 'thoughts' && thought?.id) return buildThoughtRoute(thought);
                if (area?.id) {
                    if (postType === 'moments') return buildMomentRoute(area);
                    return buildSpaceRoute(area);
                }
                return { targetRouteView: 'Notifications', targetRouteParams: {} };
            case PushNotifications.Types.newAreasActivated:
                return { targetRouteView: 'Areas', targetRouteParams: {} };
            case PushNotifications.Types.nudgeSpaceEngagement:
                if (area?.id) return buildSpaceRoute(area);
                return { targetRouteView: 'Areas', targetRouteParams: {} };
            case PushNotifications.Types.proximityRequiredMoment:
                if (area?.id) return buildMomentRoute(area);
                return { targetRouteView: 'Map', targetRouteParams: {} };
            case PushNotifications.Types.proximityRequiredSpace:
                if (area?.id) return buildSpaceRoute(area);
                return { targetRouteView: 'Map', targetRouteParams: {} };
            case PushNotifications.Types.newThoughtReplyReceived:
            case PushNotifications.Types.newThoughtRepostReceived:
                if (thought?.id) return buildThoughtRoute(thought);
                return { targetRouteView: 'Notifications', targetRouteParams: {} };
            case PushNotifications.Types.postVisitReviewReminder:
                if (area?.id) return buildSpaceRoute(area);
                return { targetRouteView: 'BookMarked', targetRouteParams: {} };
            case PushNotifications.Types.reportConfirmed:
                return { targetRouteView: 'Notifications', targetRouteParams: {} };

            // HABITS pact / streak / partner / habit-reminder notifications.
            case PushNotifications.Types.pactInvitation:
                return { targetRouteView: 'HabitsDashboard', targetRouteParams: { initialTab: 'pending' } };

            case PushNotifications.Types.pactNudge:
                return { targetRouteView: 'HabitsDashboard', targetRouteParams: { initialTab: 'pending' } };

            // Pact state and partner activity — the pact is the subject, so the
            // pact is the destination.
            case PushNotifications.Types.pactAccepted:
            case PushNotifications.Types.pactDeclined:
            case PushNotifications.Types.pactCompleted:
            case PushNotifications.Types.pactExpiring:
            case PushNotifications.Types.pactEnded:
            case PushNotifications.Types.partnerCheckedIn:
            case PushNotifications.Types.partnerMissedDay:
            case PushNotifications.Types.partnerCelebrated:
                return buildPactRoute();

            // Anything asking the user to check in opens the habit itself, with
            // the dashboard's habits segment when it cannot name one — that is
            // the segment listing the habits the user can check in on.
            case PushNotifications.Types.streakAtRisk:
            case PushNotifications.Types.dailyHabitReminder:
            case PushNotifications.Types.morningMotivation:
            case PushNotifications.Types.eveningCheckIn:
            case PushNotifications.Types.habitMaintenanceCheckIn:
            case PushNotifications.Types.habitComeback:
                return buildHabitRoute('habits');

            // Celebrations and lifecycle milestones
            // (docs/HABIT_LIFECYCLE_MESSAGING.md). The habit's own history is
            // what the copy refers to; MyHabits is the fallback because a
            // milestone with no habit id is still about the user's habits.
            case PushNotifications.Types.streakMilestone:
            case PushNotifications.Types.streakBroken:
            case PushNotifications.Types.newPersonalRecord:
            case PushNotifications.Types.habitEstablished:
            case PushNotifications.Types.habitAutomaticity:
                return habitGoalId
                    ? { targetRouteView: 'HabitDetail', targetRouteParams: { habitGoalId } }
                    : { targetRouteView: 'MyHabits', targetRouteParams: {} };

            default:
                return null;
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
                    'notification.id': notification?.id || '',
                    'notification.pressAction.id': pressAction?.id || '',
                    'notification.isInForeground': String(isInForeground),
                    'notification.eventType': String(type),
                    'notification.didCauseAppOpen': String(didCauseAppOpen),
                    'notification.isUserAuthorized': String(isUserAuthorized),
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
                    const parseIds = (raw: unknown): string[] => {
                        if (Array.isArray(raw)) {
                            return raw as string[];
                        }
                        if (typeof raw === 'string' && raw.length) {
                            try {
                                const parsed = JSON.parse(raw);
                                return Array.isArray(parsed) ? parsed : [];
                            } catch {
                                return [];
                            }
                        }
                        return [];
                    };
                    const activatedMomentIds = parseIds(notification?.data?.activatedMomentIds);
                    const activatedSpaceIds = parseIds(notification?.data?.activatedSpaceIds);
                    if (activatedMomentIds.length || activatedSpaceIds.length) {
                        RootNavigation.navigate('ActivatedAreas', {
                            activatedMomentIds,
                            activatedSpaceIds,
                        });
                    } else {
                        RootNavigation.navigate('Nearby');
                    }
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

            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.leaderboardView) {
                if (!isUserAuthorized) {
                    this.setState({
                        targetRouteView: 'Leaderboard',
                        targetRouteParams: {},
                    });

                    return Promise.resolve();
                }

                RootNavigation.navigate('Leaderboard');
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
                        showToast.success({
                            text1: this.translate('alertTitles.connectionAccepted'),
                        });
                    }).catch(() => {
                        showToast.error({
                            text1: this.translate('alertTitles.backendErrorMessage'),
                        });
                    }).finally(() => {
                        RootNavigation.navigate('ViewUser', routeParams);
                    });
                }
                return Promise.resolve();
            }

            // HABITS action buttons.
            //
            // Before this, none of the four habits PressActionIds had a branch
            // here at all: the backend has been stamping `pactView` /
            // `pactAccept` / `checkinView` / `streakView` on every habits push
            // since they shipped, and every one of them fell through to the
            // type fallback below, which sent the user to the in-app
            // Notifications list — a screen with no habits rows in it.
            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.habitCheckin) {
                // The killed-app case is handled by notifee.onBackgroundEvent in
                // TherrMobile/index.js, which completes the check-in without
                // opening the app. This branch is the warm path (foreground, or
                // a background event while the tree is alive), where using the
                // normal redux action keeps the dashboard in sync rather than
                // leaving it showing an un-checked-in habit.
                const checkinHabitGoalId = typeof notification?.data?.habitGoalId === 'string'
                    ? notification.data.habitGoalId
                    : undefined;
                const checkinPactId = typeof notification?.data?.pactId === 'string'
                    ? notification.data.pactId
                    : undefined;

                if (!isUserAuthorized || !checkinHabitGoalId) {
                    this.setState({
                        targetRouteView: 'HabitsDashboard',
                        targetRouteParams: { initialTab: 'habits' },
                    });
                    return Promise.resolve();
                }

                return this.props.createCheckin({
                    habitGoalId: checkinHabitGoalId,
                    ...(checkinPactId ? { pactId: checkinPactId } : {}),
                    status: 'completed',
                }).then(() => {
                    showToast.success({
                        text1: this.translate('alertTitles.checkinSucceeded'),
                        text2: this.translate('alertMessages.checkinSucceeded'),
                    });
                }).catch(() => {
                    // Falls through to the habit rather than only toasting: the
                    // press already dismissed the notification, so an error with
                    // no destination leaves the user with nothing to act on.
                    showToast.error({
                        text1: this.translate('alertTitles.checkinFailed'),
                    });
                    RootNavigation.navigate('HabitDetail', { habitGoalId: checkinHabitGoalId });
                });
            }

            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.pactAccept) {
                const acceptPactId = typeof notification?.data?.pactId === 'string'
                    ? notification.data.pactId
                    : undefined;

                if (!acceptPactId) {
                    this.setState({
                        targetRouteView: 'HabitsDashboard',
                        targetRouteParams: { initialTab: 'pending' },
                    });
                    return Promise.resolve();
                }

                const pactRouteParams = { pactId: acceptPactId };

                if (!isUserAuthorized) {
                    this.setState({
                        targetRouteView: 'PactDetail',
                        targetRouteParams: pactRouteParams,
                    });
                    return Promise.resolve();
                }

                // Mirrors the connection-request branch above: mutate, report,
                // then land the user on the thing they just acted on either way.
                return this.props.acceptPact(acceptPactId).then(() => {
                    showToast.success({
                        text1: this.translate('alertTitles.pactAccepted'),
                    });
                }).catch(() => {
                    showToast.error({
                        text1: this.translate('alertTitles.backendErrorMessage'),
                    });
                }).finally(() => {
                    RootNavigation.navigate('PactDetail', pactRouteParams);
                });
            }

            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.pactRenew) {
                // "Start New Cycle" on the `pactEnded` push. Without this branch
                // the id falls through to the type fallback below, which routes
                // to the pact — so the button renders, opens the pact, and
                // renews nothing, behaving identically to the "View" button
                // beside it. Nothing reports that: the press dismisses the
                // notification and the user is left on a screen that looks right.
                const renewPactId = typeof notification?.data?.pactId === 'string'
                    ? notification.data.pactId
                    : undefined;
                // Display-only, and the server re-reads the real value when it
                // renews — so a missing or stale one costs the toast its number,
                // never the cycle its length.
                const renewDurationDays = Number(notification?.data?.durationDays) || 0;

                if (!renewPactId) {
                    // 'all' rather than 'habits': the notification is about a
                    // pact, and 'all' is the segment that lists finished ones.
                    // (`normalizeInitialTab` silently falls back to 'habits' for
                    // any unrecognised value, so a wrong name here would not
                    // error — it would just quietly land on the wrong list.)
                    this.setState({
                        targetRouteView: 'HabitsDashboard',
                        targetRouteParams: { initialTab: 'all' },
                    });
                    return Promise.resolve();
                }

                const renewRouteParams = { pactId: renewPactId };

                if (!isUserAuthorized) {
                    this.setState({
                        targetRouteView: 'PactDetail',
                        targetRouteParams: renewRouteParams,
                    });
                    return Promise.resolve();
                }

                // No duration override, matching the dashboard CTA: the evidence
                // behind renewal measures the *fixed cycle*, not its length, so
                // `renewPact` reuses the previous cycle's `durationDays`. The
                // renewal is a new pact rather than a mutation, so the streak in
                // `habits.streaks` carries across the boundary untouched.
                // Reuses the dashboard CTA's strings rather than adding a second
                // set: the two entry points renew the same thing, and copy that
                // drifts between them is copy a user can catch us on.
                return this.props.renewPact(renewPactId).then(() => {
                    showToast.success({
                        text1: this.translate('pages.pacts.renew.successTitle'),
                        text2: renewDurationDays
                            ? this.translate('pages.pacts.renew.successMessage', { days: renewDurationDays })
                            : undefined,
                    });
                }).catch((error: any) => {
                    // The server re-checks renewability and 409s a stale CTA —
                    // most often because a partner already renewed, leaving a
                    // live cycle on the habit. That body is localized and names
                    // the real reason, and the axios interceptor rejects with it
                    // verbatim (hence `error.message`, not `error.response.data`).
                    // A rejection carrying no `statusCode` never reached the API.
                    const apiMessage = error?.statusCode && typeof error?.message === 'string'
                        ? error.message
                        : '';

                    showToast.error({
                        text1: this.translate('pages.pacts.errorTitle'),
                        text2: apiMessage || this.translate('pages.pacts.renew.error'),
                    });
                }).finally(() => {
                    // Land on the pact either way. A renewal that succeeded has
                    // a new cycle to show, and one that failed needs somewhere
                    // to act — the press already dismissed the notification.
                    RootNavigation.navigate('PactDetail', renewRouteParams);
                });
            }

            if (notification?.id
                && (pressAction?.id === PushNotifications.PressActionIds.pactView
                    || pressAction?.id === PushNotifications.PressActionIds.checkinView
                    || pressAction?.id === PushNotifications.PressActionIds.streakView)) {
                // Navigation only — the destination is exactly what the type
                // fallback resolves, so reuse it rather than restating the
                // habit/pact/dashboard precedence in a second place.
                const habitsRoute = this.getRouteFromNotificationType(
                    typeof notification?.data?.type === 'string' ? notification.data.type : undefined,
                    notification?.data,
                );

                if (habitsRoute) {
                    if (!isUserAuthorized) {
                        this.setState(habitsRoute);
                        return Promise.resolve();
                    }
                    RootNavigation.navigate(habitsRoute.targetRouteView, habitsRoute.targetRouteParams);
                }
                return Promise.resolve();
            }

            if (notification?.id && pressAction?.id === PushNotifications.PressActionIds.discovered) {
                return Promise.resolve();
            }

            // Fallback: route by notification type when no specific press
            // action matched. This catches:
            //  - iOS APNs alert taps for createNotificationMessage payloads
            //    (no notificationPressActionId is set on the data, so
            //    handleRemoteMessageTap synthesizes a `default` press action).
            //  - Android FCM notification-payload taps with no clickAction
            //    or whose intent action wasn't matched in
            //    handleFirebasePushNotificationEvent.
            //  - HABITS / future notification types whose press-action ids
            //    aren't yet wired up above.
            // Without this, taps in those scenarios silently leave the user
            // on the launch screen with no navigation.
            const notificationType = typeof notification?.data?.type === 'string'
                ? notification.data.type
                : undefined;
            const fallbackRoute = this.getRouteFromNotificationType(notificationType, notification?.data);
            if (fallbackRoute) {
                if (!isUserAuthorized) {
                    this.setState({
                        targetRouteView: fallbackRoute.targetRouteView,
                        targetRouteParams: fallbackRoute.targetRouteParams,
                    });
                    return Promise.resolve();
                }
                RootNavigation.navigate(fallbackRoute.targetRouteView, fallbackRoute.targetRouteParams);
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
     * On iOS, data-only pushes now arrive as APNS alerts (see
     * push-notifications-service createDataOnlyMessage). When the OS renders
     * the alert and the user taps it, the tap comes through the Firebase
     * messaging module — NOT Notifee — so we normalize the FCM RemoteMessage
     * into the same event shape that handleNotifeeNotificationEvent expects
     * and reuse all the existing routing logic.
     */
    handleRemoteMessageTap = (remoteMessage: any) => {
        if (!remoteMessage?.data) {
            return;
        }
        const fakeEvent: any = {
            type: EventType.PRESS,
            detail: {
                notification: {
                    title: remoteMessage.data.notificationTitle?.toString?.() || '',
                    body: remoteMessage.data.notificationBody?.toString?.() || '',
                    data: remoteMessage.data,
                },
                pressAction: {
                    id: remoteMessage.data.notificationPressActionId?.toString?.()
                        || PushNotifications.PressActionIds.default,
                },
            },
        };
        this.handleNotifeeNotificationEvent(fakeEvent as Event, false, true);
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
        const claimPactRegex = RegExp('claim-pact/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})', 'i');
        const viewMomentRegex = RegExp('moments/[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}/view', 'i');
        const viewMomentFromDesktopRegex = RegExp('moments/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})', 'i');
        const viewSpaceRegex = RegExp('spaces/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})/view', 'i');
        const viewSpaceFromDesktopRegex = RegExp('spaces/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})', 'i');
        const viewUserRegex = RegExp('users/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})/view', 'i');
        const viewUserFromDesktopRegex = RegExp('users/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})', 'i');
        const viewEventRegex = RegExp('events/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})', 'i');
        const viewGroupRegex = RegExp('groups/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})', 'i');
        const viewPublicListRegex = RegExp('lists/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})/([a-z0-9-]+)', 'i');
        const inviteLinkRegex = RegExp('invite/link/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})', 'i');
        const isUserLoggedIn = isUserAuthenticated(user);
        const isUserMissingProps = UsersService.isAuthorized(
            {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            },
            user
        );
        const isEmailVerified = UsersService.isAuthorized(
            {
                type: AccessCheckType.ANY,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            },
            user
        );

        if (url?.match(claimPactRegex)) {
            // Cross-app pact invite. The email/SMS sent by users-service points
            // here; on tap we either claim immediately (authed) or stash the
            // token for the post-login drain (unauthed first launch).
            const claimToken = (url.match(claimPactRegex) || [])[1];
            if (claimToken) {
                if (isUserLoggedIn && !isUserMissingProps) {
                    axios.post('/users-service/habits/pacts/claim', { token: claimToken })
                        .then(() => {
                            this.props.getActivePacts();
                            RootNavigation.navigate('Notifications');
                        })
                        .catch((err) => {
                            console.log('PACT_CLAIM_ERROR', err?.message);
                            RootNavigation.navigate('Notifications');
                        });
                } else {
                    AsyncStorage.setItem('pendingPactClaimToken', claimToken).catch((err) => {
                        console.log('PACT_CLAIM_STORE_ERROR', err?.message);
                    });
                    this.setState({
                        targetRouteView: 'Notifications',
                    });
                }
            }
        } else if (url?.includes('therr.com/?access_token=')) {
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
                if (!isUserLoggedIn && !isEmailVerified) {
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
        } else if (url?.includes('therr.com/api-access') || url?.includes('therr.com/api-keys')) {
            // therr.com is an auto-verified App Link, so the marketing site's "Get an API key"
            // CTA opens this app instead of the browser. Without this branch it fell through
            // to handleOpenByNotifeeNotification and the user hit a dead end. The screen is
            // public, so route signed-out users there too rather than deferring to targetRouteView.
            // '/api-keys' is matched as well because older marketing links still point at it.
            RootNavigation.navigate('ApiAccess');
        } else if (url?.includes('therr.com/verify-phone')) {
            // Phone verification lives only inside the CreateProfile stack, so anything that
            // needs to send a user there — the bulk-invite 403, the profile checklist, an
            // email or SMS nudge — points at this URL. The web page at the same path is the
            // fallback for users without the app, and it verifies through the same endpoints.
            // Signed-out users cannot verify anything, so defer via targetRouteView and let
            // them land here after login rather than bouncing them to a screen that 401s.
            if (isUserLoggedIn) {
                RootNavigation.navigate('CreateProfile', { stage: 'phone' });
            } else {
                this.setState({
                    targetRouteView: 'CreateProfile',
                    targetRouteParams: { stage: 'phone' },
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
        } else if (url?.match(inviteLinkRegex)) {
            // Magic invite link: send unauthenticated users to a pre-filled
            // signup (Register fetches the invite details from the token).
            // Already-authenticated users have an account, so ignore.
            const inviteToken = url.match(inviteLinkRegex)[1];
            if (!isUserLoggedIn) {
                RootNavigation.navigate('Register', { inviteToken });
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
            const queryParams = qs.parse(urlSplit[1] || '');
            const shouldTriggerCheckIn = queryParams.checkin === 'true';
            let targetRouteParams: any = {};
            if (spaceId) {
                targetRouteParams = {
                    space: {
                        id: spaceId,
                    },
                    shouldTriggerCheckIn,
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
        } else if (url?.match(viewPublicListRegex)) {
            // Public shareable list. For the owner, open MyLists so they can
            // navigate into their own editable list. For other viewers the
            // web page at this URL is the read-only experience; we don't yet
            // render other users' lists inside the app, so fall back to
            // opening MyLists for authed users / the Home route otherwise.
            // A dedicated in-app viewer is intentionally deferred to Phase 2.
            if (isUserLoggedIn && !isUserMissingProps) {
                RootNavigation.navigate('MyLists');
            } else {
                this.setState({ targetRouteView: 'MyLists' });
            }
        } else if (Platform.OS !== 'ios') {
            // IOS will use the notifee foreground listener instead
            this.handleOpenByNotifeeNotification();
        }
    };

    tryRegisterDeviceTokenIfAuthorized = async () => {
        try {
            const status = await hasPermission(getMessaging());
            const authorized = status === AuthorizationStatus.AUTHORIZED
                || status === AuthorizationStatus.PROVISIONAL;
            if (!authorized) return;
            this.registerDeviceForFCM();
        } catch (err) {
            console.log('NOTIFICATIONS_HAS_PERMISSION_ERROR', err);
        }
    };

    registerDeviceForFCM = () => {
        const {
            addNotification,
            location,
            searchActiveMomentsByIds,
            searchActiveSpacesByIds,
            user,
            updateUser,
        } = this.props;
        // Avoid double-subscribing. The token chain is async so the
        // `unsubscribePushNotifications` ref is only set once getToken resolves;
        // the synchronous flag closes the race when two callers (e.g. login
        // transition + orchestrator's onGranted) trigger registration in the
        // same tick.
        if (this.fcmRegistrationStarted) return;
        this.fcmRegistrationStarted = true;
        registerDeviceForRemoteMessages(getMessaging())
            .then(() => getToken(getMessaging()))
            .then((deviceToken) => {
                axios.defaults.headers['x-user-device-token'] = deviceToken;
                // Register unconditionally. This was guarded on
                // `user.details.deviceMobileFirebaseToken !== deviceToken`, but that value is
                // the legacy *shared* users.deviceMobileFirebaseToken column, which every
                // branded app on the device overwrites in turn — so it says nothing about
                // whether THIS brand is registered. `updateUser` is the only path that writes
                // the brand-scoped main.userDeviceTokens row (via syncDeviceTokenForBrand), so
                // whenever the shared column already held this app's token the guard skipped
                // the call and the row was never written at all. Routing then fell back to the
                // shared column and delivered this brand's pushes to whichever app registered
                // last — a Friends with Habits streak reminder arriving in Therr. The value is
                // also never written back into Redux, and the `user` slice is redux-persisted,
                // so a stale snapshot suppressed re-registration across app updates.
                //
                // `fcmRegistrationStarted` above already limits this to one call per app
                // session, and the server-side upsert is idempotent.
                //
                // The device's IANA timezone rides along on the same call.
                // `main.users.settingsTimezone` has existed since the habits schema
                // landed and nothing has ever written it, which is why every scheduled
                // notification went out at one global hour — evening in America/Chicago
                // and 02:00 in Auckland. Reporting it here rather than through a new
                // endpoint is deliberate: this is already the one call that happens once
                // per app session on the push path, so a user who travels re-syncs the
                // next time they open the app, and a user with push disabled — who
                // cannot receive a scheduled reminder anyway — costs nothing.
                //
                // Sent only when the platform resolves a zone. The server rejects an
                // unrecognised value with a 400, so passing `undefined` through on the
                // rare device where `Intl` returns nothing would fail the device-token
                // registration this call actually exists for.
                const deviceTimeZone = getDeviceTimeZone();
                updateUser(user.details.id, {
                    deviceMobileFirebaseToken: deviceToken,
                    ...(deviceTimeZone ? { settingsTimezone: deviceTimeZone } : {}),
                });
                this.unsubscribePushNotifications = onMessage(getMessaging(), async (remoteMessage) => {
                    await wrapOnMessageReceived(true, remoteMessage);

                    if (remoteMessage?.data?.areasActivated) {
                        const parsedAreasData = typeof (remoteMessage?.data?.areasActivated) === 'string'
                            ? JSON.parse(remoteMessage?.data?.areasActivated)
                            : [];
                        const momentsData = parsedAreasData.filter((area) => area.momentId);
                        const spacesData = parsedAreasData.filter((area) => area.spaceId);
                        if (parsedAreasData.length) {
                            sendForegroundNotification({
                                title: this.translate('alertTitles.newAreasActivated'),
                                body: this.translate('alertMessages.newAreasActivated', {
                                    total: momentsData.length + spacesData.length,
                                }),
                                android: {
                                    pressAction: { id: PushNotifications.PressActionIds.discovered, launchActivity: 'default' },
                                },
                                data: {
                                    activatedMomentIds: JSON.stringify(momentsData.map((moment) => moment.momentId)),
                                    activatedSpaceIds: JSON.stringify(spacesData.map((space) => space.spaceId)),
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
                                }, momentsData.map((moment) => moment.momentId));
                            }
                            if (spacesData.length) {
                                searchActiveSpacesByIds({
                                    userLatitude: location?.user?.latitude,
                                    userLongitude: location?.user?.longitude,
                                    withMedia: true,
                                    withUser: true,
                                    blockedUsers: user.details.blockedUsers,
                                    shouldHideMatureContent: user.details.shouldHideMatureContent,
                                }, spacesData.map((space) => space.spaceId));
                            }
                        }
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
                if (!__DEV__) {
                    try {
                        const crashlytics = getCrashlytics();
                        crashlyticsLog(crashlytics, `NOTIFICATIONS_ERROR: ${err?.message || String(err)}`);
                        recordError(crashlytics, err instanceof Error ? err : new Error(String(err)));
                    } catch {
                        // Crashlytics may not be initialized yet on very early startup.
                    }
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

        return logout(userDetails);
    };

    handlePermissionPrimerAllow = () => {
        const resolve = this.permissionPrimerResolve;
        this.permissionPrimerResolve = null;
        this.setState({ permissionPrimerType: null });
        resolve?.(true);
    };

    handlePermissionPrimerNotNow = () => {
        const resolve = this.permissionPrimerResolve;
        this.permissionPrimerResolve = null;
        this.setState({ permissionPrimerType: null });
        resolve?.(false);
    };

    handleSplashSpinComplete = () => {
        this.setState({ isSplashSpinnerVisible: false });
    };

    render() {
        const {
            location,
            notifications,
            updateGpsStatus,
            user,
        } = this.props;
        const {
            isAppReviewPromptVisible,
            permissionPrimerType,
            isSplashSpinnerVisible,
            shouldSpinSplashLogo,
        } = this.state;

        return (
            <>
                <NavigationContainer
                // Keyed on locale only so theme toggles do not remount the entire nav tree.
                // Locale change still requires a remount because route translators close over locale at construction.
                    key={this.props.user?.settings?.locale || 'en-us'}
                    // Restore the stack the user was already on across that remount. Without this the
                    // navigator falls back to its first screen, so switching languages from, say, the
                    // sign-up screen would bounce the user out to the landing/sign-in screen. Route
                    // names are locale-independent (`translate` returns the key when it is not a
                    // dictionary path), so a state captured under one locale is valid under any other.
                    // Undefined on first mount, which is the normal "start at the initial route" case.
                    initialState={this.lastNavigationState}
                    theme={buildNavTheme(this.theme, this.props.user?.settings?.mobileThemeName)}
                    ref={navigationRef}
                    onReady={() => {
                        this.routeNameRef.current = navigationRef?.getCurrentRoute()?.name;
                        this.lastNavigationState = navigationRef?.getRootState();
                        Promise.allSettled(preLoadImageList.map((image) => {
                            const img = Image.resolveAssetSource(image).uri;
                            return Image.prefetch(img);
                        })).finally(() => {
                        // TODO: Update users lastSessionStartAt property to track user activity
                        // Hand off to JS overlay with no fade: the overlay matches the native splash bg
                        // exactly, so the transition is invisible and the spin starts cleanly.
                            SplashScreen.hide({ fade: false });
                            this.setState({ shouldSpinSplashLogo: true });
                            // AppState never reports the launch itself as a change, so the
                            // cold-start path has to arm its own check.
                            this.scheduleAppReviewPromptCheck(APP_REVIEW_PROMPT_COLD_START_DELAY_MS);
                        });
                    }}
                    onStateChange={async () => {
                        // Capture synchronously, before any await, so a locale change dispatched
                        // during this tick still remounts with the up-to-date stack.
                        this.lastNavigationState = navigationRef?.getRootState();
                        const previousRouteName = this.routeNameRef.current;
                        const currentRouteName = navigationRef?.getCurrentRoute()?.name;
                        if (currentRouteName !== 'Map') {
                        // Prevent stuck tour on wrong routes
                            this.props.stopNavigationTour();
                        }

                        if (previousRouteName !== currentRouteName) {
                            await logScreenView(getAnalytics(), {
                                screen_name: currentRouteName,
                                screen_class: currentRouteName,
                                is_authenticated: this.isUserAuthenticated() ? 'yes' : 'no',
                            });
                        }
                        this.routeNameRef.current = currentRouteName;
                    }}
                >
                    <Stack.Navigator
                        id={undefined}
                        // Mount straight onto the brand's landing screen instead of
                        // rendering the first authorized route and resetting away
                        // from it a frame later.
                        initialRouteName={getBrandInitialRouteName(user)}
                        screenOptions={({ route, navigation }) => {
                            const themeName = this.props?.user?.settings?.mobileThemeName;
                            const currentScreen = route.name;
                            const currentScreenParams = (route.params as Record<string, any>) || {};
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
                            || currentScreen === 'CreateProfile'
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
                            const advancedSearchPlaceholderText = currentScreen === 'Areas'
                                ? this.translate('components.header.searchContentInput.placeholder')
                                : this.translate('components.header.searchInput.placeholder');
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
                            const isSearchRoute = isAreas || isMap || isConnect;
                            let searchInputNode: React.ReactNode = null;
                            if (isAreas) {
                                searchInputNode = <HeaderSearchInput
                                    isAdvancedSearch
                                    navigation={navigation}
                                    theme={this.theme}
                                    themeForms={this.themeForms}
                                    placeholderText={advancedSearchPlaceholderText}
                                />;
                            }
                            if (isMap) {
                                searchInputNode = <HeaderSearchInput
                                    navigation={navigation}
                                    theme={this.theme}
                                    themeForms={this.themeForms}
                                    placeholderText={advancedSearchPlaceholderText}
                                />;
                            }
                            if (isConnect) {
                                searchInputNode = <HeaderSearchUsersInput
                                    navigation={navigation}
                                    theme={this.theme}
                                    themeForms={this.themeForms}
                                />;
                            }

                            const headerLeftNode = <HeaderMenuLeft
                                styleName={headerStyleName}
                                navigation={navigation}
                                isAuthenticated={user.isAuthenticated}
                                isEmailVerifed={this.isUserEmailVerified()}
                                theme={this.theme}
                            />;
                            const headerRightNode = this.shouldShowTopRightMenu() ?
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
                                />;

                            const baseOptions: any = {
                                animation: 'fade',
                                freezeOnBlur: true,
                                headerLeft: () => headerLeftNode,
                                headerRight: () => headerRightNode,
                                headerTitleStyle: {
                                    ...this.theme.styles.headerTitleStyle,
                                    color: headerTitleColor,
                                    textShadowOffset: { width: 0, height: 0 },
                                    textShadowRadius: 0,
                                },
                                headerTitleAlign: 'center',
                                headerStyle,
                                headerTransparent: false,
                                headerBackVisible: false,
                                headerBackTitle: '',
                                headerTitle,
                            };

                            // Use a custom JS header for every route so the left
                            // logo and right menu button sit flush against the
                            // screen edges. Native-stack's built-in header adds an
                            // inset that pushed them inward on non-search routes.
                            const customHeaderStyle = {
                                backgroundColor: headerStyle?.backgroundColor,
                                borderBottomColor: headerStyle?.borderBottomColor,
                                borderBottomWidth: headerStyle?.borderBottomWidth,
                            };
                            baseOptions.header = ({ options: hOpts, route: hRoute }: any) => {
                                let middleNode: React.ReactNode;
                                if (isSearchRoute) {
                                    middleNode = (
                                        <View style={{ flex: 1, flexDirection: 'row', marginHorizontal: 8 }}>
                                            {searchInputNode}
                                        </View>
                                    );
                                } else if (typeof hOpts?.headerTitle === 'function') {
                                    middleNode = (
                                        <View style={{ flex: 1, alignItems: 'center' }}>
                                            {hOpts.headerTitle({
                                                children: hOpts.title ?? hRoute.name,
                                                tintColor: headerTitleColor,
                                            })}
                                        </View>
                                    );
                                } else {
                                    const titleText = typeof hOpts?.headerTitle === 'string'
                                        ? hOpts.headerTitle
                                        : (hOpts?.title ?? hRoute.name);
                                    middleNode = (
                                        <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
                                            <Text
                                                numberOfLines={1}
                                                style={[
                                                    this.theme.styles.headerTitleStyle,
                                                    { color: headerTitleColor },
                                                ]}
                                            >
                                                {titleText}
                                            </Text>
                                        </View>
                                    );
                                }
                                return (
                                    <SafeAreaInsetsContext.Consumer>
                                        {(insets) => (
                                            <View style={[customHeaderStyle, { paddingTop: insets?.top ?? getHeaderTopInset() }]}>
                                                <View style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    height: 52,
                                                    paddingHorizontal: 8,
                                                }}>
                                                    {headerLeftNode}
                                                    {middleNode}
                                                    {headerRightNode}
                                                </View>
                                            </View>
                                        )}
                                    </SafeAreaInsetsContext.Consumer>
                                );
                            };

                            return baseOptions;
                        }}
                    >
                        {routes
                            .filter((route: any) => {
                                const routeOptions = route.options && typeof route.options === 'function'
                                    ? route.options()
                                    : {};

                                // Filter by feature flags first
                                const requiredFeatures: FeatureFlags[] = routeOptions.requiredFeatures || [];
                                if (requiredFeatures.length > 0) {
                                    const config = getConfig();
                                    const featureFlags = config.featureFlags || {};
                                    const allFeaturesEnabled = requiredFeatures.every(
                                        (flag: FeatureFlags) => featureFlags[flag] === true
                                    );
                                    if (!allFeaturesEnabled) {
                                        return false;
                                    }
                                }

                                // Then filter by access control
                                if (!routeOptions.access) {
                                    return true;
                                }

                                if (route.name === 'Landing' && user?.isAuthenticated) {
                                    return false;
                                }

                                const isAuthorized = UsersService.isAuthorized(
                                    routeOptions.access,
                                    user
                                );

                                delete route.options.access;

                                return isAuthorized;
                            })
                            .map((route: any) => {
                                route.name = this.translate(route.name);
                                delete route.key;
                                return <Stack.Screen key={route.name} {...route} />;
                            })}
                    </Stack.Navigator>
                    {permissionPrimerType ? (
                        <PermissionPrimerModal
                            permissionType={permissionPrimerType}
                            isVisible={!!permissionPrimerType}
                            onAllow={this.handlePermissionPrimerAllow}
                            onNotNow={this.handlePermissionPrimerNotNow}
                            translate={this.translate}
                            themeDisclosure={this.themeDisclosure}
                        />
                    ) : null}
                    <AppReviewPromptModal
                        isVisible={isAppReviewPromptVisible}
                        onClose={this.handleAppReviewPromptClose}
                        translate={this.translate}
                        themeModal={this.themeConfirmModal}
                        themeButtons={this.themeButtons}
                    />

                </NavigationContainer>
                {isSplashSpinnerVisible ? (
                    <SplashLogoSpinner
                        start={shouldSpinSplashLogo}
                        onAnimationComplete={this.handleSplashSpinComplete}
                    />
                ) : null}
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Layout);
