import React from 'react';
import { RouteConfig, StackNavigationState } from '@react-navigation/native';
import { StackNavigationOptions } from '@react-navigation/stack';
import { StackNavigationEventMap } from '@react-navigation/stack/lib/typescript/src/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import { IAccess, AccessCheckType } from 'therr-react/types';
import AdvancedSearch from './AdvancedSearch';
import BookMarked from './BookMarked';
import Home from './Home';
import DirectMessage from './DirectMessage';
import Login from './Login';
import Map from './Map';
import Areas from './Areas';
import ActiveConnections from './ActiveConnections';
import Contacts from './Contacts';
import CreateConnection from './CreateConnection';
import CropImage from './CropImage';
import CreateProfile from './CreateProfile';
import EmailVerification from './EmailVerification';
import ForgotPassword from './ForgotPassword';
// import HostedChat from './HostedChat';
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
import styles from '../styles';
import HeaderTherrLogo from '../components/HeaderTherrLogo';
import HeaderSearchInput from '../components/Input/HeaderSearchInput';

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
        name: 'Login',
        component: Login,
        options: (params) => ({
            title: 'Login',
            access: {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            },
            headerStyle: styles.headerStyleNoShadow,
            headerTitle: () => <HeaderTherrLogo navigation={params?.navigation} />,
        }),
    },
    {
        name: 'CreateProfile',
        component: CreateProfile,
        options: () => ({
            title: 'CreateProfile',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            },
        }),
    },
    {
        name: 'Map',
        component: Map,
        options: (params) => ({
            title: 'Map',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerTitle: () => <HeaderSearchInput icon="search" navigation={params?.navigation} />,
        }),
    },
    {
        name: 'Areas',
        component: Areas,
        options: (params) => ({
            title: 'Areas',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerTitle: () => <HeaderSearchInput icon="tune" isAdvancedSearch navigation={params?.navigation} />,
        }),
    },
    {
        name: 'AdvancedSearch',
        component: AdvancedSearch,
        options: () => ({
            title: 'AdvancedSearch',
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
            title: 'BookMarked',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'CropImage',
        component: CropImage,
        options: () => ({
            title: 'CropImage',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
        }),
    },
    {
        name: 'Home',
        component: Home,
        options: (params) => ({
            title: 'Home',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerTitle: () => <HeaderTherrLogo navigation={params?.navigation} />,
        }),
    },
    {
        name: 'ActiveConnections',
        component: ActiveConnections,
        options: () => ({
            title: 'ActiveConnections',
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
            title: 'CreateConnection',
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
            title: 'DirectMessage',
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
        options: (params) => ({
            title: 'Password Reset',
            access: {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            },
            headerStyle: styles.headerStyleNoShadow,
            headerTitle: () => <HeaderTherrLogo navigation={params?.navigation} />,
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
            title: 'EmailVerification',
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
        options: (params) => ({
            title: 'Create Account',
            access: {
                type: AccessCheckType.NONE,
                levels: [AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
                isPublic: true,
            },
            headerStyle: styles.headerStyleNoShadow,
            headerTitle: () => <HeaderTherrLogo navigation={params?.navigation} />,
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
            title: 'EditChat',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerStyle: styles.headerStyleBeemo,
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
            title: 'ViewChat',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerStyle: styles.headerStyleBeemo,
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
            title: 'ViewMoment',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerStyle: styles.headerStyleBeemo,
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
            title: 'EditMoment',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerStyle: styles.headerStyleBeemo,
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
            title: 'ViewSpace',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerStyle: styles.headerStyleBeemo,
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
            title: 'EditSpace',
            access: {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            },
            headerStyle: styles.headerStyleBeemo,
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
            title: 'ViewUser',
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
