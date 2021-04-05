const apiGatewayPort = 7770;
const apiUsersPort = 7771;
const apiMessagesPort = 7772;
const apiMapsPort = 7773;
const apiReactionsPort = 7774;
const apiPushNotificationsPort = 7775;
const websocketPort = 7743;
const hostDev = '192.168.1.70'; // Must use computer's ip address for dev to connect socket.io
const hostStage = 'stage.therr.com';
const hostProd = 'therr.com';

// TODO: Find a way to import this from global config
module.exports = {
    development: {
        baseApiGatewayRoute: `http://${hostDev}:${apiGatewayPort}/v1`,
        baseMapsServiceRoute: `http://${hostDev}:${apiMapsPort}/v1`,
        baseMessagesServiceRoute: `http://${hostDev}:${apiMessagesPort}/v1`,
        basePushNotificationsServiceRoute: `http://${hostDev}:${apiPushNotificationsPort}/v1`,
        baseReactionsServiceRoute: `http://${hostDev}:${apiReactionsPort}/v1`,
        baseSocketUrl: `http://${hostDev}:${websocketPort}`,
        baseUsersServiceRoute: `http://${hostDev}:${apiUsersPort}/v1`,
        googleAnalyticsKey: '',
        host: hostDev,
        socket: {
            clientPath: '/socketio',
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 15,
            userSocketSessionExpire: 1000 * 60 * 30,
        },
    },
    stage: {
        baseApiGatewayRoute: `https://api.${hostStage}/v1`,
        baseMapsServiceRoute: `http://maps-service-cluster-ip-service:${apiMapsPort}/v1`,
        baseMessagesServiceRoute: `http://messages-service-cluster-ip-service:${apiMessagesPort}/v1`,
        basePushNotificationsServiceRoute: `http://push-notifications-service-cluster-ip-service:${apiPushNotificationsPort}/v1`,
        baseReactionsServiceRoute: `http://reactions-service-cluster-ip-service:${apiReactionsPort}/v1`,
        baseSocketUrl: `https://websocket-service.${hostStage}`,
        baseUsersServiceRoute: `http://users-service-cluster-ip-service:${apiUsersPort}/v1`,
        googleAnalyticsKey: '',
        host: hostStage,
        socket: {
            clientPath: '/socketio',
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 30,
        },
    },
    production: {
        baseApiGatewayRoute: `https://api.${hostProd}/v1`,
        baseMapsServiceRoute: `http://maps-service-cluster-ip-service:${apiMapsPort}/v1`,
        baseMessagesServiceRoute: `http://messages-service-cluster-ip-service:${apiMessagesPort}/v1`,
        baseReactionsServiceRoute: `http://reactions-service-cluster-ip-service:${apiReactionsPort}/v1`,
        baseSocketUrl: `https://websocket-service.${hostProd}`,
        baseUsersServiceRoute: `http://users-service-cluster-ip-service:${apiUsersPort}/v1`,
        googleAnalyticsKey: '',
        host: hostProd,
        hostFull: `https://${hostProd}`,
        socket: {
            clientPath: '/socketio',
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 30,
        },
    },
};
