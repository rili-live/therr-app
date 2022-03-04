import React from 'react'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { RouteConfig, StackNavigationState } from '@react-navigation/native';
import { StackNavigationOptions } from '@react-navigation/stack';
import { StackNavigationEventMap } from '@react-navigation/stack/lib/typescript/src/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import { IAccess, AccessCheckType } from 'therr-react/types';
import AdvancedSearch from './AdvancedSearch';
import BookMarked from './Areas/BookMarked';
import Home from './Home';
import DirectMessage from './DirectMessage';
import Landing from './Landing';
import Login from './Login';
import Map from './Map';
import Areas from './Areas';
import ActiveConnections from './ActiveConnections';
import Contacts from './Contacts';
import CreateConnection from './CreateConnection';
import PhoneContacts from './Contacts/PhoneContacts';
import AreaImageCrop from './CropImage/AreaImageCrop';
import CreateProfile from './CreateProfile';
import EmailVerification from './EmailVerification';
import ForgotPassword from './ForgotPassword';
// import HostedChat from './HostedChat';
import Nearby from './Areas/Nearby';
import Notifications from './Notifications';
import Register from './Register';
import Settings from './Settings';
import ViewMoment from './ViewMoment';
import EditMoment from './EditMoment';
import ViewSpace from './ViewSpace';
import EditSpace from './EditSpace';
import EditChat from './HostedChat/EditChat';
import ViewChat from './HostedChat/ViewChat';
import ViewUser from './ViewUser/index.tsx';
import { buildStyles } from '../styles';

// TODO: Use Props
const styles = buildStyles().styles;

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
            access: {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            },
            headerStyle: styles.headerStyleNoShadow,
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
            headerStyle: styles.headerStyleNoShadow,
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
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'AreaImageCrop',
        component: AreaImageCrop,
        options: () => ({
            title: 'Crop Image',
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
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'ActiveConnections',
        component: ActiveConnections,
        options: () => ({
            title: 'Active Connections',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerStyle: styles.headerStyleNoShadow,
        }),
    },
    {
        name: 'Contacts',
        component: Contacts,
        options: () => ({
            title: 'Contacts',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerStyle: styles.headerStyleNoShadow,
        }),
    },
    {
        name: 'CreateConnection',
        component: CreateConnection,
        options: () => ({
            title: 'Create Connection',
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
            access: {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            },
            headerStyle: styles.headerStyleNoShadow,
        }),
    },
    // {
    //     name: 'HostedChat',
    //     component: HostedChat,
    //     options: () => ({
    //         title: 'HostedChat',
    //         access: {
    //             type: AccessCheckType.ALL,
    //             levels: [AccessLevels.EMAIL_VERIFIED],
    //         },
    //     }),
    // },
    {
        name: 'Nearby',
        component: Nearby,
        options: () => ({
            title: 'Nearby',
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
            headerStyle: styles.headerStyleNoShadow,
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
        name: 'EditChat',
        component: EditChat,
        options: () => ({
            title: 'Edit Chat',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerStyle: styles.headerStyleAccent,
            headerTitleStyle: {
                ...styles.headerTitleStyle,
                alignSelf: 'flex-start',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 0,
                letterSpacing: 2,
            },
            headerLeft: () => null,
            cardStyleInterpolator: undefined,
            transitionSpec: momentTransitionSpec,
        }),
    },
    {
        name: 'ViewChat',
        component: ViewChat,
        options: () => ({
            title: 'View Chat',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerStyle: styles.headerStyleAccent,
            headerTitleStyle: {
                ...styles.headerTitleStyle,
                alignSelf: 'flex-start',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 0,
                letterSpacing: 2,
            },
            headerLeft: () => null,
            cardStyleInterpolator: undefined,
            transitionSpec: momentTransitionSpec,
        }),
    },
    {
        name: 'ViewMoment',
        component: ViewMoment,
        options: () => ({
            title: 'View Moment',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerStyle: styles.headerStyleAccent,
            headerTitleStyle: {
                ...styles.headerTitleStyle,
                alignSelf: 'flex-start',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 0,
                letterSpacing: 2,
            },
            headerLeft: () => null,
        }),
    },
    {
        name: 'EditMoment',
        component: EditMoment,
        options: () => ({
            title: 'Edit Moment',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerStyle: styles.headerStyleAccent,
            headerTitleStyle: {
                ...styles.headerTitleStyle,
                alignSelf: 'flex-start',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 0,
                letterSpacing: 2,
            },
            headerLeft: () => null,
            cardStyleInterpolator: undefined,
            transitionSpec: momentTransitionSpec,
        }),
    },
    {
        name: 'ViewSpace',
        component: ViewSpace,
        options: () => ({
            title: 'View Space',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerStyle: styles.headerStyleAccent,
            headerTitleStyle: {
                ...styles.headerTitleStyle,
                alignSelf: 'flex-start',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 0,
                letterSpacing: 2,
            },
            headerLeft: () => null,
        }),
    },
    {
        name: 'EditSpace',
        component: EditSpace,
        options: () => ({
            title: 'Edit Space',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerStyle: styles.headerStyleAccent,
            headerTitleStyle: {
                ...styles.headerTitleStyle,
                alignSelf: 'flex-start',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 0,
                letterSpacing: 2,
            },
            headerLeft: () => null,
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
            cardStyleInterpolator: undefined,
            transitionSpec: momentTransitionSpec,
        }),
    },
];

export default routes;
