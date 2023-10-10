import RateLimit from 'express-rate-limit';
import handleHttpError from '../../../utilities/handleHttpError';
import { RateLimiterRedisStore } from '../../../store/redisClient';

const limitReachedStatusCode = 429;
const checkInLimitReachedMessage = 'Check-ins are limited per day. Try again later.';
const momentsLimitReachedMessage = 'Content creation is limited per day. Try again tomorrow.';
const spacesLimitReachedMessage = 'Space creation is limited per day. Try again tomorrow.';

const buildRateLimiter = (msg, count = 1, minutes = 1, keySuffix = '') => RateLimit({
    store: RateLimiterRedisStore,
    windowMs: minutes * 60 * 1000, // 1 minutes
    max: process.env.NODE_ENV !== 'development' ? count : 25, // limit each IP to x requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    statusCode: limitReachedStatusCode,
    keyGenerator: (req) => `${req.method}${req.path}${req.ip}${keySuffix}`,
    handler: (req, res) => handleHttpError({
        res,
        message: msg,
        statusCode: limitReachedStatusCode,
    }),
});

// User should only check in when actually stopping at a location
const createCheckInLimiter = buildRateLimiter(checkInLimitReachedMessage, 2, 30, '-2'); // 2 per 30 minutes
const createMomentLimiter = buildRateLimiter(momentsLimitReachedMessage, 5, 60 * 24); // 5 per day
// TODO: Reduce this or limit to admin users
const createSpaceLimiter = buildRateLimiter(spacesLimitReachedMessage, 100, 60 * 24);

export {
    createCheckInLimiter,
    createMomentLimiter,
    createSpaceLimiter,
};
