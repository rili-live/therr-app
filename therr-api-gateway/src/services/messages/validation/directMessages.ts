import {
    body,
} from 'express-validator';

export const createDirectMessageValidation = [
    body('toUserId').isString().exists(),
    body('fromUserId').isString().exists(),
    body('message').isString().exists(),
    body('isUnread').isBoolean().exists(),
];
