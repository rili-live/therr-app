import express from 'express';
import jwt from 'jsonwebtoken';
import { AccessLevels } from 'therr-js-utilities/constants';
import * as globalConfig from '../../../../global-config';
import authenticateOptional from '../../middleware/authenticateOptional';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import { blacklistToken, invalidateApiKeyCache, revokeAllUserRefreshTokens } from '../../store/redisClient';
import { validate } from '../../validation';
import {
    authenticateUserValidation,
    logoutUserValidation,
    authenticateUserTokenValidation,
} from './validation/auth';
import {
    createRewardsRequestValidation,
} from './validation/rewards';
import {
    changePasswordValidation,
    createUserValidation,
    forgotPasswordValidation,
    resendVerificationValidation,
    searchUsersValidation,
    verifyUserAccountValidation,
} from './validation/users';
import {
    createUserConnectionValidation,
    inviteConnectionsValidation,
    updateUserConnectionTypeValidation,
    updateUserConnectionValidation,
} from './validation/userConnections';
import {
    sendFeedbackValidation,
    subscribersSignupValidation,
} from './validation/subscribers';
import { updateNotificationValidation } from './validation/notifications';
import {
    feedbackAttemptLimiter,
    forgotPasswordLimiter,
    loginAttemptLimiter,
    refreshTokenLimiter,
    registerAttemptLimiter,
    resendVerificationLimiter,
    rewardRequestAttemptLimiter,
    userConnectionLimiter,
    multiInviteLimiter,
    subscribeAttemptLimiter,
    unsubscribeAttemptLimiter,
} from './limitation/auth';
import { createApiKeyValidation, revokeApiKeyValidation } from './validation/apiKeys';
import { createUpdateSocialSyncsValidation } from './validation/socialSyncs';
import {
    createThoughtValidation,
    getThoughtDetailsValidation,
    searchThoughtsValidation,
    deleteThoughtsValidation,
} from './validation/thoughts';
import CacheStore from '../../store';
import authorize, { AccessCheckType } from '../../middleware/authorize';
import { createGroupLimiter } from './limitation/groups';
import { apiKeyCreateLimiter } from './limitation/apiKeys';
import authenticateUnsubscribe from '../../middleware/authenticateUnsubscribe';

const usersServiceRouter = express.Router();

// API Keys (management - requires JWT auth)
usersServiceRouter.post('/api-keys', apiKeyCreateLimiter, createApiKeyValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.get('/api-keys', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

usersServiceRouter.delete('/api-keys/:id', revokeApiKeyValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'delete',
}, (response) => {
    // Invalidate cached API key context on revocation
    if (response?.keyPrefix) {
        invalidateApiKeyCache(response.keyPrefix);
    }
}));

usersServiceRouter.delete('/api-keys', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'delete',
}, (response) => {
    // Invalidate all cached API key contexts on bulk revocation
    if (response?.revokedKeyPrefixes?.length) {
        response.revokedKeyPrefixes.forEach((prefix) => invalidateApiKeyCache(prefix));
    }
}));

