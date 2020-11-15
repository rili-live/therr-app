import express from 'express';
import * as globalConfig from '../../../../global-config';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import { validate } from '../../validation';
import { createMomentValidation } from './validation/moments';

const mapsServiceRouter = express.Router();

// Maps
mapsServiceRouter.post('/moments', createMomentValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.get('/moments', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'get',
}));

export default mapsServiceRouter;
