import RateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import handleHttpError from '../../../utilities/handleHttpError';
import redisClient from '../../../store/redisClient';

const limitReachedStatusCode = 429;
const limitReachedMessage = 'Too many login attempts, please try again later.';
const feedbackLimitReachedMessage = 'Too many requests to send feedback.';
const rewardRequestLimitReachedMessage = 'Too many requests to exchange coins.';
const userConnectionLimitReachedMessage = 'Too many user connection requests';
const multiInviteLimitReachedMessage = 'Too many invite requests';
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

const buildRateLimiter = (msg, count = 1, minutes = 1) => new RateLimit({
    store: new RedisStore({
        client: redisClient,
    }),
    windowMs: minutes * 60 * 1000, // 1 minutes
    max: process.env.NODE_ENV !== 'development' ? count : 25, // limit each IP to x requests per windowMs
    statusCode: limitReachedStatusCode,
    keyGenerator: (req) => `${req.method}${req.path}${req.ip}`,
    handler: (req, res) => handleHttpError({
        res,
        message: msg,
        statusCode: limitReachedStatusCode,
    }),
});

const feedbackAttemptLimiter = buildRateLimiter(feedbackLimitReachedMessage);
const rewardRequestAttemptLimiter = buildRateLimiter(rewardRequestLimitReachedMessage, 1, 3);
const userConnectionLimiter = buildRateLimiter(userConnectionLimitReachedMessage, 5, 60); // 5 requests per hour (60 minutes)
const multiInviteLimiter = buildRateLimiter(multiInviteLimitReachedMessage, 1, 5);
const subscribeAttemptLimiter = buildRateLimiter(subscribeLimitReachedMessage);

export {
    loginAttemptLimiter,
    rewardRequestAttemptLimiter,
    feedbackAttemptLimiter,
    userConnectionLimiter,
    multiInviteLimiter,
    subscribeAttemptLimiter,
};
