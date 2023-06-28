import * as React from 'react';
import { RouteObject } from 'react-router-dom';
import { AccessCheckType, IAccess } from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import { AuthRoute } from 'therr-react/components';
import Login from './Login';
import ClaimASpace from './ClaimASpace';
import AdminDashboardOverview from './Dashboards/AdminDashboardOverview';
import DashboardOverview from './Dashboards/DashboardOverview';
import PageNotFound from './PageNotFound';
import Register from './Register';
import Settings from './Settings';
import EmailVerification from './EmailVerification';
import ResetPassword from './ResetPassword';
import ManageSpaces from './ManageSpaces';
import CreateEditSpace from './CreateEditSpace';

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
        element: <AuthRoute
            component={Login}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ANY,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            })}
            redirectPath={'/login'}
        />,
    },
    {
        path: '/dashboard',
        element: <AuthRoute
            component={DashboardOverview}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ANY,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            })}
            redirectPath={'/login'}
        />,
    },
    {
        path: '/admin-dashboard',
        element: <AuthRoute
            component={AdminDashboardOverview}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.SUPER_ADMIN],
            })}
            redirectPath={'/login'}
        />,
    },
    {
        path: '/claim-a-space',
        element: <AuthRoute
            component={ClaimASpace}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/login'}
        />,
    },
    {
        path: '/edit-space/:spaceId',
        element: <AuthRoute
            component={CreateEditSpace}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/login'}
        />,
    },
    {
        path: '/manage-spaces/:context',
        element: <AuthRoute
            component={ManageSpaces}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/login'}
        />,
    },
    {
        path: '/settings',
        element: <AuthRoute
            component={Settings}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ANY,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            })}
            redirectPath={'/login'}
        />,
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
        path: '/reset-password',
        element: <ResetPassword />,
    },
    {
        path: '/verify-account',
        element: <EmailVerification />,
    },

    // If no route matches, return NotFound component
    {
        path: '*',
        element: <PageNotFound />,
    },
];

export default getRoutes;
