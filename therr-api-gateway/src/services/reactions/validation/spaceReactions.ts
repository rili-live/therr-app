import {
    body,
    header,
    param,
    query,
} from 'express-validator';
import { Reactions } from 'therr-js-utilities/constants';

export const createOrUpdateSpaceReactionValidation = [
    header('x-userid').exists(),
    param('spaceId').isString().exists(),
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
