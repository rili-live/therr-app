import {
    body,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const updateNotificationValidation = [
    body('userId').isNumeric(),
    body('type').isString(),
    body('associationId').isNumeric(),
    body('isUnread').isBoolean(),
];
