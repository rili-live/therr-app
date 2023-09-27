import * as React from 'react';
import { RouteObject } from 'react-router-dom';
import { AccessCheckType, IAccess } from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import { AuthRoute } from 'therr-react/components';
import { MapsService } from 'therr-react/services';
import { MapActions } from 'therr-react/redux/actions';
import UsersActions from '../redux/actions/UsersActions';
import Forum from './Forum';
import CreateForum from './CreateForum';
import CreateProfile from './CreateProfile';
import EmailVerification from './EmailVerification';
import PageNotFound from './PageNotFound';
import Register from './Register';
import ResetPassword from './ResetPassword';
import Home from './Home';
import ViewSpace from './ViewSpace';
import Login from './Login';
import UserProfile from './UserProfile';
import ChangePassword from './ChangePassword';
import Discovered from './Discovered';
import UnderConstruction from './UnderConstruction';
import ViewMoment from './ViewMoment';
import ViewUser from './ViewUser';

export interface IRoute extends RouteObject {
    access?: IAccess;
    fetchData?: (dispatch: any, params?: { [key: string]: any }) => Promise<any>;
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
        element: <AuthRoute
            component={CreateForum}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/create-profile',
        element: <AuthRoute
            component={CreateProfile}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            })}
            redirectPath={'/login'}
        />,
    },
    {
        path: '/users/change-password',
        element: <AuthRoute
            component={ChangePassword}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ANY,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            })}
            redirectPath={'/create-profile'}
        />,
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
        element: <AuthRoute
            render={() => <UserProfile onInitMessaging={routePropsConfig.onInitMessaging} />}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/discovered',
        element: <AuthRoute
            component={Discovered}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/user/go-mobile',
        element: <AuthRoute
            component={UnderConstruction}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/moments/:momentId',
        element: <ViewMoment />,
        fetchData: (dispatch: any, params: any) => MapActions.getMomentDetails(params.momentId, {
            withMedia: true,
            withUser: true,
        })(dispatch),
    },
    {
        path: '/spaces/:spaceId',
        element: <ViewSpace />,
        fetchData: (dispatch: any, params: any) => MapActions.getSpaceDetails(params.spaceId, {
            withMedia: true,
            withUser: true,
        })(dispatch),
    },
    {
        path: '/users/:userId',
        element: <ViewUser />,
        fetchData: (dispatch: any, params: any) => UsersActions.get(params.userId)(dispatch),
    },

    // If no route matches, return NotFound component
    {
        path: '*',
        element: <PageNotFound />,
    },
];

export default getRoutes;
