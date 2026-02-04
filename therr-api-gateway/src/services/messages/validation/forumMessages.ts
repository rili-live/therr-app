import {
    body,
} from 'express-validator';

export const createForumMessageValidation = [
    body('forumId').isString().exists(),
    body('fromUserId').isString().exists(),
    body('message').isString().exists(),
];
