import {
    body,
    header,
    param,
    query,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createOrUpdateEventReactionValidation = [
    param('eventId').isString().exists(),
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

export const getEventReactionsValidation = [
    header('x-userid').exists(),
    query('eventId').optional(),
    query('eventIds').optional(),
    query('limit').optional(),
];

export const getEventReactionsByEventIdValidation = [
    header('x-userid').exists(),
    param('eventId').exists(),
    query('limit').optional(),
];

export const findEventReactionsDynamicValidation = [
    header('x-userid').exists(),
    body('eventIds').exists(),
    body('userHasActivated').optional(),
    body('limit').optional(),
    body('order').optional(),
    body('offset').optional(),
];
