module.exports = {
    development: {
        redisHost: '127.0.0.1',
        redisPubPort: 17771,
        redisSubPort: 17772,
        serverPort: 7770,
        socketPort: 7771,
    },
    production: {
        redisHost: '127.0.0.1',
        redisPubPort: 17771,
        redisSubPort: 17772,
        serverPort: 7770,
        socketPort: 7743,
    },
    socket: {
        pingInterval: 1000 * 10,
        pingTimeout: 1000 * 5,
        userSocketSessionExpire: 1000 * 60 * 60,
    },
};
