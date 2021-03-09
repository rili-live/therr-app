import express from 'express';
import * as globalConfig from '../../../../global-config';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import { validate } from '../../validation';
import {
    getMomentReactionsValidation,
    getMomentReactionsByMomentIdValidation,
    createOrUpdateMomentReactionValidation,
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

export default reactionsServiceRouter;
