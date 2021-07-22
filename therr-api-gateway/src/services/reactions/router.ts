import express from 'express';
import * as globalConfig from '../../../../global-config';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import { validate } from '../../validation';
import {
    getMomentReactionsValidation,
    getMomentReactionsByMomentIdValidation,
    createOrUpdateMomentReactionValidation,
    searchActiveMomentsValidation,
} from './validation/momentReactions';

const reactionsServiceRouter = express.Router();

// Reactions
reactionsServiceRouter.post('/moment-reactions/:momentId', createOrUpdateMomentReactionValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.get('/moment-reactions', getMomentReactionsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'get',
}));

reactionsServiceRouter.get('/moment-reactions/:momentId', getMomentReactionsByMomentIdValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'get',
}));

reactionsServiceRouter.post('/moments/active/search', searchActiveMomentsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseReactionsServiceRoute}`,
    method: 'post',
}));

export default reactionsServiceRouter;