// Achievements
usersServiceRouter.get('/users/achievements', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

usersServiceRouter.post('/users/achievements/:id/claim', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

// Auth
// Optional auth when already logged in and using oauth2 providers
usersServiceRouter.post('/auth', authenticateOptional, loginAttemptLimiter, authenticateUserValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/auth/logout', logoutUserValidation, validate, async (req, res, next) => {
    // Blacklist the current access token on server-side logout
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            const decoded = jwt.decode(token) as { jti?: string; exp?: number; id?: string } | null;
            if (decoded?.jti && decoded?.exp) {
                const remainingTtl = decoded.exp - Math.floor(Date.now() / 1000);
                if (remainingTtl > 0) {
                    await blacklistToken(decoded.jti, remainingTtl);
                }
                // Also revoke all refresh tokens for this user
                if (decoded.id) {
                    await revokeAllUserRefreshTokens(decoded.id);
                }
            }
        }
    } catch (err) {
        // Log but don't block logout if blacklisting fails
        console.error('Failed to blacklist token on logout:', err);
    }
    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/auth/user-token/validate', authenticateUserTokenValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/auth/token/refresh', refreshTokenLimiter, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

// Rewards
usersServiceRouter.post('/rewards', rewardRequestAttemptLimiter, createRewardsRequestValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.get('/rewards/exchange-rate', validate, async (req, res, next) => {
    const cachedExchangeRate = await CacheStore.usersService.getExchangeRate();

    if (cachedExchangeRate) {
        return res.status(200).send({ exchangeRate: cachedExchangeRate, cached: true });
    }

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}, (response) => CacheStore.usersService.setExchangeRate(response.exchangeRate)));

// Interests / User Interests
usersServiceRouter.get('/interests', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));
usersServiceRouter.get('/users/interests/me', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));
usersServiceRouter.post('/users/interests/me', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

// Payments
usersServiceRouter.post('/payments/checkout/sessions/:id', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));
usersServiceRouter.post('/payments/webhook', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

// Connections - order matters here for route matching
usersServiceRouter.post('/users/connections', userConnectionLimiter, createUserConnectionValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/users/connections/multi-invite', multiInviteLimiter, inviteConnectionsValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

// NOTE: Override size limit
usersServiceRouter.post('/users/connections/find-people', express.json({
    limit: '1000kb',
}), multiInviteLimiter, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.get('/users/connections/:requestingUserId', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

usersServiceRouter.get('/users/connections', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

usersServiceRouter.put('/users/connections', updateUserConnectionValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'put',
}));

usersServiceRouter.put('/users/connections/type', updateUserConnectionTypeValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'put',
}));

// Users
usersServiceRouter.post('/users', registerAttemptLimiter, createUserValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/users/:id', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.get('/users/me', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

usersServiceRouter.get('/users/:id', authenticateOptional, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

usersServiceRouter.get('/users/by-phone/:phoneNumber', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

usersServiceRouter.get('/users/by-username/:userName', authenticateOptional, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

usersServiceRouter.put('/users/:id', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'put',
}));

usersServiceRouter.put('/users/:id/block', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'put',
}));

usersServiceRouter.put('/users/:id/report', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'put',
}));

usersServiceRouter.put('/users/:id/report', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'put',
}));

usersServiceRouter.put('/users/change-password', changePasswordValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'put',
}));

usersServiceRouter.delete('/users/:id', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'delete',
}));

usersServiceRouter.post('/users/search', searchUsersValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/users/search-pairings', searchUsersValidation, authorize(
    {
        type: AccessCheckType.ANY,
        levels: [
            // AccessLevels.DASHBOARD_SUBSCRIBER_BASIC, - pairings not included for this pricing package
            AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
            AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
            AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
        ],
    },
), handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/users/forgot-password', forgotPasswordLimiter, forgotPasswordValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/users/verify/resend', resendVerificationLimiter, resendVerificationValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/users/verify/:token', verifyUserAccountValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

// UserGroups
usersServiceRouter.get('/users-groups', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

usersServiceRouter.get('/users-groups/:id', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

usersServiceRouter.post('/users-groups', createGroupLimiter, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.put('/users-groups/:id', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'put',
}));

usersServiceRouter.delete('/users-groups/:id', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'delete',
}));

// Notifications
usersServiceRouter.post('/users/notifications', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.get('/users/notifications/:notificationId', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

usersServiceRouter.get('/users/notifications', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

usersServiceRouter.put('/users/notifications/:notificationId', updateNotificationValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'put',
}));

// Social Sync
usersServiceRouter.post('/social-sync', createUpdateSocialSyncsValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));
usersServiceRouter.get('/social-sync/:userId', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));
usersServiceRouter.get('/social-sync/oauth2-facebook', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));
usersServiceRouter.get('/social-sync/oauth2-dashboard-facebook', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));
usersServiceRouter.get('/social-sync/oauth2-instagram', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));
usersServiceRouter.get('/social-sync/oauth2-tiktok', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

// Subscribers
usersServiceRouter.post('/subscribers/send-feedback', authenticateOptional, feedbackAttemptLimiter, sendFeedbackValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/subscribers/signup', subscribeAttemptLimiter, subscribersSignupValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/subscribers/unsubscribe', authenticateUnsubscribe, unsubscribeAttemptLimiter, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.get('/subscribers/preferences', authenticateUnsubscribe, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

// Thoughts
usersServiceRouter.post('/thoughts', createThoughtValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/thoughts/:thoughtId/details', getThoughtDetailsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/thoughts/search', searchThoughtsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.delete('/thoughts', deleteThoughtsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'delete',
}));

// User Organizations
usersServiceRouter.get('/users/organizations', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

// User Metrics
usersServiceRouter.get('/metrics/:contentUserId', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

// Emails
// TODO: Validate with SNS https://gist.github.com/NEbere/97d53274aa186bd2e69ba774f0afad39
usersServiceRouter.post('/emails/bounced', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

export default usersServiceRouter;
