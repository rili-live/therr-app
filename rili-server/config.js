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
        socketPort: 7771,
    },
    userSocketSessionExpire: 1000 * 60 * 60,
};
