import {
    body,
    header,
    param,
    query,
} from 'express-validator';
import { Reactions } from 'therr-js-utilities/constants';

export const createOrUpdateEventReactionValidation = [
    header('x-userid').exists(),
    param('eventId').isString().exists(),
    body('userViewCount').isInt({
        min: Reactions.USER_VIEW_COUNT_MIN,
        max: Reactions.USER_VIEW_COUNT_MAX,
    }).optional(),
    body('userHasActivated').isBoolean().optional(),
    body('userHasLiked').isBoolean().optional(),
    body('userHasSuperLiked').isBoolean().optional(),
    body('userHasDisliked').isBoolean().optional(),
    body('userHasReported').isBoolean().optional(),
    body('userHasSuperDisliked').isBoolean().optional(),
    body('userBookmarkCategory').optional(),
    body('userBookmarkPriority').isInt({
        min: Reactions.USER_BOOKMARK_PRIORITY_MIN,
        max: Reactions.USER_BOOKMARK_PRIORITY_MAX,
    }).optional(),
    body('rating').isInt({
        min: Reactions.RATING_MIN,
        max: Reactions.RATING_MAX,
    }).optional(),
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
