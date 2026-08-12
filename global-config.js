const apiGatewayPort = 7770;
const apiUsersPort = 7771;
const apiMessagesPort = 7772;
const apiMapsPort = 7773;
const apiReactionsPort = 7774;
const apiPushNotificationsPort = 7775;
const clientPort = 7070;
const dashboardClientPort = 7071;
const websocketPort = 7743;
const hostDev = '127.0.0.1';
// Docker development uses service names for inter-container communication
// Safe check for browser environments where process is undefined
const isDockerDev = typeof process !== 'undefined' && process.env && process.env.DOCKER_DEV === 'true';
const hostStage = 'stage.therr.com';
const dashboardHostStage = 'stage.dashboard.therr.com';
const hostProd = 'therr.com';
const dashboardHostProd = 'dashboard.therr.com';
const googleOAuth2WebClientId = '718962923226-k1ejo7drgp89h7b375ifkda4l1vapevr.apps.googleusercontent.com';

module.exports = {
    any: {
        googleOAuth2WebClientId
    },
    development: {
        // For client-side (browser) requests, always use hostDev (localhost/127.0.0.1)
        // For server-side (inter-service) requests in Docker, use container names
        baseApiGatewayRoute: `http://${hostDev}:${apiGatewayPort}/v1`,
        baseMapsServiceRoute: isDockerDev ? `http://maps-service:${apiMapsPort}/v1` : `http://${hostDev}:${apiMapsPort}/v1`,
        baseMessagesServiceRoute: isDockerDev ? `http://messages-service:${apiMessagesPort}/v1` : `http://${hostDev}:${apiMessagesPort}/v1`,
        basePushNotificationsServiceRoute: isDockerDev ? `http://push-notifications-service:${apiPushNotificationsPort}/v1` : `http://${hostDev}:${apiPushNotificationsPort}/v1`,
        baseReactionsServiceRoute: isDockerDev ? `http://reactions-service:${apiReactionsPort}/v1` : `http://${hostDev}:${apiReactionsPort}/v1`,
        baseSocketUrl: `http://${hostDev}:${websocketPort}`,
        baseWebsocketServiceRoute: isDockerDev ? `http://websocket-service:${websocketPort}` : `http://${hostDev}:${websocketPort}`,
        baseUsersServiceRoute: isDockerDev ? `http://users-service:${apiUsersPort}/v1` : `http://${hostDev}:${apiUsersPort}/v1`,
        baseImageKitEndpoint: 'https://ik.imagekit.io/qmtvldd7sl/dev/',
        googleAnalyticsKey: 'G-WNB4XQ8W1Z',
        googleAnalyticsKeyDashboard: 'G-Z8R2CE2Z7C',
        // The consolidated GA4 property (Phase 4 of docs/MARKETING_ATTRIBUTION_PLAN.md).
        // While empty, each client reports only into its existing property. Set it and every
        // client sends to BOTH — the parallel run the migration needs, since GA4 cannot
        // backfill history across properties. Remove the old keys only after the new
        // property has a usable window of data.
        //
        // This must be the **Measurement ID** — `G-` followed by 10 alphanumerics, found at
        // Admin -> Data streams -> (the web stream) -> Measurement ID. It is NOT the numeric
        // Property ID on the property settings page (that one is for the Data API and the
        // analytics MCP). gtag accepts any string here and silently collects nothing for an
        // id it does not recognize, so a wrong value looks identical to a working one until
        // someone checks Realtime and finds it empty.
        googleAnalyticsKeyUnified: 'G-R7CY0Z1ZRM',
        // Stripe Checkout Sessions (POST /v1/users-service/payments/checkout/sessions)
        // instead of the hardcoded Payment Links. Off in production until the
        // plan -> product id map in
        // users-service/src/handlers/helpers/checkoutSessionPlans.ts is
        // confirmed against the Stripe dashboard: a wrong id there charges a
        // customer for a plan they did not pick.
        isStripeCheckoutSessionsEnabled: true,
        googleOAuth2WebClientId,
        googleOAuth2WebClientIdAndroid: '718962923226-k1ejo7drgp89h7b375ifkda4l1vapevr.apps.googleusercontent.com',
        googleOAuth2WebClientIdiOS: '718962923226-os68t9a1pi6giap1l447r3vtshf2ie3c.apps.googleusercontent.com',
        host: hostDev,
        hostFull: `http://${hostDev}:${clientPort}`,
        dashboardHost: hostDev,
        dashboardHostFull: `http://${hostDev}:${dashboardClientPort}`,
        socket: {
            clientPath: '/socketio',
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 15,
            userSocketSessionExpire: 1000 * 60 * 30,
        },
        tempLocationExpansionDistMeters: 100000,
    },
    stage: {
        baseApiGatewayRoute: `https://api.${hostStage}/v1`,
        baseMapsServiceRoute: `http://maps-service-cluster-ip-service:${apiMapsPort}/v1`,
        baseMessagesServiceRoute: `http://messages-service-cluster-ip-service:${apiMessagesPort}/v1`,
        basePushNotificationsServiceRoute: `http://push-notifications-service-cluster-ip-service:${apiPushNotificationsPort}/v1`,
        baseReactionsServiceRoute: `http://reactions-service-cluster-ip-service:${apiReactionsPort}/v1`,
        baseSocketUrl: `https://websocket-service.${hostStage}`,
        baseWebsocketServiceRoute: `http://websocket-service-cluster-ip-service:${websocketPort}`,
        baseUsersServiceRoute: `http://users-service-cluster-ip-service:${apiUsersPort}/v1`,
        baseImageKitEndpoint: 'https://ik.imagekit.io/qmtvldd7sl/',
        googleAnalyticsKey: 'G-WNB4XQ8W1Z',
        googleAnalyticsKeyDashboard: 'G-Z8R2CE2Z7C',
        // The consolidated GA4 property (Phase 4 of docs/MARKETING_ATTRIBUTION_PLAN.md).
        // While empty, each client reports only into its existing property. Set it and every
        // client sends to BOTH — the parallel run the migration needs, since GA4 cannot
        // backfill history across properties. Remove the old keys only after the new
        // property has a usable window of data.
        //
        // This must be the **Measurement ID** — `G-` followed by 10 alphanumerics, found at
        // Admin -> Data streams -> (the web stream) -> Measurement ID. It is NOT the numeric
        // Property ID on the property settings page (that one is for the Data API and the
        // analytics MCP). gtag accepts any string here and silently collects nothing for an
        // id it does not recognize, so a wrong value looks identical to a working one until
        // someone checks Realtime and finds it empty.
        googleAnalyticsKeyUnified: 'G-R7CY0Z1ZRM',
        // Stripe Checkout Sessions (POST /v1/users-service/payments/checkout/sessions)
        // instead of the hardcoded Payment Links. Off in production until the
        // plan -> product id map in
        // users-service/src/handlers/helpers/checkoutSessionPlans.ts is
        // confirmed against the Stripe dashboard: a wrong id there charges a
        // customer for a plan they did not pick.
        isStripeCheckoutSessionsEnabled: true,
        googleOAuth2WebClientId,
        googleOAuth2WebClientIdAndroid: '718962923226-k1ejo7drgp89h7b375ifkda4l1vapevr.apps.googleusercontent.com',
        googleOAuth2WebClientIdiOS: '718962923226-os68t9a1pi6giap1l447r3vtshf2ie3c.apps.googleusercontent.com',
        host: hostStage,
        hostFull: `https://${hostStage}`,
        dashboardHost: dashboardHostStage,
        dashboardHostFull: `http://${dashboardHostStage}`,
        socket: {
            clientPath: '/socketio',
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 30,
        },
        tempLocationExpansionDistMeters: 100000, 
    },
    production: {
        baseApiGatewayRoute: `https://api.${hostProd}/v1`,
        baseMapsServiceRoute: `http://maps-service-cluster-ip-service:${apiMapsPort}/v1`,
        baseMessagesServiceRoute: `http://messages-service-cluster-ip-service:${apiMessagesPort}/v1`,
        basePushNotificationsServiceRoute: `http://push-notifications-service-cluster-ip-service:${apiPushNotificationsPort}/v1`,
        baseReactionsServiceRoute: `http://reactions-service-cluster-ip-service:${apiReactionsPort}/v1`,
        baseSocketUrl: `https://websocket-service.${hostProd}`,
        baseWebsocketServiceRoute: `http://websocket-service-cluster-ip-service:${websocketPort}`,
        baseUsersServiceRoute: `http://users-service-cluster-ip-service:${apiUsersPort}/v1`,
        baseImageKitEndpoint: 'https://ik.imagekit.io/qmtvldd7sl/',
        googleAnalyticsKey: 'G-WNB4XQ8W1Z',
        googleAnalyticsKeyDashboard: 'G-Z8R2CE2Z7C',
        // The consolidated GA4 property (Phase 4 of docs/MARKETING_ATTRIBUTION_PLAN.md).
        // While empty, each client reports only into its existing property. Set it and every
        // client sends to BOTH — the parallel run the migration needs, since GA4 cannot
        // backfill history across properties. Remove the old keys only after the new
        // property has a usable window of data.
        //
        // This must be the **Measurement ID** — `G-` followed by 10 alphanumerics, found at
        // Admin -> Data streams -> (the web stream) -> Measurement ID. It is NOT the numeric
        // Property ID on the property settings page (that one is for the Data API and the
        // analytics MCP). gtag accepts any string here and silently collects nothing for an
        // id it does not recognize, so a wrong value looks identical to a working one until
        // someone checks Realtime and finds it empty.
        googleAnalyticsKeyUnified: 'G-R7CY0Z1ZRM',
        // Stripe Checkout Sessions (POST /v1/users-service/payments/checkout/sessions)
        // instead of the hardcoded Payment Links. Off in production until the
        // plan -> product id map in
        // users-service/src/handlers/helpers/checkoutSessionPlans.ts is
        // confirmed against the Stripe dashboard: a wrong id there charges a
        // customer for a plan they did not pick.
        isStripeCheckoutSessionsEnabled: true,
        googleOAuth2WebClientId,
        // Implement these along with server side logic to select the corresponding "audience" (ie. android, ios, web client_id)
        googleOAuth2WebClientIdAndroid: '718962923226-k1ejo7drgp89h7b375ifkda4l1vapevr.apps.googleusercontent.com',
        googleOAuth2WebClientIdiOS: '718962923226-1rhet8adgsvuviutj7ja2006bhcncr87.apps.googleusercontent.com',
        host: hostProd,
        hostFull: `https://${hostProd}`,
        dashboardHost: dashboardHostProd,
        dashboardHostFull: `https://${dashboardHostProd}`,
        socket: {
            clientPath: '/socketio',
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 30,
        },
        tempLocationExpansionDistMeters: 100000, 
    },
};

