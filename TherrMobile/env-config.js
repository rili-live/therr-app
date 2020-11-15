const apiGatewayPort = 7770;
const apiMapsPort = 7773;
const apiMessagesPort = 7772;
const apiUsersPort = 7771;
const websocketPort = 7743;
const hostDev = '192.168.127.142'; // Must use computer's ip address for dev to connect socket.io
const hostStage = 'stage.therr.app';
const hostProd = 'therr.app';

// TODO: Find a way to import this from global config
module.exports = {
    development: {
        baseApiGatewayRoute: `http://${hostDev}:${apiGatewayPort}/v1`,
        baseMapsServiceRoute: `http://${hostDev}:${apiMapsPort}/v1`,
        baseMessagesServiceRoute: `http://${hostDev}:${apiMessagesPort}/v1`,
        baseUsersServiceRoute: `http://${hostDev}:${apiUsersPort}/v1`,
        baseSocketUrl: `http://${hostDev}:${websocketPort}`,
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
        baseMapsServiceRoute: `https://maps-service.${hostStage}/v1`,
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
        baseApiGatewayRoute: `https://api.${hostProd}/v1`,
        baseMapsServiceRoute: `https://maps-service.${hostProd}/v1`,
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
