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
        baseUsersServiceRoute: isDockerDev ? `http://users-service:${apiUsersPort}/v1` : `http://${hostDev}:${apiUsersPort}/v1`,
        baseImageKitEndpoint: 'https://ik.imagekit.io/qmtvldd7sl/dev/',
        googleAnalyticsKey: 'G-WNB4XQ8W1Z',
        googleAnalyticsKeyDashboard: 'G-Z8R2CE2Z7C',
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
        baseUsersServiceRoute: `http://users-service-cluster-ip-service:${apiUsersPort}/v1`,
        baseImageKitEndpoint: 'https://ik.imagekit.io/qmtvldd7sl/',
        googleAnalyticsKey: 'G-WNB4XQ8W1Z',
        googleAnalyticsKeyDashboard: 'G-Z8R2CE2Z7C',
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
        baseUsersServiceRoute: `http://users-service-cluster-ip-service:${apiUsersPort}/v1`,
        baseImageKitEndpoint: 'https://ik.imagekit.io/qmtvldd7sl/',
        googleAnalyticsKey: 'G-WNB4XQ8W1Z',
        googleAnalyticsKeyDashboard: 'G-Z8R2CE2Z7C',
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

