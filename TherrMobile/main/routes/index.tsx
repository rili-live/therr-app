import React from 'react'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { RouteConfig, StackNavigationState } from '@react-navigation/native';
import { StackNavigationOptions } from '@react-navigation/stack';
import { StackNavigationEventMap } from '@react-navigation/stack/lib/typescript/src/types';
import { AccessLevels, FeatureFlags } from 'therr-js-utilities/constants';
import { IAccess, AccessCheckType } from 'therr-react/types';
import ActivityGenerator from './Activities/ActivityGenerator';
import ActivityScheduler from './Activities/ActivityScheduler';
import AdvancedSearch from './AdvancedSearch';
import MapFilteredSearch from './AdvancedSearch/MapFilteredSearch';
import BookMarked from './Areas/BookMarked';
import MyDrafts from './Areas/MyDrafts';
import Home from './Home';
import DirectMessage from './DirectMessage';
import Landing from './Landing';
import Login from './Login';
import Map from './Map';
import Achievements from './Achievements';
import AchievementClaim from './Achievements/AchievementClaim';
import Areas from './Areas';
import Connect from './Connect';
import Groups from './Groups';
import PhoneContacts from './Invite/PhoneContacts';
import CreateProfile from './CreateProfile';
import EmailVerification from './EmailVerification';
import ForgotPassword from './ForgotPassword';
import Nearby from './Areas/Nearby';
import Notifications from './Notifications';
import Register from './Register';
import Settings from './Settings';
import ManageAccount from './Settings/ManageAccount';
import ManageNotifications from './Settings/ManageNotifications';
import ManagePreferences from './Settings/ManagePreferences';
import SocialSync from './ViewUser/SocialSync';
import ViewEvent from './ViewEvent';
import ViewMoment from './ViewMoment';
import EditMoment from './EditMoment';
import EditEvent from './Events/EditEvent';
import ViewSpace from './ViewSpace';
import EditSpace from './EditSpace';
import EditThought from './EditThought';
import EditGroup from './Groups/EditGroup';
import ViewGroup from './Groups/ViewGroup';
import ExchangePointsDisclaimer from './Rewards/ExchangePointsDisclaimer';
import Invite from './Invite';
import ViewThought from './ViewThought';
import ViewUser from './ViewUser';

const momentTransitionSpec: any = {
    open: {
        animation: 'spring',
        config: {
            stiffness: 100,
            damping: 200,
            mass: 3,
            overshootClamping: true,
            restDisplacementThreshold: 0.9,
            restSpeedThreshold: 0.1,
        },
    },
    close: {
        animation: 'spring',
        config: {
            stiffness: 250,
            damping: 300,
            mass: 3,
            overshootClamping: true,
            restDisplacementThreshold: 0.1,
            restSpeedThreshold: 0.5,
        },
    },
};

export interface ExtendedRouteOptions extends StackNavigationOptions {
    access?: IAccess;
    requiredFeatures?: FeatureFlags[];
}

const routes: RouteConfig<
    Record<string, object>,
    any,
    StackNavigationState<any>,
    ExtendedRouteOptions,
    StackNavigationEventMap
