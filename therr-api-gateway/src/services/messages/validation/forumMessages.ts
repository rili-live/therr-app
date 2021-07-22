import {
    body,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createForumMessageValidation = [
    body('forumId').isNumeric().exists(),
    body('fromUserId').isNumeric().exists(),
    body('message').isString().exists(),
];
