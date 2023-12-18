import express from 'express';
import { AccessLevels } from 'therr-js-utilities/constants';
import * as globalConfig from '../../../../global-config';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import { validate } from '../../validation';
import {
    createCampaignValidation,
} from './validation/campaigns';
import authorize, { AccessCheckType } from '../../middleware/authorize';

const campaignsServiceRouter = express.Router();

// Campaigns
campaignsServiceRouter.post('/', createCampaignValidation, validate, authorize(
    {
        type: AccessCheckType.ANY,
        levels: [
            AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
            AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
            AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
            AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
        ],
    },
), handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/campaigns`,
    method: 'post',
}));
campaignsServiceRouter.get('/:id', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/campaigns`,
    method: 'get',
}));
campaignsServiceRouter.post('/search/me', validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/campaigns`,
    method: 'post',
}));
campaignsServiceRouter.post('/search/all', validate, authorize(
    {
        type: AccessCheckType.ALL,
        levels: [
            AccessLevels.SUPER_ADMIN,
        ],
    },
), handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/campaigns`,
    method: 'post',
}));
campaignsServiceRouter.put('/:id', validate, authorize(
    {
        type: AccessCheckType.ANY,
        levels: [
            AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
            AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
            AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
            AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
        ],
    },
), handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/campaigns`,
    method: 'put',
}));
campaignsServiceRouter.put('/:id/status', validate, authorize(
    {
        type: AccessCheckType.ALL,
        levels: [
            AccessLevels.SUPER_ADMIN,
        ],
    },
), handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/campaigns`,
    method: 'put',
}));

export default campaignsServiceRouter;
