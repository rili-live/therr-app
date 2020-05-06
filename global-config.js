const apiMessagesPort = 7771;
const apiUsersPort = 7770;
const hostDev = 'localhost';
const hostStage = 'stage.rili.network';
const hostProd = 'rili.network';

module.exports = {
    development: {
        baseMessagesServiceRoute: `/v1`,
        baseUsersServiceRoute: `/v1`,
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
        baseMessagesServiceRoute: `/api-messages/v1`,
        baseUsersServiceRoute: `/api-users/v1`,
        baseSocketUrl: `https://${hostStage}`,
        googleAnalyticsKey: '',
        host: hostStage,
        socket: {
            clientPath: '/ws/socketio',
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 30,
        },
    },
    production: {
        baseMessagesServiceRoute: `/api-messages/v1`,
        baseUsersServiceRoute: `/api-users/v1`,
        baseSocketUrl: `https://${hostProd}`,
        googleAnalyticsKey: '',
        host: hostProd,
        socket: {
            clientPath: '/ws/socketio',
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 30,
        },
    },
};
