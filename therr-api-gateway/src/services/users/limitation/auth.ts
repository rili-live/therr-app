import RateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import handleHttpError from '../../../utilities/handleHttpError';
import redisClient from '../../../utilities/redisClient';

const limitReachedStatusCode = 429;
const limitReachedMessage = 'Too many login attempts, please try again later.';

const loginAttemptLimiter = new RateLimit({
    store: new RedisStore({
        client: redisClient,
    }),
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: process.env.NODE_ENV !== 'development' ? 5 : 20, // limit each IP to 5 requests per windowMs
    statusCode: limitReachedStatusCode,
    handler: (req, res) => handleHttpError({
        res,
        message: limitReachedMessage,
        statusCode: limitReachedStatusCode,
    }),
});

export {
    loginAttemptLimiter,
};
