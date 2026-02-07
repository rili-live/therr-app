import {
    body,
    header,
    param,
} from 'express-validator';

export const getThoughtDetailsValidation = [
    header('authorization').exists(),
    header('x-userid').exists(),
    param('thoughtId').exists(),
    body('withUser').isBoolean().optional(),
    body('withReplies').isBoolean().optional(),
];

export const createThoughtValidation = [
    body('parentId').optional(),
    body('category').optional(),
    body('expiresAt').optional(),
    body('fromUserId').isString().exists(),
    body('isPublic').isBoolean().optional(),
    body('isDraft').isBoolean().optional(),
    body('isRepost').isBoolean().optional(),
    body('message').isString().exists(),
    body('mediaIds').isString().optional(),
    body('mentionsIds').isString().optional(),
    body('hashTags').isString().optional(),
    body('maxViews').isNumeric().optional(),
];

export const updateThoughtValidation = [
    ...createThoughtValidation,
    param('momentId'),
];

export const searchThoughtsValidation = [
];

export const searchMyThoughtsValidation = [
];

export const deleteThoughtsValidation = [
    body('ids').isArray(),
];
