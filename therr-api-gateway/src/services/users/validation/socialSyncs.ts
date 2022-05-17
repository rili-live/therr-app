import {
    body,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createUpdateSocialSyncsValidation = [
    body('syncs').exists(),
    body('syncs.twitter').optional(),
    body('syncs.twitter.username').optional().isString(),
];
