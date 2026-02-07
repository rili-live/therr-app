import {
    body,
    header,
    param,
    query,
} from 'express-validator';

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

export const findMomentReactionsDynamicValidation = [
    header('x-userid').exists(),
    body('momentIds').exists(),
    body('userHasActivated').optional(),
    body('limit').optional(),
    body('order').optional(),
    body('offset').optional(),
];
