import {
    body,
    param,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const updateNotificationValidation = [
    param('notificationId').isString().exists(),
    body('isUnread').isBoolean(),
];
