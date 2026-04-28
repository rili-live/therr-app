import express from 'express';
import jwt from 'jsonwebtoken';
import { AccessLevels } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import * as globalConfig from '../../../../global-config';
import authenticateOptional from '../../middleware/authenticateOptional';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import {
    blacklistToken,
    invalidateApiKeyCache,
    revokeAllUserRefreshTokens,
    revokeRefreshToken,
    revokeUserBrandRefreshTokens,
    storeRefreshToken,
} from '../../store/redisClient';
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
    emailPrecheckLimiter,
    handoffMintLimiter,
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

usersServiceRouter.get('/users/achievements/:userId/public', handleServiceRequest({
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
}, (responseData) => {
    // Store refresh token JTI on login for rotation tracking (fail-open)
    try {
        if (responseData?.refreshToken) {
            const decoded = jwt.decode(responseData.refreshToken) as { jti?: string; id?: string; exp?: number; brand?: string } | null;
            if (decoded?.jti && decoded?.id && decoded?.exp) {
                const ttl = decoded.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0) {
                    storeRefreshToken(decoded.id, decoded.jti, ttl, decoded.brand);
                }
            }
        }
    } catch (err) {
        // Non-critical: don't block login
    }
}));

usersServiceRouter.post('/auth/logout', logoutUserValidation, validate, async (req, res, next) => {
    // Blacklist the current access token on server-side logout
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            const decoded = jwt.decode(token) as { jti?: string; exp?: number; id?: string; brand?: string } | null;
            if (decoded?.jti && decoded?.exp) {
                const remainingTtl = decoded.exp - Math.floor(Date.now() / 1000);
                if (remainingTtl > 0) {
                    await blacklistToken(decoded.jti, remainingTtl);
                }
                // Refresh-token revocation scope:
                //  - default: per-brand. Logging out of one app does NOT log a user out of sister apps.
                //  - opt-in `scope=all`: revoke every refresh token for this user across all brands.
                //  - legacy tokens (no `brand` claim): fall back to the legacy "all" behavior so existing
                //    sessions continue to receive the safer cascade until they refresh into branded tokens.
                if (decoded.id) {
                    if (req.body?.scope === 'all' || !decoded.brand) {
                        await revokeAllUserRefreshTokens(decoded.id);
                    } else {
                        await revokeUserBrandRefreshTokens(decoded.id, decoded.brand);
                    }
                }
            }
        }
    } catch (err) {
        // Log but don't block logout if blacklisting fails
        logSpan({
            level: 'error',
            messageOrigin: 'API_GATEWAY_USERS_ROUTER',
            messages: ['Failed to blacklist token on logout'],
            traceArgs: { 'error.message': err instanceof Error ? err.message : String(err) },
        });
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
}, (responseData, reqBody) => {
    // Server-side refresh token rotation tracking (fail-open)
    try {
        // Revoke the old refresh token. If it has a brand+id (new shape), target the new key
        // directly; otherwise fall back to the legacy `refresh-token:<jti>` key.
        if (reqBody?.refreshToken) {
            const oldDecoded = jwt.decode(reqBody.refreshToken) as { jti?: string; id?: string; brand?: string } | null;
            if (oldDecoded?.jti) {
                revokeRefreshToken(oldDecoded.jti, { brand: oldDecoded.brand, userId: oldDecoded.id });
            }
        }
        // Store the new refresh token for reuse detection
        if (responseData?.refreshToken) {
            const newDecoded = jwt.decode(responseData.refreshToken) as { jti?: string; id?: string; exp?: number; brand?: string } | null;
            if (newDecoded?.jti && newDecoded?.id && newDecoded?.exp) {
                const ttl = newDecoded.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0) {
                    storeRefreshToken(newDecoded.id, newDecoded.jti, ttl, newDecoded.brand);
                }
            }
        }
    } catch (err) {
        // Non-critical: log but don't block the refresh response
        logSpan({
            level: 'error',
            messageOrigin: 'API_GATEWAY_USERS_ROUTER',
            messages: ['Failed to track refresh token rotation'],
            traceArgs: { 'error.message': err instanceof Error ? err.message : String(err) },
        });
    }
}));

// Email pre-check for multi-app login UX. Always returns 200 with a generic shape to avoid
// account enumeration. Rate-limited per IP.
usersServiceRouter.post('/auth/email-precheck', emailPrecheckLimiter, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

// Cross-app handoff. Mint and cancel require an authenticated session (the user is signed in to
// the source app). Redeem is unauthed because the short-lived single-use code IS the credential;
// it is exchanged for a fresh idToken+refreshToken stamped with the target brand.
usersServiceRouter.post('/auth/handoff/mint', handoffMintLimiter, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/auth/handoff/redeem', loginAttemptLimiter, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}, (responseData) => {
    // Successful handoff = a fresh login. Track the new refresh token the same way /auth does.
    try {
        if (responseData?.refreshToken) {
            const decoded = jwt.decode(responseData.refreshToken) as { jti?: string; id?: string; exp?: number; brand?: string } | null;
            if (decoded?.jti && decoded?.id && decoded?.exp) {
                const ttl = decoded.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0) {
                    storeRefreshToken(decoded.id, decoded.jti, ttl, decoded.brand);
                }
            }
        }
    } catch (err) {
        // Non-critical
    }
}));

usersServiceRouter.post('/auth/handoff/cancel', handleServiceRequest({
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
usersServiceRouter.post('/payments/customer-portal/sessions', validate, handleServiceRequest({
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
