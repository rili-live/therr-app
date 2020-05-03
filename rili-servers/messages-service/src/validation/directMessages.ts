import {
    body,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createDirectMessageValidation = [
    body('toUserId').isNumeric().exists(),
    body('fromUserId').isNumeric().exists(),
    body('message').isString().exists(),
    body('isUnread').isBoolean().exists(),
];
