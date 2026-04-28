import RateLimit from 'express-rate-limit';
import handleHttpError from '../../../utilities/handleHttpError';
import { RateLimiterRedisStore } from '../../../store/redisClient';

const limitReachedStatusCode = 429;
const limitReachedMessage = 'Too many login attempts, please try again later.';
const registerLimitReachedMessage = 'Too many requests to register.';
const forgotPasswordLimitReachedMessage = 'Too many password reset requests, please try again later.';
const resendVerificationLimitReachedMessage = 'Too many verification resend requests, please try again later.';
const refreshTokenLimitReachedMessage = 'Too many token refresh requests, please try again later.';
const feedbackLimitReachedMessage = 'Too many requests to send feedback.';
const rewardRequestLimitReachedMessage = 'Too many requests to exchange coins.';
const userConnectionLimitReachedMessage = 'Too many user connection requests';
const multiInviteLimitReachedMessage = 'Too many invite requests';
const subscribeLimitReachedMessage = 'Too many requests to subscribe.';
const unsubscribeLimitReachedMessage = 'Too many requests to unsubscribe.';
const emailPrecheckLimitReachedMessage = 'Too many email lookup requests, please try again later.';
const handoffMintLimitReachedMessage = 'Too many app handoff requests, please try again later.';

const loginAttemptLimiter = RateLimit({
    store: RateLimiterRedisStore,
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: process.env.NODE_ENV !== 'development' ? 10 : 25, // limit each IP to 10 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    statusCode: limitReachedStatusCode,
    keyGenerator: (req) => `${req.method}${req.path}${req.ip}`,
    handler: (req, res) => handleHttpError({
        res,
        message: limitReachedMessage,
        statusCode: limitReachedStatusCode,
    }),
});

const buildRateLimiter = (msg, count = 1, minutes = 1) => RateLimit({
    store: RateLimiterRedisStore,
    windowMs: minutes * 60 * 1000, // 1 minutes
    max: process.env.NODE_ENV !== 'development' ? count : 25, // limit each IP to x requests per windowMs
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

const registerAttemptLimiter = buildRateLimiter(registerLimitReachedMessage, 5, 60 * 12);
const forgotPasswordLimiter = buildRateLimiter(forgotPasswordLimitReachedMessage, 3, 15); // 3 requests per 15 minutes
const resendVerificationLimiter = buildRateLimiter(resendVerificationLimitReachedMessage, 3, 15); // 3 requests per 15 minutes
const refreshTokenLimiter = buildRateLimiter(refreshTokenLimitReachedMessage, 30, 5); // 30 requests per 5 minutes
const feedbackAttemptLimiter = buildRateLimiter(feedbackLimitReachedMessage);
const rewardRequestAttemptLimiter = buildRateLimiter(rewardRequestLimitReachedMessage, 1, 3);
const userConnectionLimiter = buildRateLimiter(userConnectionLimitReachedMessage, 10, 60); // 10 requests per hour (60 minutes)
const multiInviteLimiter = buildRateLimiter(multiInviteLimitReachedMessage, 1, 5);
const subscribeAttemptLimiter = buildRateLimiter(subscribeLimitReachedMessage);
const unsubscribeAttemptLimiter = buildRateLimiter(unsubscribeLimitReachedMessage, 3, 60);
// Generous enough for typed-then-blurred email behavior, tight enough to make enumeration unattractive.
const emailPrecheckLimiter = buildRateLimiter(emailPrecheckLimitReachedMessage, 10, 1); // 10/min/IP
const handoffMintLimiter = buildRateLimiter(handoffMintLimitReachedMessage, 10, 5); // 10 codes per 5 min/IP

export {
    loginAttemptLimiter,
    registerAttemptLimiter,
    forgotPasswordLimiter,
    resendVerificationLimiter,
    refreshTokenLimiter,
    rewardRequestAttemptLimiter,
    feedbackAttemptLimiter,
    userConnectionLimiter,
    multiInviteLimiter,
    subscribeAttemptLimiter,
    unsubscribeAttemptLimiter,
    emailPrecheckLimiter,
    handoffMintLimiter,
};
