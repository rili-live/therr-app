import {
    body,
    param,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const updateNotificationValidation = [
    param('notificationId').exists(),
    body('isUnread').isBoolean(),
];
