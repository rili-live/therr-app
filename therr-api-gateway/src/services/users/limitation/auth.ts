import RateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import handleHttpError from '../../../utilities/handleHttpError';
import redisClient from '../../../store/redisClient';

const limitReachedStatusCode = 429;
const limitReachedMessage = 'Too many login attempts, please try again later.';
const subscribeLimitReachedMessage = 'Too many requests to subscribe.';

const loginAttemptLimiter = new RateLimit({
    store: new RedisStore({
        client: redisClient,
    }),
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: process.env.NODE_ENV !== 'development' ? 10 : 25, // limit each IP to 10 requests per windowMs
    statusCode: limitReachedStatusCode,
    keyGenerator: (req) => `${req.method}${req.path}${req.ip}`,
    handler: (req, res) => handleHttpError({
        res,
        message: limitReachedMessage,
        statusCode: limitReachedStatusCode,
    }),
});

const subscribeAttemptLimiter = new RateLimit({
    store: new RedisStore({
        client: redisClient,
    }),
    windowMs: 1 * 60 * 1000, // 1 minutes
    max: process.env.NODE_ENV !== 'development' ? 2 : 25, // limit each IP to 1 requests per windowMs
    statusCode: limitReachedStatusCode,
    keyGenerator: (req) => `${req.method}${req.path}${req.ip}`,
    handler: (req, res) => handleHttpError({
        res,
        message: subscribeLimitReachedMessage,
        statusCode: limitReachedStatusCode,
    }),
});

export {
    loginAttemptLimiter,
    subscribeAttemptLimiter,
};
