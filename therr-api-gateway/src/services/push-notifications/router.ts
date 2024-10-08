import express from 'express';
import * as globalConfig from '../../../../global-config';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import { validate } from '../../validation';
import {
    postLocationChangeValidation,
} from './validation/location';

const reactionsServiceRouter = express.Router();

// Reactions
reactionsServiceRouter.post('/location/process-user-location', postLocationChangeValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].basePushNotificationsServiceRoute}`,
    method: 'post',
}));

reactionsServiceRouter.post('/location/process-user-background-location', handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].basePushNotificationsServiceRoute}`,
    method: 'post',
}));

export default reactionsServiceRouter;
