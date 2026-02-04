import {
    body,
    header,
    query,
    param,
} from 'express-validator';

export const searchActiveThoughtsValidation = [
    header('authorization').exists(),
    header('x-userid').exists(),
    body('offset').exists(),
    body('limit').optional(),
    body('order').optional(),
    body('blockedUsers').exists().isArray(),
    body('shouldHideMatureContent').exists().isBoolean(),
    body('withUser').isBoolean().optional(),
    body('withReplies').isBoolean().optional(),
    body('lastContentCreatedAt').optional(),
    body('authorId').optional(),
];

export const createOrUpdateThoughtReactionValidation = [
    param('thoughtId').isString().exists(),
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

export const getThoughtReactionsValidation = [
    header('x-userid').exists(),
    query('thoughtId').optional(),
    query('thoughtIds').optional(),
    query('limit').optional(),
];

export const getThoughtReactionsByThoughtIdValidation = [
    header('x-userid').exists(),
    param('thoughtId').exists(),
    query('limit').optional(),
];

export const findThoughtReactionsDynamicValidation = [
    header('x-userid').exists(),
    body('thoughtIds').exists(),
    body('userHasActivated').optional(),
    body('limit').optional(),
    body('order').optional(),
    body('offset').optional(),
];

export const searchBookmarkedThoughtsValidation = searchActiveThoughtsValidation;
