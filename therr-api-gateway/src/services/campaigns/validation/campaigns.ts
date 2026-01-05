import {
    body,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createCampaignValidation = [
    body('title').exists().isString(),
    body('description').exists().isString(),
];
