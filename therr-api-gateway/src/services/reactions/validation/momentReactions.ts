import {
    body,
    header,
    param,
    query,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createMomentReactionValidation = [
    body('momentId').isNumeric().exists(),
    body('userViewCount').isNumeric().optional(),
    body('userHasActivated').isBoolean().optional(),
    body('userHasLiked').isBoolean().optional(),
    body('userHasSuperLiked').isBoolean().optional(),
    body('userHasDisliked').isBoolean().optional(),
    body('userHasSuperDisliked').isBoolean().optional(),
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

export const updateMomentReactionValidation = [
    param('momentId').isNumeric().exists(),
    body('userViewCount').isNumeric().optional(),
    body('userHasActivated').isBoolean().optional(),
    body('userHasLiked').isBoolean().optional(),
    body('userHasSuperLiked').isBoolean().optional(),
    body('userHasDisliked').isBoolean().optional(),
    body('userHasSuperDisliked').isBoolean().optional(),
];
