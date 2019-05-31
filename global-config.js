const apiPort = 7770;
const socketPortDev = 7771;
const socketPortProd = 7743;

module.exports = {
    development: {
        apiPort,
        baseApiRoute: `http://localhost:${apiPort}/api/`,
        baseSocketUrl: `http://localhost:${socketPortDev}`,
        clientPort: 7070,
        googleAnalyticsKey: '',
        redisHost: '127.0.0.1',
        redisPubPort: 17771,
        redisSubPort: 17772,
        socketPort: socketPortDev,
        socket: {
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 60,
        },
    },
    production: {
        apiPort,
        baseApiRoute: `http://rili.live:${apiPort}/api/`,
        baseSocketUrl: `https://rili.live:${socketPortProd}`,
        clientPort: 7070,
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
