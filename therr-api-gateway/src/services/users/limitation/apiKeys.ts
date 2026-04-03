import RateLimit from 'express-rate-limit';
import handleHttpError from '../../../utilities/handleHttpError';
import { RateLimiterRedisStore } from '../../../store/redisClient';

const limitReachedStatusCode = 429;
const apiKeyCreateLimitMessage = 'Too many API key creation requests, please try again later.';
const apiKeyRequestLimitMessage = 'Too many API requests, please try again later.';

// Rate limit for API key creation: 5 per hour per user
const apiKeyCreateLimiter = RateLimit({
    store: RateLimiterRedisStore,
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV !== 'development' ? 5 : 25,
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: limitReachedStatusCode,
    keyGenerator: (req) => `apikey-create:${req['x-userid'] || req.ip}`,
    handler: (req, res) => handleHttpError({
        res,
        message: apiKeyCreateLimitMessage,
        statusCode: limitReachedStatusCode,
    }),
});

// Rate limit for API key authenticated requests: 100 per minute per key
const apiKeyRequestLimiter = RateLimit({
    store: RateLimiterRedisStore,
    windowMs: 60 * 1000, // 1 minute
    max: process.env.NODE_ENV !== 'development' ? 100 : 500,
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: limitReachedStatusCode,
    keyGenerator: (req) => `apikey-req:${req['x-api-key-prefix'] || req.ip}`,
    handler: (req, res) => handleHttpError({
        res,
        message: apiKeyRequestLimitMessage,
        statusCode: limitReachedStatusCode,
    }),
});

export {
    apiKeyCreateLimiter,
    apiKeyRequestLimiter,
};
