import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as globalConfig from '../../../../global-config';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import { validate } from '../../validation';
import { createMomentLimiter, createSpaceLimiter } from './limitation/map';
import { getSignedUrlValidation } from './validation';
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
import { requestSpaceClaimValidation } from './validation/dashboard';
import CacheStore from '../../store';

const mapsServiceRouter = express.Router();

// Media
mapsServiceRouter.post('/media/signed-urls', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

// Moments
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

mapsServiceRouter.post('/moments/:momentId/details', getMomentDetailsValidation, validate, async (req, res, next) => {
    const momentDetails = await CacheStore.mapsService.getAreaDetails('moments', req.params.momentId);

    if (momentDetails) {
        return res.status(200).send({ ...momentDetails, cached: true });
    }

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}, (response) => CacheStore.mapsService.setAreaDetails('moments', response)));

mapsServiceRouter.post('/moments/search', searchAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/moments/search/me', searchMyAreasValidation, validate, handleServiceRequest({
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

mapsServiceRouter.post('/spaces/:spaceId/details', getSpaceDetailsValidation, validate, async (req, res, next) => {
    const momentDetails = await CacheStore.mapsService.getAreaDetails('spaces', req.params.spaceId);

    if (momentDetails) {
        return res.status(200).send({ ...momentDetails, cached: true });
    }

    return next();
}, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}, (response) => CacheStore.mapsService.setAreaDetails('spaces', response)));

mapsServiceRouter.post('/spaces/search', searchAreasValidation, validate, handleServiceRequest({
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
mapsServiceRouter.get('/space-metrics/:spaceId', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

// Dashboard
mapsServiceRouter.post('/spaces/request-claim', requestSpaceClaimValidation, validate, handleServiceRequest({
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
