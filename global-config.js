const apiPort = 7770;
const socketPortDev = 7743;
const socketPortStage = 7743;
const socketPortProd = 7743;
const hostDev = 'localhost';
const hostStage = 'stage.rili.live';
const hostProd = 'rili.live';

module.exports = {
    development: {
        apiPort,
        baseApiRoute: `http://${hostDev}:${apiPort}/api/v1`,
        baseSocketUrl: `http://${hostDev}:${socketPortDev}`,
        googleAnalyticsKey: '',
        host: hostDev,
        redisPubHost: 'rili-redis-pub',
        redisSubHost: 'rili-redis-sub',
        redisPubPort: 6379,
        redisSubPort: 6379,
        socketPort: socketPortDev,
        socket: {
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 60,
        },
    },
    stage: {
        apiPort,
        baseApiRoute: `http://${hostStage}:${apiPort}/api/v1`,
        baseSocketUrl: `http://${hostStage}:${socketPortStage}`,
        googleAnalyticsKey: '',
        host: hostStage,
        redisPubHost: 'rili-redis-pub',
        redisSubHost: 'rili-redis-sub',
        redisPubPort: 6379,
        redisSubPort: 6379,
        socketPort: socketPortStage,
        socket: {
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 60,
        },
    },
    production: {
        apiPort,
        baseApiRoute: `https://${hostProd}:${apiPort}/api/v1`,
        baseSocketUrl: `https://${hostProd}:${socketPortProd}`,
        googleAnalyticsKey: '',
        host: hostProd,
        redisPubHost: 'rili-redis-pub',
        redisSubHost: 'rili-redis-sub',
        redisPubPort: 17771,
        redisSubPort: 17772,
        socketPort: socketPortProd,
        socket: {
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 60,
        },
    },
};
