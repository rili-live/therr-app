import * as React from 'react';
import { RouteObject } from 'react-router-dom';
import { AccessCheckType, IAccess } from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import { AuthRoute } from 'therr-react/components';
import { ForumActions, MapActions } from 'therr-react/redux/actions';
import UsersActions from '../redux/actions/UsersActions';
import CreateForum from './CreateForum';
import ViewGroup from './ViewGroup';
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
import EditProfile from './EditProfile';
import EditSpace from './EditSpace';
import CreateSpace from './CreateSpace';
import ManageSpaces from './ManageSpaces';
import Bookmarks from './Bookmarks';
import Discovered from './Discovered';
import Explore from './Explore';
import ExploreMoments from './Explore/ExploreMoments';
import ExploreThoughts from './Explore/ExploreThoughts';
import ExplorePeople from './Explore/ExplorePeople';
import UnderConstruction from './UnderConstruction';
import ViewEvent from './ViewEvent';
import ViewMoment from './ViewMoment';
import ViewThought from './ViewThought';
import ViewUser from './ViewUser';
import UserLocations from './UserLocations';
import EmailPreferences from './EmailPreferences';
import AppFeedback from './AppFeedback';
import ChildSafety from './ChildSafety';
import DeleteAccount from './DeleteAccount';
import InviteLanding from './InviteLanding';

export type IRoute = RouteObject & {
    access?: IAccess;
    fetchData?: (dispatch: any, params?: { [key: string]: any }, query?: { [key: string]: any }) => Promise<any>;
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
        path: '/groups/:groupId',
        element: <ViewGroup />,
        fetchData: (dispatch: any, params: any) => ForumActions.getForumDetails(params.groupId)(dispatch),
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
        path: '/child-safety',
        element: <ChildSafety />,
    },
    {
        path: '/delete-account',
        element: <DeleteAccount />,
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
        path: '/invite/:username',
        element: <InviteLanding />,
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
        path: '/user/edit-profile',
        element: <AuthRoute
            render={() => <EditProfile />}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/spaces/manage',
        element: <AuthRoute
            component={ManageSpaces}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/spaces/new',
        element: <AuthRoute
            component={CreateSpace}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/spaces/:spaceId/edit',
        element: <AuthRoute
            component={EditSpace}
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
        path: '/bookmarks',
        element: <AuthRoute
            component={Bookmarks}
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
        path: '/thoughts/:thoughtId',
        element: <ViewThought />,
        // TODO: Add fetchData once getThoughtDetails API supports unauthenticated access (like moments/spaces)
        // The SSR template (thoughts.hbs) and renderThoughtView are ready for when the endpoint is public
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
        fetchData: (dispatch: any, params: any, query: any = {}) => {
            const lat = parseFloat(query.lat) || DEFAULT_LATITUDE;
            const lng = parseFloat(query.lng) || DEFAULT_LONGITUDE;
            const radius = parseFloat(query.r) || 40075 * (1000 / 2);
            const searchQuery = query.q || '';
            const hasCoords = !Number.isNaN(parseFloat(query.lat)) && !Number.isNaN(parseFloat(query.lng));
            const queryParams: any = {
                itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
                pageNumber: 1,
                latitude: lat,
                longitude: lng,
                filterBy: 'distance',
            };
            // Only use text search when there's a query but no geocoded coordinates
            if (searchQuery && !hasCoords) {
                queryParams.filterBy = 'notificationMsg';
                queryParams.filterOperator = 'ilike';
                queryParams.query = searchQuery;
            }
            return MapActions.listSpaces(queryParams, {
                distanceOverride: radius,
            })(dispatch);
        },
    },
    {
        path: '/locations/:pageNumber',
        element: <ListSpaces />,
        fetchData: (dispatch: any, params: any, query: any = {}) => {
            const lat = parseFloat(query.lat) || DEFAULT_LATITUDE;
            const lng = parseFloat(query.lng) || DEFAULT_LONGITUDE;
            const radius = parseFloat(query.r) || 40075 * (1000 / 2);
            const searchQuery = query.q || '';
            const hasCoords = !Number.isNaN(parseFloat(query.lat)) && !Number.isNaN(parseFloat(query.lng));
            const pageNumber = parseInt(params.pageNumber || '1', 10);
            const queryParams: any = {
                itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
                pageNumber,
                latitude: lat,
                longitude: lng,
                filterBy: 'distance',
            };
            if (searchQuery && !hasCoords) {
                queryParams.filterBy = 'notificationMsg';
                queryParams.filterOperator = 'ilike';
                queryParams.query = searchQuery;
            }
            return MapActions.listSpaces(queryParams, {
                distanceOverride: radius,
            })(dispatch);
        },
    },
    {
        path: '/events/:eventId',
        element: <ViewEvent />,
        fetchData: (dispatch: any, params: any) => MapActions.getEventDetails(params.eventId, {
            withMedia: true,
            withUser: true,
            withRatings: true,
        })(dispatch),
    },
    {
        path: '/spaces/:spaceId',
        element: <ViewSpace />,
        fetchData: (dispatch: any, params: any) => MapActions.getSpaceDetails(params.spaceId, {
            withMedia: true,
            withUser: true,
            withRatings: true,
            withEvents: true,
        })(dispatch),
    },
    {
        path: '/users/:userId/locations',
        element: <UserLocations />,
        fetchData: (dispatch: any, params: any) => UsersActions.get(params.userId)(dispatch),
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
