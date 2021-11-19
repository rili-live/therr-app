import {
    body,
    header,
    param,
    query,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createOrUpdateMomentReactionValidation = [
    param('momentId').isString().exists(),
    body('userViewCount').isNumeric().optional(),
    body('userHasActivated').isBoolean().optional(),
    body('userHasLiked').isBoolean().optional(),
    body('userHasSuperLiked').isBoolean().optional(),
    body('userHasDisliked').isBoolean().optional(),
    body('userHasReported').isBoolean().optional(),
    body('userHasSuperDisliked').isBoolean().optional(),
    body('userBookmarkCategory').optional(),
    body('userBookmarkPriority').isNumeric().optional(),
];

export const getMomentReactionsValidation = [
    header('x-userid').exists(),
    query('momentId').optional(),
    query('momentIds').optional(),
    query('limit').optional(),
];

export const getMomentReactionsByMomentIdValidation = [
    header('x-userid').exists(),
    param('momentId').exists(),
    query('limit').optional(),
];

export const searchActiveMomentsValidation = [
    header('authorization').exists(),
    header('x-userid').exists(),
    body('offset').exists(),
    body('limit').optional(),
    body('order').optional(),
    body('blockedUsers').exists().isArray(),
    body('shouldHideMatureContent').exists().isBoolean(),
    body('withMedia').isBoolean().optional(),
    body('withUser').isBoolean().optional(),
];

export const searchBookmarkedMomentsValidation = searchActiveMomentsValidation;
