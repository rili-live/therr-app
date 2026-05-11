import RateLimit from 'express-rate-limit';
import handleHttpError from '../../../utilities/handleHttpError';
import { RateLimiterRedisStore } from '../../../store/redisClient';

const MAX_ACTIVITIES_PER_USER_PER_DAY = 10;
const MAX_EVENTS_PER_USER_PER_DAY = 10;

const limitReachedStatusCode = 429;
const checkInLimitReachedMessage = 'Check-ins are limited per day. Try again later.';
const activitiesLimitReachedMessage = `Activities are limited to ${MAX_ACTIVITIES_PER_USER_PER_DAY} per day. Try again later.`;
const eventsLimitReachedMessage = `Events are limited to ${MAX_EVENTS_PER_USER_PER_DAY} per day. Try again later.`;
const momentsLimitReachedMessage = 'Content creation is limited per day. Try again tomorrow.';
const spacesLimitReachedMessage = 'Space creation is limited per day. Try again tomorrow.';
const pairingFeedbackLimitReachedMessage = 'Pairing feedback is limited. Try again later.';

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

// Variant keyed on userId when present, else IP. Used to cap per-identity
// volume on endpoints that authenticateOptional admits both.
const buildIdentityRateLimiter = (msg, count = 1, minutes = 1, keySuffix = '') => RateLimit({
    store: RateLimiterRedisStore,
    windowMs: minutes * 60 * 1000,
    max: process.env.NODE_ENV !== 'development' ? count : 50,
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: limitReachedStatusCode,
    keyGenerator: (req) => {
        const identity = (req.headers && req.headers['x-userid']) || req.ip;
        return `${req.method}${req.path}${identity}${keySuffix}`;
    },
    handler: (req, res) => handleHttpError({
        res,
        message: msg,
        statusCode: limitReachedStatusCode,
    }),
});

// User should only check in when actually stopping at a location
const createCheckInLimiter = buildRateLimiter(checkInLimitReachedMessage, 2, 30, '-2'); // 2 per 30 minutes
const createActivityLimiter = buildRateLimiter(activitiesLimitReachedMessage, MAX_ACTIVITIES_PER_USER_PER_DAY, 60 * 24); // per day
const createEventLimiter = buildRateLimiter(eventsLimitReachedMessage, MAX_EVENTS_PER_USER_PER_DAY, 60 * 24); // per day
const createMomentLimiter = buildRateLimiter(momentsLimitReachedMessage, 5, 60 * 24); // 5 per day
// TODO: Reduce this or limit to admin users
const createSpaceLimiter = buildRateLimiter(spacesLimitReachedMessage, 100, 60 * 24);

const pairingFeedbackLimiter = buildRateLimiter(pairingFeedbackLimitReachedMessage, 20, 60); // 20 per hour per IP

const correctionsLimitReachedMessage = 'Submissions are limited. Try again later.';
// Anonymous-friendly limiters on the space corrections endpoint. Stacked to
// catch both burst (3 in 10 min) and sustained (15 in 1 hour) IP abuse, plus a
// per-identity cap that uses userId when authenticated.
const correctionsLimiterPerIpBurst = buildRateLimiter(correctionsLimitReachedMessage, 3, 10, '-corr-b');
const correctionsLimiterPerIpHour = buildRateLimiter(correctionsLimitReachedMessage, 15, 60, '-corr-h');
const correctionsLimiterPerIdentity = buildIdentityRateLimiter(correctionsLimitReachedMessage, 30, 60, '-corr-id');

const placesApiLimitReachedMessage = 'Places search is limited. Try again later.';
const placesApiLimiter = buildRateLimiter(placesApiLimitReachedMessage, 60, 1); // 60 per minute per IP

const geocodeApiLimitReachedMessage = 'Geocoding is limited. Try again later.';
const geocodeApiLimiter = buildRateLimiter(geocodeApiLimitReachedMessage, 30, 1); // 30 per minute per IP

export {
    createCheckInLimiter,
    createActivityLimiter,
    createEventLimiter,
    createMomentLimiter,
    createSpaceLimiter,
    pairingFeedbackLimiter,
    correctionsLimiterPerIpBurst,
    correctionsLimiterPerIpHour,
    correctionsLimiterPerIdentity,
    placesApiLimiter,
    geocodeApiLimiter,
};
