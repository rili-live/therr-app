import express from 'express';
import * as globalConfig from '../../../../global-config';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import { validate } from '../../validation';
import {
    createMomentValidation,
    searchMomentsValidation,
    deleteMomentsValidation,
} from './validation/moments';

const mapsServiceRouter = express.Router();

// Maps
mapsServiceRouter.post('/moments', createMomentValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.post('/moments/search', searchMomentsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'post',
}));

mapsServiceRouter.delete('/moments', deleteMomentsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}`,
    method: 'delete',
}));

export default mapsServiceRouter;
