import RateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import handleHttpError from '../utilities/handleHttpError';
import redisClient from '../store/redisClient';

const limitReachedStatusCode = 429;
const limitReachedMessage = 'Too many requests, please try again later.';
const serviceLimitReachedMessage = 'Too many service requests, please try again later.';

// TODO: Add store fallback to prevent single source of failure
const genericRateLimiter = new RateLimit({
    store: new RedisStore({
        client: redisClient,
    }),
    windowMs: 1 * 60 * 1000, // 1 minutes
    max: 1000, // limit each IP to 500 requests per windowMs
    statusCode: limitReachedStatusCode,
    handler: (req, res) => handleHttpError({
        res,
        message: limitReachedMessage,
        statusCode: limitReachedStatusCode,
    }),
});

const serviceRateLimiter = new RateLimit({
    store: new RedisStore({
        client: redisClient,
    }),
    windowMs: 10 * 1000, // 10 seconds
    max: 100, // limit each IP to 50 requests per windowMs
    statusCode: limitReachedStatusCode,
    handler: (req, res) => handleHttpError({
        res,
        message: serviceLimitReachedMessage,
        statusCode: limitReachedStatusCode,
    }),
});

export {
    genericRateLimiter,
    serviceRateLimiter,
};
