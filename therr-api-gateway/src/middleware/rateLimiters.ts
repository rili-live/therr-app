import RateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import handleHttpError from '../utilities/handleHttpError';
import redisClient from '../utilities/redisClient';

const limitReachedStatusCode = 429;
const limitReachedMessage = 'Too many requests, please try again later.';
const serviceLimitReachedMessage = 'Too many service requests, please try again later.';

const genericRateLimiter = new RateLimit({
    store: new RedisStore({
        client: redisClient,
    }),
    windowMs: 1 * 60 * 1000, // 1 minutes
    // TODO: RSERV-43 - Determine how to get real IP from kubernetes and lower this back to 500
    max: 10000, // limit each IP to 500 requests per windowMs
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
    // TODO: RSERV-43 - Determine how to get real IP from kubernetes and lower this back to 50
    max: 5000, // limit each IP to 50 requests per windowMs
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
