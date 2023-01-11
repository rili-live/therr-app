import RateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import handleHttpError from '../../../utilities/handleHttpError';
import redisClient from '../../../store/redisClient';

const limitReachedStatusCode = 429;
const limitReachedMessage = 'Too many attempts, please try again later.';

const buildRateLimiter = (msg, count = 1, minutes = 1) => RateLimit({
    store: new RedisStore({
        prefix: 'api-gateway:rl:', // This overrides the default prefix in redisClient
        // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
        sendCommand: (...args: string[]) => redisClient.call(...args),
    }),
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
