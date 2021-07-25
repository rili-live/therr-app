import * as React from 'react';
import { RouteProps } from 'react-router-dom';
import { AccessCheckType, IAccess } from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import Forum from './Forum';
import CreateForum from './CreateForum';
import CreateProfile from './CreateProfile';
import EmailVerification from './EmailVerification';
import PageNotFound from './PageNotFound';
import Register from './Register';
import ResetPassword from './ResetPassword';
import Home from './Home';
import Login from './Login';
import UserProfile from './UserProfile';
import ChangePassword from './ChangePassword';

export interface IRoute extends RouteProps {
    access?: IAccess;
    exact?: boolean;
    fetchData?: Function;
    // Overriding this property allows us to add custom paramaters to React components
    component?: any;
    redirectPath?: string;
    render?: any;
}

export interface IRoutePropsConfig {
    onInitMessaging?: any;
}

const getRoutes = (routePropsConfig: IRoutePropsConfig = {}): IRoute[] => [
    {
        path: '/',
        component: Home,
        exact: true,
    },
    {
        path: '/forums/:roomId',
        component: Forum,
        exact: true,
        access: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        },
        redirectPath: '/create-profile',
    },
    {
        path: '/create-forum',
        component: CreateForum,
        exact: true,
        access: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        },
        redirectPath: '/create-profile',
    },
    {
        path: '/create-profile',
        component: CreateProfile,
        exact: true,
        access: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
        },
        redirectPath: '/login',
    },
    {
        path: '/users/change-password',
        component: ChangePassword,
        exact: true,
        access: {
            type: AccessCheckType.ANY,
            levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
        },
        redirectPath: '/create-profile',
    },
    {
        path: '/reset-password',
        component: ResetPassword,
        exact: true,
    },
    {
        path: '/verify-account',
        component: EmailVerification,
        exact: true,
    },
    {
        path: '/login',
        component: Login,
        exact: true,
    },
    {
        path: '/register',
        component: Register,
        exact: true,
    },
    {
        path: '/user/profile',
        render: (routeProps) => <UserProfile onInitMessaging={routePropsConfig.onInitMessaging} {...routeProps} />, // eslint-disable-line react/display-name
        exact: true,
        access: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        },
        redirectPath: '/create-profile',
    },

    // If no route matches, return NotFound component
    {
        component: PageNotFound,
    },
];

export default getRoutes;
