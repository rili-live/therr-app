import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as globalConfig from '../../../../global-config';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import { validate } from '../../validation';
import { getSignedUrlValidation } from './validation';
import {
    createAreaValidation,
    searchAreasValidation,
    deleteAreasValidation,
} from './validation/areas';
import {
    getMomentDetailsValidation,

} from './validation/moments';
import {
    getSpaceDetailsValidation,

} from './validation/spaces';

const mapsServiceRouter = express.Router();

// Moments
mapsServiceRouter.post('/moments', createAreaValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/moments/:momentId/details', getMomentDetailsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/moments/search', searchAreasValidation, validate, handleServiceRequest({
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

mapsServiceRouter.delete('/moments', deleteAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'delete',
}));

// Spaces
mapsServiceRouter.post('/spaces', createAreaValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/spaces/:spaceId/details', getSpaceDetailsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/spaces/search', searchAreasValidation, validate, handleServiceRequest({
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

mapsServiceRouter.delete('/spaces', deleteAreasValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'delete',
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
