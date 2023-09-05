const apiGatewayPort = 7770;
const websocketPort = 7743;
const hostDev = '192.168.1.91'; // Must use computer's ip address for dev to connect socket.io
const hostProd = 'therr.com';
const googleOAuth2WebClientId = '718962923226-k1ejo7drgp89h7b375ifkda4l1vapevr.apps.googleusercontent.com';

// TODO: Find a way to import this from global config
module.exports = {
    development: {
        baseApiGatewayRoute: `http://${hostDev}:${apiGatewayPort}/v1`,
        baseSocketUrl: `http://${hostDev}:${websocketPort}`,
        googleAnalyticsKey: '',
        googleAnalyticsKeyDashboard: '',
        googleOAuth2WebClientId,
        googleOAuth2WebClientIdAndroid: '718962923226-1jre766n68je599ipnk1v6nj8qrgob2o.apps.googleusercontent.com',
        googleOAuth2WebClientIdiOS: '718962923226-os68t9a1pi6giap1l447r3vtshf2ie3c.apps.googleusercontent.com',
        host: hostDev,
        socket: {
            clientPath: '/socketio',
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 15,
            userSocketSessionExpire: 1000 * 60 * 30,
        },
    },
    production: {
        baseApiGatewayRoute: `https://api.${hostProd}/v1`,
        baseSocketUrl: `https://websocket-service.${hostProd}`,
        googleAnalyticsKey: '',
        googleAnalyticsKeyDashboard: '',
        googleOAuth2WebClientId,
        // Implement these along with server side logic to select the corresponding "audience" (ie. android, ios, web client_id)
        googleOAuth2WebClientIdAndroid: '718962923226-agdagas2o5h8t6jftmkujqp5fm39ccr2.apps.googleusercontent.com',
        googleOAuth2WebClientIdiOS: '718962923226-1rhet8adgsvuviutj7ja2006bhcncr87.apps.googleusercontent.com',
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
