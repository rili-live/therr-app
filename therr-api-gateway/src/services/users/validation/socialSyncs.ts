import {
    body,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createUpdateSocialSyncsValidation = [
    body('syncs').exists(),
    body('syncs.facebook').optional(),
    body('syncs.facebook.userId').optional().isString(),
    body('syncs.instagram').optional(),
    body('syncs.instagram.userId').optional().isString(),
    body('syncs.twitter').optional(),
    body('syncs.twitter.username').optional().isString(),
];
