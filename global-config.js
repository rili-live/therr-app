const apiPort = 7770;
const socketPortDev = 7743;
const socketPortProd = 7743;

module.exports = {
    development: {
        apiPort,
        baseApiRoute: `http://localhost:${apiPort}/api/v1`,
        baseSocketUrl: `http://localhost:${socketPortDev}`,
        googleAnalyticsKey: '',
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
    production: {
        apiPort,
        baseApiRoute: `https://rili.live:${apiPort}/api/v1`,
        baseSocketUrl: `https://rili.live:${socketPortProd}`,
        googleAnalyticsKey: '',
        redisHost: '127.0.0.1',
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
