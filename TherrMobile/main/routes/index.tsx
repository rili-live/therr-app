import { RouteConfig, StackNavigationState } from '@react-navigation/native';
import { StackNavigationOptions } from '@react-navigation/stack';
import { StackNavigationEventMap } from '@react-navigation/stack/lib/typescript/src/types';
import Home from './Home';
import DirectMessage from './DirectMessage';
import Login from './Login';
import { IAccess, AccessCheckType } from '../types';
import Map from './Map';
import ActiveConnections from './ActiveConnections';
import Contacts from './Contacts';
import ForgotPassword from './ForgotPassword';
import HostedChat from './HostedChat';
import Notifications from './Notifications';
import Register from './Register';
import Settings from './Settings';
import ViewMoment from './ViewMoment';
import EditMoment from './EditMoment';
import EditChat from './HostedChat/EditChat';
import ViewChat from './HostedChat/ViewChat';
import styles from '../styles';
import * as therrTheme from '../styles/themes';

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
        options: {
            title: 'Login',
            headerStyle: styles.headerStyleAlt,
        },
    },
    {
        name: 'Map',
        component: Map,
        options: () => ({
            title: 'Map',
            access: {
                type: AccessCheckType.ALL,
                levels: [],
            },
            headerTransparent: true,
        }),
    },
    {
        name: 'Home',
        component: Home,
        options: () => ({
            title: 'Home',
            access: {
                type: AccessCheckType.ALL,
                levels: [],
            },
        }),
    },
    {
        name: 'ActiveConnections',
        component: ActiveConnections,
        options: () => ({
            title: 'ActiveConnections',
            access: {
                type: AccessCheckType.ALL,
                levels: [],
            },
        }),
    },
    {
        name: 'Contacts',
        component: Contacts,
        options: () => ({
            title: 'Contacts',
            access: {
                type: AccessCheckType.ALL,
                levels: [],
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
                levels: [],
            },
            cardStyleInterpolator: undefined,
            transitionSpec: momentTransitionSpec,
        }),
    },
    {
        name: 'ForgotPassword',
        component: ForgotPassword,
        options: {
            title: 'Password Reset',
            headerStyle: styles.headerStyleAlt,
        },
    },
    {
        name: 'HostedChat',
        component: HostedChat,
        options: () => ({
            title: 'HostedChat',
            access: {
                type: AccessCheckType.ALL,
                levels: [],
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
                levels: [],
            },
        }),
    },
    {
        name: 'Register',
        component: Register,
        options: {
            title: 'Create Account',
        },
    },
    {
        name: 'Settings',
        component: Settings,
        options: () => ({
            title: 'Settings',
            access: {
                type: AccessCheckType.ALL,
                levels: [],
            },
        }),
    },
    {
        name: 'ViewMoment',
        component: ViewMoment,
        options: () => ({
            title: 'ViewMoment',
            access: {
                type: AccessCheckType.ALL,
                levels: [],
            },
            headerStyle: styles.headerStyleBeemo,
            headerTitleStyle: {
                ...styles.headerTitleStyle,
                alignSelf: 'flex-start',
                color: therrTheme.colors.beemoTextBlack,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 0,
                letterSpacing: 2,
            },
            headerLeft: () => null,
        }),
    },
    {
        name: 'EditChat',
        component: EditChat,
        options: () => ({
            title: 'EditChat',
            access: {
                type: AccessCheckType.ALL,
                levels: [],
            },
            headerStyle: styles.headerStyleBeemo,
            headerTitleStyle: {
                ...styles.headerTitleStyle,
                alignSelf: 'flex-start',
                color: therrTheme.colors.beemoTextBlack,
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
                levels: [],
            },
            headerStyle: styles.headerStyleBeemo,
            headerTitleStyle: {
                ...styles.headerTitleStyle,
                alignSelf: 'flex-start',
                color: therrTheme.colors.beemoTextBlack,
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
        name: 'EditMoment',
        component: EditMoment,
        options: () => ({
            title: 'EditMoment',
            access: {
                type: AccessCheckType.ALL,
                levels: [],
            },
            headerStyle: styles.headerStyleBeemo,
            headerTitleStyle: {
                ...styles.headerTitleStyle,
                alignSelf: 'flex-start',
                color: therrTheme.colors.beemoTextBlack,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 0,
                letterSpacing: 2,
            },
            headerLeft: () => null,
            cardStyleInterpolator: undefined,
            transitionSpec: momentTransitionSpec,
        }),
    },
];

export default routes;
