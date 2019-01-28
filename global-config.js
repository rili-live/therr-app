const apiPort = 7770;
const socketPortDev = 7743;
const socketPortProd = 7743;

module.exports = {
    development: {
        apiPort,
        baseApiRoute: `http://localhost:${apiPort}/api/`,
        baseUrl: `http://localhost:7771${socketPortDev}`,
        clientPort: 7070,
        googleAnalyticsKey: '',
        redisHost: '127.0.0.1',
        redisPubPort: 17771,
        redisSubPort: 17772,
        socketPort: socketPortDev,
        security: {
            certLocation: '/etc/letsencrypt/live/rili.live/fullchain.pem',
            keyLocation: '/etc/letsencrypt/live/rili.live/privkey.pem',
        },
        socket: {
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 60,
        },
    },
    production: {
        apiPort,
        baseApiRoute: `http://rili.live:${apiPort}/api/`,
        baseUrl: `https://rili.live:7743${socketPortProd}`,
        clientPort: 7070,
        googleAnalyticsKey: '',
        redisHost: '127.0.0.1',
        redisPubPort: 17771,
        redisSubPort: 17772,
        socketPort: socketPortProd,
        security: {
            certLocation: '/etc/letsencrypt/live/rili.live/fullchain.pem',
            keyLocation: '/etc/letsencrypt/live/rili.live/privkey.pem',
        },
        socket: {
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 60,
        },
    },
};