>[] = [
    {
        name: 'Landing',
        component: Landing,
        options: () => ({
            title: 'Landing',
            headerShown: false,
            access: {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            },
        }),
    },
    {
        name: 'Login',
        component: Login,
        options: () => ({
            title: 'Login',
            access: {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            },
        }),
    },
    {
        name: 'CreateProfile',
        component: CreateProfile,
        options: () => ({
            title: 'Create Profile',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            },
        }),
    },
    {
        name: 'Map',
        component: Map,
        options: () => ({
            title: 'Map',
            requiredFeatures: [FeatureFlags.ENABLE_MAP],
            access: {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            },
        }),
    },
    {
        name: 'Achievements',
        component: Achievements,
        options: () => ({
            title: 'Achievements',
            requiredFeatures: [FeatureFlags.ENABLE_ACHIEVEMENTS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'ActivityGenerator',
        component: ActivityGenerator,
        options: () => ({
            title: 'ActivityGenerator',
            requiredFeatures: [FeatureFlags.ENABLE_ACTIVITIES],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'ActivityScheduler',
        component: ActivityScheduler,
        options: () => ({
            title: 'ActivityScheduler',
            requiredFeatures: [FeatureFlags.ENABLE_ACTIVITY_SCHEDULER],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'AchievementClaim',
        component: AchievementClaim,
        options: () => ({
            title: 'AchievementClaim',
            requiredFeatures: [FeatureFlags.ENABLE_ACHIEVEMENTS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'Areas',
        component: Areas,
        options: () => ({
            title: 'Areas',
            requiredFeatures: [FeatureFlags.ENABLE_AREAS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'AdvancedSearch',
        component: AdvancedSearch,
        options: () => ({
            title: 'Advanced Search',
            requiredFeatures: [FeatureFlags.ENABLE_AREAS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'BookMarked',
        component: BookMarked,
        options: () => ({
            title: 'Bookmarked',
            requiredFeatures: [FeatureFlags.ENABLE_AREAS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'MyDrafts',
        component: MyDrafts,
        options: () => ({
            title: 'My Drafts',
            requiredFeatures: [FeatureFlags.ENABLE_AREAS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'Home',
        component: Home,
        options: () => ({
            title: 'Home',
            access: {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            },
        }),
    },
    {
        name: 'Connect',
        component: Connect,
        options: () => ({
            title: 'Connect',
            requiredFeatures: [FeatureFlags.ENABLE_CONNECT],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'Invite',
        component: Invite,
        options: () => ({
            title: 'Invite',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'PhoneContacts',
        component: PhoneContacts,
        options: () => ({
            title: 'Phone Contacts',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'DirectMessage',
        component: DirectMessage,
        options: () => ({
            title: 'Direct Message',
            requiredFeatures: [FeatureFlags.ENABLE_DIRECT_MESSAGING],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            cardStyleInterpolator: undefined,
            transitionSpec: momentTransitionSpec,
        }),
    },
    {
        name: 'ForgotPassword',
        component: ForgotPassword,
        options: () => ({
            title: 'Password Reset',
        }),
    },
    {
        name: 'MapFilteredSearch',
        component: MapFilteredSearch,
        options: () => ({
            title: 'Map Search Filters',
            requiredFeatures: [FeatureFlags.ENABLE_MAP],
            access: {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            },
        }),
    },
    {
        name: 'Nearby',
        component: Nearby,
        options: () => ({
            title: 'Nearby',
            requiredFeatures: [FeatureFlags.ENABLE_AREAS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'Notifications',
        component: Notifications,
        options: () => ({
            title: 'Notifications',
            requiredFeatures: [FeatureFlags.ENABLE_NOTIFICATIONS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'EmailVerification',
        component: EmailVerification,
        options: () => ({
            title: 'Email Verification',
            access: {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            },
        }),
    },
    {
        name: 'Register',
        component: Register,
        options: () => ({
            title: 'Create Account',
            access: {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            },
        }),
    },
    {
        name: 'Settings',
        component: Settings,
        options: () => ({
            title: 'Settings',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'ManageAccount',
        component: ManageAccount,
        options: () => ({
            title: 'ManageAccount',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'ManageNotifications',
        component: ManageNotifications,
        options: () => ({
            title: 'ManageNotifications',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'ManagePreferences',
        component: ManagePreferences,
        options: () => ({
            title: 'ManagePreferences',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'SocialSync',
        component: SocialSync,
        options: () => ({
            title: 'Social Sync',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'EditGroup',
        component: EditGroup,
        options: () => ({
            title: 'Create/Edit Group',
            requiredFeatures: [FeatureFlags.ENABLE_GROUPS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerLeft: () => null,
            headerTitleAlign: 'left',
            cardStyleInterpolator: undefined,
            transitionSpec: momentTransitionSpec,
        }),
    },
    {
        name: 'ExchangePointsDisclaimer',
        component: ExchangePointsDisclaimer,
        options: () => ({
            title: 'Exchange Points',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'Groups',
        component: Groups,
        options: () => ({
            title: 'Groups',
            requiredFeatures: [FeatureFlags.ENABLE_GROUPS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'ViewGroup',
        component: ViewGroup,
        options: () => ({
            title: 'View Group',
            requiredFeatures: [FeatureFlags.ENABLE_GROUPS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerLeft: () => null,
            headerTitleAlign: 'left',
            cardStyleInterpolator: undefined,
            transitionSpec: momentTransitionSpec,
        }),
    },
    {
        name: 'ViewEvent',
        component: ViewEvent,
        options: () => ({
            title: 'View Event',
            requiredFeatures: [FeatureFlags.ENABLE_EVENTS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerLeft: () => null,
            headerTitleAlign: 'left',
        }),
    },
    {
        name: 'ViewMoment',
        component: ViewMoment,
        options: () => ({
            title: 'View Moment',
            requiredFeatures: [FeatureFlags.ENABLE_MOMENTS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerLeft: () => null,
            headerTitleAlign: 'left',
        }),
    },
    {
        name: 'EditMoment',
        component: EditMoment,
        options: () => ({
            title: 'Edit Moment',
            requiredFeatures: [FeatureFlags.ENABLE_MOMENTS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerLeft: () => null,
            headerTitleAlign: 'left',
            cardStyleInterpolator: undefined,
            transitionSpec: momentTransitionSpec,
        }),
    },
    {
        name: 'EditEvent',
        component: EditEvent,
        options: () => ({
            title: 'Edit Event',
            requiredFeatures: [FeatureFlags.ENABLE_EVENTS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerLeft: () => null,
            headerTitleAlign: 'left',
            cardStyleInterpolator: undefined,
            transitionSpec: momentTransitionSpec,
        }),
    },
    {
        name: 'ViewSpace',
        component: ViewSpace,
        options: () => ({
            title: 'View Space',
            requiredFeatures: [FeatureFlags.ENABLE_SPACES],
            access: {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            },
            headerLeft: () => null,
            headerTitleAlign: 'left',
        }),
    },
    {
        name: 'EditSpace',
        component: EditSpace,
        options: () => ({
            title: 'Edit Space',
            requiredFeatures: [FeatureFlags.ENABLE_SPACES],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerLeft: () => null,
            headerTitleAlign: 'left',
            cardStyleInterpolator: undefined,
            transitionSpec: momentTransitionSpec,
        }),
    },
    {
        name: 'EditThought',
        component: EditThought,
        options: () => ({
            title: 'Edit Thought',
            requiredFeatures: [FeatureFlags.ENABLE_THOUGHTS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerLeft: () => null,
            headerTitleAlign: 'left',
            cardStyleInterpolator: undefined,
            transitionSpec: momentTransitionSpec,
        }),
    },
    {
        name: 'ViewUser',
        component: ViewUser,
        options: () => ({
            title: 'View User',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            // cardStyleInterpolator: undefined,
            // transitionSpec: momentTransitionSpec,
        }),
    },
    {
        name: 'ViewThought',
        component: ViewThought,
        options: () => ({
            title: 'View Thought',
            requiredFeatures: [FeatureFlags.ENABLE_THOUGHTS],
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerLeft: () => null,
            headerTitleAlign: 'left',
        }),
    },
];

export default routes;
