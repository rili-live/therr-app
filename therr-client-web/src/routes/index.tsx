import * as React from 'react';
import { RouteObject } from 'react-router-dom';
import { AccessCheckType, IAccess } from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import { AuthRoute } from 'therr-react/components';
import { ForumActions, MapActions } from 'therr-react/redux/actions';
import UsersActions from '../redux/actions/UsersActions';

// SSR-rendered / public routes — keep statically imported for renderToString compatibility
import ListGroups from './ListGroups';
import ViewGroup from './ViewGroup';
import EmailVerification from './EmailVerification';
import PageNotFound from './PageNotFound';
import Register from './Register';
import ResetPassword from './ResetPassword';
import Home from './Home';
import ViewSpace from './ViewSpace';
import Login from './Login';
import ListSpaces, { DEFAULT_ITEMS_PER_PAGE, DEFAULT_LATITUDE, DEFAULT_LONGITUDE } from './ListSpaces';
import ViewEvent from './ViewEvent';
import ViewMoment from './ViewMoment';
import ViewThought from './ViewThought';
import ViewUser from './ViewUser';
import AppFeedback from './AppFeedback';
import ChildSafety from './ChildSafety';
import DeleteAccount from './DeleteAccount';
import InviteLanding from './InviteLanding';

// Auth-only routes — lazy-loaded client-side to reduce initial bundle size
// These are never SSR-rendered (they redirect unauthenticated users to /login)
// Uses the same typeof window guard pattern as SpacesMap (see ListSpaces.tsx)
const lazyLoad = (importFn: () => Promise<{ default: React.ComponentType<any> }>) => (
    typeof window !== 'undefined' ? React.lazy(importFn) : (() => null) as unknown as React.LazyExoticComponent<any>
);

const CreateForum = lazyLoad(() => import('./CreateForum'));
const EditGroup = lazyLoad(() => import('./EditGroup'));
const CreateProfile = lazyLoad(() => import('./CreateProfile'));
const UserProfile = lazyLoad(() => import('./UserProfile'));
const ChangePassword = lazyLoad(() => import('./ChangePassword'));
const EditProfile = lazyLoad(() => import('./EditProfile'));
const EditSpace = lazyLoad(() => import('./EditSpace'));
const CreateSpace = lazyLoad(() => import('./CreateSpace'));
const ManageSpaces = lazyLoad(() => import('./ManageSpaces'));
const Bookmarks = lazyLoad(() => import('./Bookmarks'));
const Discovered = lazyLoad(() => import('./Discovered'));
const Explore = lazyLoad(() => import('./Explore'));
const ExploreMoments = lazyLoad(() => import('./Explore/ExploreMoments'));
const ExploreThoughts = lazyLoad(() => import('./Explore/ExploreThoughts'));
const ExplorePeople = lazyLoad(() => import('./Explore/ExplorePeople'));
const UnderConstruction = lazyLoad(() => import('./UnderConstruction'));
const UserLocations = lazyLoad(() => import('./UserLocations'));
const EmailPreferences = lazyLoad(() => import('./EmailPreferences'));

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
        path: '/groups',
        element: <ListGroups />,
        fetchData: (dispatch: any) => ForumActions.searchForums({
            itemsPerPage: 50,
            pageNumber: 1,
            order: 'desc',
        }, {})(dispatch),
    },
    {
        path: '/groups/:groupId/edit',
        element: <AuthRoute
            component={EditGroup}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
        fetchData: (dispatch: any, params: any) => ForumActions.getForumDetails(params.groupId)(dispatch),
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
