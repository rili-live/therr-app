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
import ListSpaces, { DEFAULT_ITEMS_PER_PAGE, DEFAULT_LATITUDE, DEFAULT_LONGITUDE } from './ListSpaces';
import UserProfile from './UserProfile';
import ChangePassword from './ChangePassword';
import Discovered from './Discovered';
import Explore from './Explore';
import ExploreMoments from './Explore/ExploreMoments';
import ExploreThoughts from './Explore/ExploreThoughts';
import ExplorePeople from './Explore/ExplorePeople';
import UnderConstruction from './UnderConstruction';
import ViewMoment from './ViewMoment';
import ViewUser from './ViewUser';
import EmailPreferences from './EmailPreferences';
import AppFeedback from './AppFeedback';

export type IRoute = RouteObject & {
    access?: IAccess;
    fetchData?: (dispatch: any, params?: { [key: string]: any }) => Promise<any>;
    // Overriding this property allows us to add custom paramaters to React components
    redirectPath?: string;
};

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
        path: '/verify-account',
        element: <EmailVerification />,
    },
    {
        path: '/emails/unsubscribe',
        element: <EmailPreferences />,
    },
    {
        path: '/app-feedback',
        element: <AppFeedback />,
    },
    {
        path: '/achievements',
        element: <Home />,
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
            render={() => <UserProfile />}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/explore',
        element: <AuthRoute
            component={Explore}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/posts/moments',
        element: <AuthRoute
            component={ExploreMoments}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/posts/thoughts',
        element: <AuthRoute
            component={ExploreThoughts}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/users',
        element: <AuthRoute
            component={ExplorePeople}
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
        path: '/locations',
        element: <ListSpaces />,
        fetchData: (dispatch: any, params: any) => MapActions.listSpaces({
            // query: '',
            itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
            pageNumber: 1,
            filterBy: 'distance',
            latitude: DEFAULT_LATITUDE,
            longitude: DEFAULT_LONGITUDE,
        }, {
            distanceOverride: 40075 * (1000 / 2), // estimated half distance around world in meters
        })(dispatch),
    },
    {
        path: '/locations/:pageNumber',
        element: <ListSpaces />,
        fetchData: (dispatch: any, params: any) => MapActions.listSpaces({
            // query: '',
            itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
            pageNumber: 1,
            filterBy: 'distance',
            latitude: DEFAULT_LATITUDE,
            longitude: DEFAULT_LONGITUDE,
        }, {
            distanceOverride: 40075 * (1000 / 2), // estimated half distance around world in meters
        })(dispatch),
    },
    {
        path: '/spaces/:spaceId',
        element: <ViewSpace />,
        fetchData: (dispatch: any, params: any) => MapActions.getSpaceDetails(params.spaceId, {
            withMedia: true,
            withUser: true,
            withRatings: true,
        })(dispatch),
    },
    {
        path: '/users/:userId',
        element: <ViewUser onInitMessaging={routePropsConfig.onInitMessaging} />,
        fetchData: (dispatch: any, params: any) => UsersActions.get(params.userId)(dispatch),
    },

    // If no route matches, return NotFound component
    {
        path: '*',
        element: <PageNotFound />,
    },
];

export default getRoutes;
