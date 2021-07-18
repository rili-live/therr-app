const apiGatewayPort = 7770;
const websocketPort = 7743;
const hostDev = '127.0.0.1'; // Must use computer's ip address for dev to connect socket.io
const hostStage = 'stage.therr.com';
const hostProd = 'therr.com';
const googleOAuth2WebClientId = '718962923226-k1ejo7drgp89h7b375ifkda4l1vapevr.apps.googleusercontent.com';

// TODO: Find a way to import this from global config
module.exports = {
    development: {
        baseApiGatewayRoute: `http://${hostDev}:${apiGatewayPort}/v1`,
        baseSocketUrl: `http://${hostDev}:${websocketPort}`,
        googleAnalyticsKey: '',
        googleOAuth2WebClientId,
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
        baseSocketUrl: `https://websocket-service.${hostStage}`,
        googleAnalyticsKey: '',
        googleOAuth2WebClientId,
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
        baseSocketUrl: `https://websocket-service.${hostProd}`,
        googleAnalyticsKey: '',
        googleOAuth2WebClientId,
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
