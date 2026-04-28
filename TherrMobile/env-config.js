const { Platform } = require('react-native');
const { CURRENT_BRAND_VARIATION } = require('./main/config/brandConfig');
const { BrandVariations } = require('therr-js-utilities/constants');

const apiGatewayPort = 7770;
const websocketPort = 7743;
// const hostDev = '192.168.1.148'; // Must use computer's ip address for dev (physical device) to connect socket.io
// 10.0.2.2 is Android emulator alias for host localhost; iOS simulator uses localhost directly
const hostDev = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const hostProd = 'therr.com';
const googleOAuth2WebClientId = '718962923226-k1ejo7drgp89h7b375ifkda4l1vapevr.apps.googleusercontent.com';

// Base feature flag defaults (Therr / core app behavior)
const baseFeatureFlags = {
    // Navigation Tabs
    ENABLE_AREAS: true,
    ENABLE_GROUPS: true,
    ENABLE_MAP: true,
    ENABLE_CONNECT: true,

    // Content Types
    ENABLE_MOMENTS: true,
    ENABLE_SPACES: true,
    ENABLE_EVENTS: true,
    ENABLE_THOUGHTS: true,

    // Social Features
    ENABLE_DIRECT_MESSAGING: true,
    ENABLE_ACHIEVEMENTS: true,
    ENABLE_ACTIVITIES: true,
    ENABLE_NOTIFICATIONS: true,

    // Groups Features
    ENABLE_FORUMS: true,
    ENABLE_ACTIVITY_SCHEDULER: true,

    // HABITS App Features
    ENABLE_HABITS: false,
    ENABLE_PACTS: false,
    REQUIRE_PACT_ONBOARDING: false,

    // Search Providers
    ENABLE_MAPBOX_SEARCH: false,

    // Monetization
    ENABLE_COIN_RECHARGE: false,
};

// Per-brand overrides applied on top of baseFeatureFlags
const brandFeatureFlagOverrides = {
    [BrandVariations.THERR]: {},
    [BrandVariations.TEEM]: {},
    [BrandVariations.HABITS]: {
        // Disable Therr-centric nav + content
        ENABLE_AREAS: false,
        ENABLE_GROUPS: false,
        ENABLE_MAP: false,
        ENABLE_MOMENTS: false,
        ENABLE_SPACES: false,
        ENABLE_EVENTS: false,
        // Thoughts backend powers the HABITS "Goals" feed (brand-scoped server-side).
        // Keep this enabled so EditThought / ViewThought routes are reachable.
        ENABLE_THOUGHTS: true,
        ENABLE_ACTIVITIES: false,
        ENABLE_ACTIVITY_SCHEDULER: false,
        ENABLE_FORUMS: false,
        ENABLE_COIN_RECHARGE: false,
        ENABLE_MAPBOX_SEARCH: false,

        // Enable HABITS-specific flow
        ENABLE_HABITS: true,
        ENABLE_PACTS: true,
        REQUIRE_PACT_ONBOARDING: true,
    },
};

const featureFlags = {
    ...baseFeatureFlags,
    ...(brandFeatureFlagOverrides[CURRENT_BRAND_VARIATION] || {}),
};

// TODO: Find a way to import this from global config
module.exports = {
    development: {
        baseApiGatewayRoute: `http://${hostDev}:${apiGatewayPort}/v1`,
        baseSocketUrl: `http://${hostDev}:${websocketPort}`,
        baseImageKitEndpoint: 'https://ik.imagekit.io/qmtvldd7sl/dev/',
        googleAnalyticsKey: '',
        googleAnalyticsKeyDashboard: '',
        googleOAuth2WebClientId,
        googleOAuth2WebClientIdAndroid: '718962923226-k1ejo7drgp89h7b375ifkda4l1vapevr.apps.googleusercontent.com',
        googleOAuth2WebClientIdiOS: '718962923226-os68t9a1pi6giap1l447r3vtshf2ie3c.apps.googleusercontent.com',
        host: hostDev,
        socket: {
            clientPath: '/socketio',
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 15,
            userSocketSessionExpire: 1000 * 60 * 30,
        },
        superAdminId: '04e65180-3cff-48b1-988f-4b6e0ab25def',
        featureFlags,
    },
    production: {
        baseApiGatewayRoute: `https://api.${hostProd}/v1`,
        baseSocketUrl: `https://websocket-service.${hostProd}`,
        baseImageKitEndpoint: 'https://ik.imagekit.io/qmtvldd7sl/',
        googleAnalyticsKey: '',
        googleAnalyticsKeyDashboard: '',
        googleOAuth2WebClientId,
        // Implement these along with server side logic to select the corresponding "audience" (ie. android, ios, web client_id)
        googleOAuth2WebClientIdAndroid: '718962923226-k1ejo7drgp89h7b375ifkda4l1vapevr.apps.googleusercontent.com',
        googleOAuth2WebClientIdiOS: '718962923226-1rhet8adgsvuviutj7ja2006bhcncr87.apps.googleusercontent.com',
        host: hostProd,
        hostFull: `https://${hostProd}`,
        socket: {
            clientPath: '/socketio',
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 30,
        },
        superAdminId: '568bf5d2-8595-4fd6-95da-32cc318618d3',
        featureFlags,
    },
};
