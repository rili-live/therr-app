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
import DocumentationOverview from './Documentation/DocumentationOverview';
import AcquisitionOverview from './CustomerAcquisition/AcquisitionOverview';
import AdminAcquisitionOverview from './CustomerAcquisition/AdminAcquisitionOverview';
import CampaignsOverview from './Campaigns/CampaignsOverview';
import AdminCampaignsOverview from './Campaigns/AdminCampaignsOverview';
import CreateUserProfile from './CreateUserProfile';
import CreateEditCampaign from './Campaigns/CreateEditCampaign';
import InfluencerPairings from './InfluencerPairings';
import OAuth2Landing from './OAuth2Landing';
import PaymentComplete from './PaymentComplete';
import CampaignPerformance from './Campaigns/CampaignPerformance';
import EmailPreferences from './EmailPreferences';

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
        path: '/create-profile',
        element: <AuthRoute
            component={CreateUserProfile}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES],
            }) || (routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED],
            }) && routePropsConfig.isAuthorized({
                type: AccessCheckType.NONE,
                levels: [AccessLevels.MOBILE_VERIFIED],
            }))}
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
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/dashboard-admin',
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
        path: '/campaigns/overview',
        element: <AuthRoute
            component={CampaignsOverview}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ANY,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/login'}
        />,
    },
    {
        path: '/campaigns-admin/overview',
        element: <AuthRoute
            component={AdminCampaignsOverview}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ANY,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.SUPER_ADMIN],
            })}
            redirectPath={'/login'}
        />,
    },
    {
        path: '/campaigns/create',
        element: <AuthRoute
            component={CreateEditCampaign}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/campaigns/:campaignId/edit',
        element: <AuthRoute
            component={CreateEditCampaign}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/campaigns/:campaignId/edit/:context',
        element: <AuthRoute
            component={CreateEditCampaign}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/campaigns/:campaignId/view-results',
        element: <AuthRoute
            component={CampaignPerformance}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/campaigns/:campaignId/view-results/:context',
        element: <AuthRoute
            component={CampaignPerformance}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/customer-acquisition/overview',
        element: <AuthRoute
            component={AcquisitionOverview}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ANY,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/login'}
        />,
    },
    {
        path: '/customer-acquisition-admin/overview',
        element: <AuthRoute
            component={AdminAcquisitionOverview}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ANY,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/login'}
        />,
    },
    {
        path: '/documentation/overview',
        element: <AuthRoute
            component={DocumentationOverview}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ANY,
                levels: [AccessLevels.EMAIL_VERIFIED],
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
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/influencer-pairings',
        element: <AuthRoute
            component={InfluencerPairings}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ANY,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/login'}
        />,
    },
    {
        path: '/spaces/:spaceId/edit',
        element: <AuthRoute
            component={CreateEditSpace}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/spaces/:spaceId/edit/:context',
        element: <AuthRoute
            component={CreateEditSpace}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/spaces',
        element: <AuthRoute
            component={ManageSpaces}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/spaces/:context',
        element: <AuthRoute
            component={ManageSpaces}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ALL,
                levels: [AccessLevels.EMAIL_VERIFIED, AccessLevels.MOBILE_VERIFIED],
            })}
            redirectPath={'/create-profile'}
        />,
    },
    {
        path: '/settings',
        element: <AuthRoute
            component={Settings}
            isAuthorized={routePropsConfig.isAuthorized({
                type: AccessCheckType.ANY,
                levels: [AccessLevels.EMAIL_VERIFIED],
            })}
            redirectPath={'/login'}
        />,
    },
    {
        path: '/oauth2/facebook-instagram',
        element: <OAuth2Landing />,
    },
    {
        path: '/login',
        element: <Login />,
    },
    {
        path: '/payment-complete/:sessionId',
        element: <PaymentComplete />,
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
        path: '/emails/unsubscribe',
        element: <EmailPreferences />,
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
