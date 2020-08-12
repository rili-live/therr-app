import express from 'express';
import * as globalConfig from '../../../../global-config';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import { validate } from '../../validation';
import { createDirectMessageValidation } from './validation/directMessages';

const messagesServiceRouter = express.Router();

// Messages
messagesServiceRouter.post('/direct-messages', createDirectMessageValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'post',
}));

messagesServiceRouter.get('/direct-messages', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}`,
    method: 'get',
}));

export default messagesServiceRouter;
