import Categories from './Categories';
import Cities from './Cities';
import Content from './Content';
import ErrorCodes from './ErrorCodes';
import FilePaths from './FilePaths';
import Location from './Location';
import Reactions from './Reactions';
import LogLevelMap, { ILogLevel } from './LogLevelMap';
import {
    CurrentSocialValuations,
    CurrentMomentValuations,
    CurrentCheckInValuations,
    ReferralRewards,
} from './Currencies';
import {
    COIN_PACKAGES,
    COIN_PACKAGE_IDS,
    CoinPackageId,
    ICoinPackage,
    getCoinPackageById,
} from './CoinPackages';
import OAuthIntegrationProviders from './OAuthIntegrationProviders';
import {
    DefaultUserResources,
    ResourceExchangeRates,
} from './Resources';
import {
    JWT_ISSUER,
    JWT_AUDIENCE,
    hasValidStandardClaims,
} from './jwt';

// Enums
import AccessLevels from './enums/AccessLevels';
import {
    BrandVariations,
} from './enums/Branding';
import {
    BRAND_THOUGHTS_VISIBILITY,
    getReadableBrands,
} from './brandThoughtsVisibility';
import {
    BRAND_NAMES,
    DEFAULT_BRAND_NAME,
    getBrandName,
} from './brandNames';
import {
    IBrandAppStore,
    APP_STORES_BY_BRAND,
    getBrandAppStore,
    getPlayStoreUrl,
    getAppStoreUrl,
} from './brandAppStores';
import {
    PhoneAccountType,
    PHONE_ACCOUNT_TYPES,
    MAX_ACCOUNTS_PER_PHONE_BY_BRAND,
    DEFAULT_MAX_ACCOUNTS_PER_PHONE,
    getMaxAccountsPerPhone,
    getPhoneAccountType,
    getAvailablePhoneAccountTypes,
} from './phoneAccounts';
import {
    FeatureFlags,
    HABITS_FREE_HABIT_LIMIT,
    DEFAULT_HABITS_FREE_HABIT_LIMIT,
    HABITS_SOLO_UNLOCK_INVITE_COUNT,
    DEFAULT_HABITS_SOLO_UNLOCK_INVITE_COUNT,
    HABITS_LIFETIME_FOUNDER_LIMIT,
    DEFAULT_HABITS_LIFETIME_FOUNDER_LIMIT,
} from './enums/FeatureFlags';
import {
    HABITS_PREMIUM_ACCESS_LEVELS,
    hasHabitsPremiumEntitlement,
} from './habitsEntitlements';
import {
    HabitGoalTypes,
    HabitGoalType,
} from './enums/HabitGoalTypes';
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
    BRAND_THOUGHTS_VISIBILITY,
    BRAND_NAMES,
    DEFAULT_BRAND_NAME,
    getBrandName,
    IBrandAppStore,
    APP_STORES_BY_BRAND,
    getBrandAppStore,
    getPlayStoreUrl,
    getAppStoreUrl,
    getReadableBrands,
    FeatureFlags,
    HABITS_FREE_HABIT_LIMIT,
    DEFAULT_HABITS_FREE_HABIT_LIMIT,
    HABITS_SOLO_UNLOCK_INVITE_COUNT,
    DEFAULT_HABITS_SOLO_UNLOCK_INVITE_COUNT,
    HABITS_LIFETIME_FOUNDER_LIMIT,
    DEFAULT_HABITS_LIFETIME_FOUNDER_LIMIT,
    HABITS_PREMIUM_ACCESS_LEVELS,
    hasHabitsPremiumEntitlement,
    HabitGoalTypes,
    HabitGoalType,
    CampaignTypes,
    CampaignAdGoals,
    CampaignAssetTypes,
    CampaignStatuses,
    CurrencyTransactionMessages,
    GroupMemberRoles,
    GroupRequestStatuses,
    Categories,
    Cities,
    Content,
    ErrorCodes,
    FilePaths,
    IncentiveRequirementKeys,
    IncentiveRewardKeys,
    MetricNames,
    MetricValueTypes,
    Location,
    Reactions,
    ILogLevel,
    LogLevelMap,
    Notifications,
    OAuthIntegrationProviders,
    PushNotifications,
    PasswordRegex,
    PhoneAccountType,
    PHONE_ACCOUNT_TYPES,
    MAX_ACCOUNTS_PER_PHONE_BY_BRAND,
    DEFAULT_MAX_ACCOUNTS_PER_PHONE,
    getMaxAccountsPerPhone,
    getPhoneAccountType,
    getAvailablePhoneAccountTypes,
    CurrentSocialValuations,
    CurrentMomentValuations,
    CurrentCheckInValuations,
    ReferralRewards,
    COIN_PACKAGES,
    COIN_PACKAGE_IDS,
    CoinPackageId,
    ICoinPackage,
    getCoinPackageById,
    DefaultUserResources,
    ResourceExchangeRates,
    SocketClientActionTypes,
    SocketServerActionTypes,
    UserConnectionTypes,
    JWT_ISSUER,
    JWT_AUDIENCE,
    hasValidStandardClaims,
};
