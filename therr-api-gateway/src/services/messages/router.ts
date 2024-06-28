import express from 'express';
import * as globalConfig from '../../../../global-config';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import { validate } from '../../validation';
import { createDirectMessageValidation } from './validation/directMessages';
import { createForumMessageValidation } from './validation/forumMessages';
import {
    createActivityValidation,
    createForumValidation,
    searchForumsValidation,
    updateForumValidation,
} from './validation/forums';
import checkResources from '../../middleware/checkResources';

const messagesServiceRouter = express.Router();

// Messages
messagesServiceRouter.post('/direct-messages', createDirectMessageValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMessagesServiceRoute}`,
    method: 'post',
}));

messagesServiceRouter.get('/direct-messages', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMessagesServiceRoute}`,
    method: 'get',
}));

messagesServiceRouter.get('/direct-messages/me', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMessagesServiceRoute}`,
    method: 'get',
}));

// Forum Messages
messagesServiceRouter.post('/forums-messages', createForumMessageValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMessagesServiceRoute}`,
    method: 'post',
}));

messagesServiceRouter.get('/forums-messages/:forumId', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMessagesServiceRoute}`,
    method: 'get',
}));

// Forums
messagesServiceRouter.get('/forums/:forumId', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMessagesServiceRoute}`,
    method: 'get',
}));

messagesServiceRouter.post('/forums', createForumValidation, validate, checkResources('createGroup'), handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMessagesServiceRoute}`,
    method: 'post',
}));

messagesServiceRouter.post('/forums/activities', createActivityValidation, validate, checkResources('createActivity'), handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMessagesServiceRoute}`,
    method: 'post',
}));

messagesServiceRouter.post('/forums/search', searchForumsValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMessagesServiceRoute}`,
    method: 'post',
}));

messagesServiceRouter.get('/forums/categories', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMessagesServiceRoute}`,
    method: 'get',
}));

messagesServiceRouter.put('/forums/:forumId', updateForumValidation, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseMessagesServiceRoute}`,
    method: 'put',
}));

export default messagesServiceRouter;
