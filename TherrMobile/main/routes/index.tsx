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
import Notifications from './Notifications';
import Register from './Register';
import Settings from './Settings';
import ViewMoment from './ViewMoment';
import EditMoment from './EditMoment';
import styles from '../styles';

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
        }),
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
        name: 'ForgotPassword',
        component: ForgotPassword,
        options: {
            title: 'Password Reset',
            headerStyle: styles.headerStyleAlt,
        },
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
        }),
    },
];

export default routes;
