import * as React from 'react';
import { RouteObject } from 'react-router-dom';
import { AccessCheckType, IAccess } from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import { AuthRoute } from 'therr-react/components';
import Login from './Login';
import DashboardOverview from './DashboardOverview';
import PageNotFound from './PageNotFound';

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
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/login'}
        />,
    },
    {
        path: '/dashboard',
        element: <AuthRoute
            component={DashboardOverview}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/login'}
        />,
    },
    {
        path: '/login',
        element: <Login />,
    },

    // If no route matches, return NotFound component
    {
        path: '*',
        element: <PageNotFound />,
    },
];

export default getRoutes;
