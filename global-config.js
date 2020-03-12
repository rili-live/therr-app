const apiPort = process.env.API_PORT;
const hostDev = 'dev.rili.live';
const hostStage = 'stage.rili.live';
const hostProd = 'rili.live';

module.exports = {
    development: {
        apiPort,
        baseApiRoute: `http://${hostDev}:${apiPort}/api/v1`,
        baseSocketUrl: `http://${hostDev}:${process.env.SOCKET_PORT}`,
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
        baseApiRoute: `https://${hostStage}:${apiPort}/api/v1`,
        baseSocketUrl: `https://${hostStage}:${process.env.SOCKET_PORT}`,
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
        baseApiRoute: `https://${hostProd}:${apiPort}/api/v1`,
        baseSocketUrl: `https://${hostProd}:${process.env.SOCKET_PORT}`,
        googleAnalyticsKey: '',
        host: hostProd,
        socket: {
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 60,
        },
    },
};
