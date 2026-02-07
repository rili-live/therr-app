import {
    body,
} from 'express-validator';

export const createCampaignValidation = [
    body('title').exists().isString(),
    body('description').exists().isString(),
];
