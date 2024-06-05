import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AccessLevels } from 'therr-js-utilities/constants';
import * as globalConfig from '../../../../global-config';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import { validate } from '../../validation';
import {
    createCheckInLimiter,
    createActivityLimiter,
    createEventLimiter,
    createMomentLimiter,
    createSpaceLimiter,
} from './limitation/map';
import { createCheckInValidation, getSignedUrlValidation } from './validation';
import {
    createAreaValidation,
    updateAreaValidation,
    searchAreasValidation,
    searchMyAreasValidation,
    deleteAreasValidation,
} from './validation/areas';
import {
    createIntegratedMomentValidation,
    dynamicCreateIntegratedMomentValidation,
    getMomentDetailsValidation,
} from './validation/moments';
import {
    getSpaceDetailsValidation,
    updateSpaceValidation,
} from './validation/spaces';
import CacheStore from '../../store';
import authenticateOptional from '../../middleware/authenticateOptional';
import authorize, { AccessCheckType } from '../../middleware/authorize';
import { createEventValidations, getEventDetailsValidation } from './validation/events';
import { createActivityValidations } from './validation/activities';

const mapsServiceRouter = express.Router();

// Media
mapsServiceRouter.post('/media/signed-urls', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

// Activities
mapsServiceRouter.get('/activities/connections', createActivityLimiter, createActivityValidations, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));
mapsServiceRouter.post('/activities/generate', createActivityLimiter, createActivityValidations, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

// Events
// Limited to prevent abuse
mapsServiceRouter.post('/events', createEventLimiter, createEventValidations, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.put('/events/:eventId', updateAreaValidation, validate, async (req, res, next) => {
    await CacheStore.mapsService.invalidateAreaDetails('events', req.params.eventId);

    if (req.body.spaceId) {
        CacheStore.mapsService.invalidateAreaDetails('spaces', req.body.spaceId);
    }

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'put',
}));

mapsServiceRouter.post('/events/:eventId/details', authenticateOptional, getEventDetailsValidation, validate, async (req, res, next) => {
    const eventDetails = await CacheStore.mapsService.getAreaDetails('events', req.params.eventId);

    if (eventDetails) {
        return res.status(200).send({ ...eventDetails, cached: true });
    }

    if (req.body.spaceId) {
        CacheStore.mapsService.invalidateAreaDetails('spaces', req.body.spaceId);
    }

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}, (response, reqBody) => {
    if (reqBody.withMedia && reqBody.withUser) {
        return CacheStore.mapsService.setAreaDetails('events', response);
    }
}));

mapsServiceRouter.post('/events/search', authenticateOptional, searchAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/events/search/me', searchMyAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/events/search/for-space-ids', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.get('/events/signed-url/public', getSignedUrlValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

mapsServiceRouter.get('/events/signed-url/private', getSignedUrlValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

mapsServiceRouter.delete('/events', deleteAreasValidation, validate, (req, res, next) => {
    // TODO: Invalidate spaces since events are listed on spaces
    // OR load space events from a separate endpoint
    (req.body?.ids || []).forEach((id) => {
        CacheStore.mapsService.invalidateAreaDetails('events', id);
    });

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'delete',
}));

// Moments
// Limited to prevent abuse
// TODO: We should add backend logic to ensure user location isn't being spoofed (rapidly changing location)
mapsServiceRouter.post('/moments', createMomentLimiter, createAreaValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/moments/integrated', createIntegratedMomentValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/moments/integrated/dynamic', dynamicCreateIntegratedMomentValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.put('/moments/:momentId', updateAreaValidation, validate, async (req, res, next) => {
    await CacheStore.mapsService.invalidateAreaDetails('moments', req.params.momentId);

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'put',
}));

mapsServiceRouter.get('/moments/integrated/:userId', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

mapsServiceRouter.post('/moments/:momentId/details', authenticateOptional, getMomentDetailsValidation, validate, async (req, res, next) => {
    const momentDetails = await CacheStore.mapsService.getAreaDetails('moments', req.params.momentId);

    if (momentDetails) {
        return res.status(200).send({ ...momentDetails, cached: true });
    }

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}, (response, reqBody) => {
    if (reqBody.withMedia && reqBody.withUser) {
        return CacheStore.mapsService.setAreaDetails('moments', response);
    }
}));

mapsServiceRouter.post('/moments/search', authenticateOptional, searchAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/moments/search/me', searchMyAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/moments/search/for-space-ids', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.get('/moments/signed-url/public', getSignedUrlValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

mapsServiceRouter.get('/moments/signed-url/private', getSignedUrlValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

mapsServiceRouter.delete('/moments', deleteAreasValidation, validate, (req, res, next) => {
    (req.body?.ids || []).forEach((id) => {
        CacheStore.mapsService.invalidateAreaDetails('moments', id);
    });

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'delete',
}));

// Spaces
mapsServiceRouter.post('/spaces', createSpaceLimiter, createAreaValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.put('/spaces/:spaceId', updateSpaceValidation, validate, async (req, res, next) => {
    await CacheStore.mapsService.invalidateAreaDetails('spaces', req.params.spaceId);

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'put',
}));

mapsServiceRouter.post('/spaces/:spaceId/details', authenticateOptional, getSpaceDetailsValidation, validate, async (req, res, next) => {
    const spaceDetails = await CacheStore.mapsService.getAreaDetails('spaces', req.params.spaceId);

    if (spaceDetails) {
        return res.status(200).send({ ...spaceDetails, cached: true });
    }

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}, (response, reqBody) => {
    if (reqBody.withMedia && reqBody.withUser) {
        return CacheStore.mapsService.setAreaDetails('spaces', response);
    }
}));

// Public version of search
mapsServiceRouter.post('/spaces/list', searchAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/spaces/search', authenticateOptional, searchAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/spaces/search/me', searchMyAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.get('/spaces/signed-url/public', getSignedUrlValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

mapsServiceRouter.get('/spaces/signed-url/private', getSignedUrlValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

mapsServiceRouter.delete('/spaces', deleteAreasValidation, validate, (req, res, next) => {
    (req.body?.ids || []).forEach((id) => {
        CacheStore.mapsService.invalidateAreaDetails('spaces', id);
    });

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'delete',
}));

// Space Metrics
// Limited to prevent abuse
// TODO: We should add backend logic to ensure user location isn't being spoofed (rapidly changing location)
mapsServiceRouter.post('/space-metrics/check-in', createMomentLimiter, createCheckInLimiter, createCheckInValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));
mapsServiceRouter.get('/space-metrics/:spaceId', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));
mapsServiceRouter.get('/space-metrics/:spaceId/engagement', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

// Dashboard
mapsServiceRouter.post('/spaces/request-claim', createAreaValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));
mapsServiceRouter.post('/spaces/request-claim/:spaceId', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));
mapsServiceRouter.post('/spaces/request-approve/:spaceId', validate, authorize(
    {
        type: AccessCheckType.ALL,
        levels: [
            AccessLevels.SUPER_ADMIN,
        ],
    },
), handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

// TODO: Add rate limiter?
// External APIs
mapsServiceRouter.use('/place', createProxyMiddleware({
    target: 'https://maps.googleapis.com',
    // pathRewrite: { '^/v1/maps-service/place': '/maps/api/place' },
    pathRewrite: (path, req) => `${path.replace('/v1/maps-service/place', '/maps/api/place')}&key=${process.env.GOOGLE_MAPS_PLACES_SERVER_SIDE_API_KEY}`,
    changeOrigin: true,
}));

export default mapsServiceRouter;
