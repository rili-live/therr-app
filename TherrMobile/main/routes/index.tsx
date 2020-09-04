import React from 'react';
import { View } from 'react-native';
import { RouteConfig, StackNavigationState } from '@react-navigation/native';
import { StackNavigationOptions } from '@react-navigation/stack';
import { StackNavigationEventMap } from '@react-navigation/stack/lib/typescript/src/types';
import Home from './Home';
import DirectMessage from './DirectMessage';
import Login from './Login';
import { IAccess, AccessCheckType } from '../types';
import Map from './Map';

export interface ExtendedRouteOptions extends StackNavigationOptions {
    access?: IAccess;
}

const routes: RouteConfig<
    Record<string, object>,
    any,
    StackNavigationState,
    ExtendedRouteOptions,
    StackNavigationEventMap
>[] = [
    {
        name: 'Login',
        component: Login,
        options: {
            title: 'Login',
            headerLeft: () => <View />,
            headerRight: () => <View />,
        },
    },
    {
        name: 'Home',
        component: Home,
        options: ({}) => ({
            title: 'Home',
            headerLeft: () => <View />,
            access: {
                type: AccessCheckType.ALL,
                levels: [],
            },
        }),
    },
    {
        name: 'DirectMessage',
        component: DirectMessage,
        options: ({}) => ({
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
        options: ({}) => ({
            title: 'Map',
            access: {
                type: AccessCheckType.ALL,
                levels: [],
            },
        }),
    },
];

export default routes;
