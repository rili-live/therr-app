const apiPort = 7770;
const hostDev = 'dev.rili.live';
const hostStage = 'stage.rili.live';
const hostProd = 'rili.live';

module.exports = {
    development: {
        apiPort,
        baseApiRoute: `http://${hostDev}:${apiPort}/api/v1`,
        baseSocketUrl: hostDev,
        googleAnalyticsKey: '',
        host: hostDev,
        socket: {
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 60,
        },
    },
    stage: {
        apiPort,
        baseApiRoute: `https://${hostStage}/api/v1`,
        baseSocketUrl: hostStage,
        googleAnalyticsKey: '',
        host: hostStage,
        socket: {
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 60,
        },
    },
    production: {
        apiPort,
        baseApiRoute: `https://${hostProd}/api/v1`,
        baseSocketUrl: hostProd,
        googleAnalyticsKey: '',
        host: hostProd,
        socket: {
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 60,
        },
    },
};
