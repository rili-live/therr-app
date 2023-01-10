import RateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import handleHttpError from '../utilities/handleHttpError';
import redisClient from '../store/redisClient';

const limitReachedStatusCode = 429;
const limitReachedMessage = 'Too many requests, please try again later.';
const serviceLimitReachedMessage = 'Too many service requests, please try again later.';

// TODO: Add store fallback to prevent single source of failure
const genericRateLimiter = RateLimit({
    store: new RedisStore({
        // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
        sendCommand: (...args: string[]) => redisClient.call(...args),
    }),
    windowMs: 1 * 60 * 1000, // 1 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    statusCode: limitReachedStatusCode,
    handler: (req, res) => handleHttpError({
        res,
        message: limitReachedMessage,
        statusCode: limitReachedStatusCode,
    }),
});

const serviceRateLimiter = (maxRequests = 200) => RateLimit({
    store: new RedisStore({
        // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
        sendCommand: (...args: string[]) => redisClient.call(...args),
    }),
    windowMs: 10 * 1000, // 10 seconds
    max: maxRequests, // limit each IP to 200 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
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
