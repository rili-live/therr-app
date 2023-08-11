import express from 'express';
import * as globalConfig from '../../../../global-config';
import authenticateOptional from '../../middleware/authenticateOptional';
import handleServiceRequest from '../../middleware/handleServiceRequest';
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
    verifyUserAccountValidation,
} from './validation/users';
import {
    createUserConnectionValidation,
    inviteConnectionsValidation,
    updateUserConnectionValidation,
} from './validation/userConnections';
import {
    sendFeedbackValidation,
    subscribersSignupValidation,
} from './validation/subscribers';
import { updateNotificationValidation } from './validation/notifications';
import {
    feedbackAttemptLimiter,
    loginAttemptLimiter,
    registerAttemptLimiter,
    rewardRequestAttemptLimiter,
    userConnectionLimiter,
    multiInviteLimiter,
    subscribeAttemptLimiter,
} from './limitation/auth';
import { createUpdateSocialSyncsValidation } from './validation/socialSyncs';
import {
    createThoughtValidation,
    getThoughtDetailsValidation,
    searchThoughtsValidation,
    deleteThoughtsValidation,
} from './validation/thoughts';
import CacheStore from '../../store';

const usersServiceRouter = express.Router();

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
usersServiceRouter.post('/auth', loginAttemptLimiter, authenticateUserValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/auth/logout', logoutUserValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/auth/user-token/validate', authenticateUserTokenValidation, validate, handleServiceRequest({
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
        return res.send({ exchangeRate: cachedExchangeRate, cached: true });
    }

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}, (response) => CacheStore.usersService.setExchangeRate(response.exchangeRate).catch((error) => {
    console.error('Error setting exchange rate in cache', error);
})));

// Payments
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

usersServiceRouter.get('/users/:id', handleServiceRequest({
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

usersServiceRouter.post('/users/forgot-password', forgotPasswordValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/users/verify/resend', resendVerificationValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/users/verify/:token', verifyUserAccountValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
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
usersServiceRouter.get('/social-sync/oauth2-instagram', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));
usersServiceRouter.get('/social-sync/oauth2-tiktok', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

// Subscribers
usersServiceRouter.post('/subscribers/send-feedback', feedbackAttemptLimiter, sendFeedbackValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

usersServiceRouter.post('/subscribers/signup', subscribeAttemptLimiter, subscribersSignupValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
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

// User Metrics
usersServiceRouter.get('/metrics/:contentUserId', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

export default usersServiceRouter;
