import {
    body,
} from 'express-validator';

export const createUpdateSocialSyncsValidation = [
    body('syncs').exists(),
    body('syncs.facebook').optional(),
    body('syncs.facebook.userId').optional().isString(),
    body('syncs.instagram').optional(),
    body('syncs.instagram.userId').optional().isString(),
    body('syncs.tiktok').optional(),
    body('syncs.tiktok.username').optional().isString(),
    body('syncs.twitter').optional(),
    body('syncs.twitter.username').optional().isString(),
    body('syncs.youtube').optional(),
    body('syncs.youtube.username').optional().isString(),
];
