import {
    body,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createForumMessageValidation = [
    body('forumId').isString().exists(),
    body('fromUserId').isString().exists(),
    body('message').isString().exists(),
];
