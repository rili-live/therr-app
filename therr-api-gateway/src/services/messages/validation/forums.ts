import {
    body,
    param,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createForumValidation = [
    body('administratorIds').exists().isNumeric(),
    body('title').exists().isString(),
    body('subtitle').exists().isString(),
    body('description').exists().isString(),
    body('categoryTags').exists().isArray(),
    body('hashtags').optional().isString(),
    body('integrationIds').exists().isArray(),
    body('invitees').exists().isArray(),
    body('iconGroup').exists().isString(),
    body('iconId').exists().isString(),
    body('iconColor').exists().isString(),
    body('maxCommentsPerMin').optional().isNumeric(),
    body('doesExpire').optional().isBoolean(),
    body('isPublic').optional().isBoolean(),
];

export const searchForumsValidation = [
    body('usersInvitedForumIds').optional().isArray(),
    body('categoryTags').optional().isArray(),
    body('forumIds').optional().isArray(),
];

export const updateForumValidation = [
    param('forumId').exists(),
    body('administratorIds').optional().isNumeric(),
    body('title').optional().isString(),
    body('subtitle').optional().isString(),
    body('description').optional().isString(),
    body('categoryTags').optional().isArray(),
    body('hashtags').optional().isString(),
    body('integrationIds').optional().isArray(),
    body('invitees').optional().isArray(),
    body('iconGroup').optional(),
    body('iconId').optional().isString(),
    body('iconColor').optional().isString(),
    body('maxCommentsPerMin').optional().isNumeric(),
    body('doesExpire').optional().isBoolean(),
    body('isPublic').optional().isBoolean(),
];
