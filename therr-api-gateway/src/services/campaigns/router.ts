import express from 'express';
import * as globalConfig from '../../../../global-config';
import handleServiceRequest from '../../middleware/handleServiceRequest';
import { validate } from '../../validation';
import {
    createCampaignValidation,
} from './validation/campaigns';

const campaignsServiceRouter = express.Router();

// Campaigns
campaignsServiceRouter.post('/', createCampaignValidation, validate, handleServiceRequest({
    basePath: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/campaigns/`,
    method: 'post',
}));

export default campaignsServiceRouter;
