import {
    body,
    header,
    param,
    query,
} from 'express-validator';

export const createOrUpdateSpaceReactionValidation = [
    param('spaceId').isString().exists(),
    body('userViewCount').isNumeric().optional(),
    body('userHasActivated').isBoolean().optional(),
    body('userHasLiked').isBoolean().optional(),
    body('userHasSuperLiked').isBoolean().optional(),
    body('userHasDisliked').isBoolean().optional(),
    body('userHasReported').isBoolean().optional(),
    body('userHasSuperDisliked').isBoolean().optional(),
    body('userBookmarkCategory').optional(),
    body('userBookmarkPriority').isNumeric().optional(),
    body('rating').isNumeric().optional(),
];

export const getSpaceReactionsValidation = [
    header('x-userid').exists(),
    query('spaceId').optional(),
    query('spaceIds').optional(),
    query('limit').optional(),
];

export const getSpaceReactionsBySpaceIdValidation = [
    header('x-userid').exists(),
    param('spaceId').exists(),
    query('limit').optional(),
];

export const findSpaceReactionsDynamicValidation = [
    header('x-userid').exists(),
    body('spaceIds').exists(),
    body('userHasActivated').optional(),
    body('limit').optional(),
    body('order').optional(),
    body('offset').optional(),
];
