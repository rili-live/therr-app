const apiGatewayPort = 7770;
const apiMessagesPort = 7772;
const apiUsersPort = 7771;
const hostDev = '127.0.0.1';
const hostStage = 'stage.therr.app';
const hostProd = 'therr.app';

module.exports = {
    development: {
        baseApiGatewayPort: `http://${hostDev}:${apiGatewayPort}/v1`,
        baseMessagesServiceRoute: `http://${hostDev}:${apiMessagesPort}/v1`,
        baseUsersServiceRoute: `http://${hostDev}:${apiUsersPort}/v1`,
        baseSocketUrl: `http://${hostDev}:7743`,
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
        baseApiGatewayPort: `https://api.${hostStage}/v1`,
        baseMessagesServiceRoute: `https://messages-service.${hostStage}/v1`,
        baseUsersServiceRoute: `https://users-service.${hostStage}/v1`,
        baseSocketUrl: `https://${hostStage}`,
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
        baseApiGatewayPort: `https://api.${hostProd}/v1`,
        baseMessagesServiceRoute: `https://messages-service.${hostProd}/v1`,
        baseUsersServiceRoute: `https://users-service.${hostProd}/v1`,
        baseSocketUrl: `https://${hostProd}`,
        googleAnalyticsKey: '',
        host: hostProd,
        socket: {
            clientPath: '/socketio',
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 30,
        },
    },
};
