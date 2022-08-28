import * as React from 'react';
import { RouteObject } from 'react-router-dom';
import { AccessCheckType, IAccess } from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import { AuthRoute } from 'therr-react/components';
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
import Discovered from './Discovered';
import UnderConstruction from './UnderConstruction';

export interface IRoute extends RouteObject {
    access?: IAccess;
    fetchData?: Function;
    // Overriding this property allows us to add custom paramaters to React components
    redirectPath?: string;
}

export interface IRoutePropsConfig {
    onInitMessaging?: any;
    isAuthorized: Function
}

const getRoutes = (routePropsConfig: IRoutePropsConfig): IRoute[] => [
    {
        path: '/',
        element: <Home />,
    },
    {
        path: '/forums/:roomId',
        element: <AuthRoute
            component={Forum}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            path={'/forums/:roomId'}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/create-forum',
        element: <CreateForum />,
        access: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        },
        redirectPath: '/create-profile',
    },
    {
        path: '/create-profile',
        element: <CreateProfile />,
        access: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
        },
        redirectPath: '/login',
    },
    {
        path: '/users/change-password',
        element: <ChangePassword />,
        access: {
            type: AccessCheckType.ANY,
            levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
        },
        redirectPath: '/create-profile',
    },
    {
        path: '/reset-password',
        element: <ResetPassword />,
    },
    {
        path: '/verify-account',
        element: <EmailVerification />,
    },
    {
        path: '/login',
        element: <Login />,
    },
    {
        path: '/register',
        element: <Register />,
    },
    {
        path: '/user/profile',
        element: <UserProfile onInitMessaging={routePropsConfig.onInitMessaging} />, // eslint-disable-line react/display-name
        access: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        },
        redirectPath: '/create-profile',
    },
    {
        path: '/discovered',
        element: <Discovered />,
        access: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        },
        redirectPath: '/create-profile',
    },
    {
        path: '/user/go-mobile',
        element: <UnderConstruction />, // eslint-disable-line react/display-name
        access: {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.EMAIL_VERIFIED],
        },
        redirectPath: '/create-profile',
    },

    // If no route matches, return NotFound component
    {
        path: '*',
        element: <PageNotFound />,
    },
];

export default getRoutes;
