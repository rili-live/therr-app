import {
    body,
    param,
} from 'express-validator';

export const createForumValidation = [
    body('administratorIds').exists().isString(),
    body('title').exists().isString(),
    body('subtitle').exists().isString(),
    body('description').exists().isString(),
    body('categoryTags').exists().isArray(),
    body('hashTags').optional().isString(),
    body('integrationIds').optional().isString(),
    body('invitees').optional().isString(),
    body('iconGroup').exists().isString(),
    body('iconId').exists().isString(),
    body('iconColor').exists().isString(),
    body('maxCommentsPerMin').optional().isNumeric(),
    body('doesExpire').optional().isBoolean(),
    body('isPublic').optional().isBoolean(),
];

// Improve validation
export const createActivityValidation = [
    body('group').exists(),
    body('event').exists(),
];

export const searchForumsValidation = [
    body('usersInvitedForumIds').optional().isArray(),
    body('categoryTags').optional().isArray(),
    body('forumIds').optional().isArray(),
];

export const updateForumValidation = [
    param('forumId').exists(),
    body('administratorIds').optional().isString(),
    body('title').optional().isString(),
    body('subtitle').optional().isString(),
    body('description').optional().isString(),
    body('categoryTags').optional().isArray(),
    body('hashTags').optional().isString(),
    body('integrationIds').optional().isString(),
    body('invitees').optional().isString(),
    body('iconGroup').optional(),
    body('iconId').optional().isString(),
    body('iconColor').optional().isString(),
    body('maxCommentsPerMin').optional().isNumeric(),
    body('doesExpire').optional().isBoolean(),
    body('isPublic').optional().isBoolean(),
];
