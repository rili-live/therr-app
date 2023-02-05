import RateLimit from 'express-rate-limit';
import handleHttpError from '../../../utilities/handleHttpError';
import { RateLimiterRedisStore } from '../../../store/redisClient';

const limitReachedStatusCode = 429;
const limitReachedMessage = 'Too many attempts, please try again later.';

const buildRateLimiter = (msg, count = 1, minutes = 1) => RateLimit({
    store: RateLimiterRedisStore,
    windowMs: minutes * 60 * 1000, // 1 minutes
    max: process.env.NODE_ENV !== 'development' ? count : 10, // limit each IP to x requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    statusCode: limitReachedStatusCode,
    keyGenerator: (req) => `${req.method}${req.path}${req.ip}`,
    handler: (req, res) => handleHttpError({
        res,
        message: msg,
        statusCode: limitReachedStatusCode,
    }),
});

const verifyPhoneLimiter = buildRateLimiter(limitReachedMessage, 2, 5);
const verifyPhoneLongLimiter = buildRateLimiter(limitReachedMessage, 5, 24 * 60);

export {
    verifyPhoneLimiter,
    verifyPhoneLongLimiter,
};
