import Categories from './Categories';
import Content from './Content';
import ErrorCodes from './ErrorCodes';
import FilePaths from './FilePaths';
import Location from './Location';
import LogLevelMap, { ILogLevel } from './LogLevelMap';
import {
    CurrentSocialValuations,
    CurrentMomentValuations,
    CurrentCheckInValuations,
} from './Currencies';
import OAuthIntegrationProviders from './OAuthIntegrationProviders';
import {
    DefaultUserResources,
    ResourceExchangeRates,
} from './Resources';

// Enums
import AccessLevels from './enums/AccessLevels';
import {
    BrandVariations,
} from './enums/Branding';
import CampaignTypes from './enums/CampaignTypes';
import CampaignAdGoals from './enums/CampaignAdGoals';
import CampaignAssetTypes from './enums/CampaignAssetTypes';
import CampaignStatuses from './enums/CampaignStatuses';
import CurrencyTransactionMessages from './enums/CurrencyTransactionMessages';
import GroupMemberRoles from './enums/GroupMemberRoles';
import GroupRequestStatuses from './enums/GroupRequestStatuses';
import IncentiveRequirementKeys from './enums/IncentiveRequirementKeys';
import IncentiveRewardKeys from './enums/IncentiveRewardKeys';
import MetricNames from './enums/MetricNames';
import MetricValueTypes from './enums/MetricValueTypes';
import * as Notifications from './enums/Notifications';
import * as PushNotifications from './enums/PushNotifications';
import SocketClientActionTypes from './enums/SocketClientActionTypes';
import SocketServerActionTypes from './enums/SocketServerActionTypes';
import UserConnectionTypes from './enums/UserConnectionTypes';

const PasswordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;

// If you change these string values, be sure to update the relative enums
// Enumers cannot be build from string concatenation so much be input manually
export const SERVER_PREFIX = 'SERVER';
export const WEB_CLIENT_PREFIX = 'CLIENT';
export const SOCKET_MIDDLEWARE_ACTION = 'action';

export {
    AccessLevels,
    BrandVariations,
    CampaignTypes,
    CampaignAdGoals,
    CampaignAssetTypes,
    CampaignStatuses,
    CurrencyTransactionMessages,
    GroupMemberRoles,
    GroupRequestStatuses,
    Categories,
    Content,
    ErrorCodes,
    FilePaths,
    IncentiveRequirementKeys,
    IncentiveRewardKeys,
    MetricNames,
    MetricValueTypes,
    Location,
    ILogLevel,
    LogLevelMap,
    Notifications,
    OAuthIntegrationProviders,
    PushNotifications,
    PasswordRegex,
    CurrentSocialValuations,
    CurrentMomentValuations,
    CurrentCheckInValuations,
    DefaultUserResources,
    ResourceExchangeRates,
    SocketClientActionTypes,
    SocketServerActionTypes,
    UserConnectionTypes,
};
