import {
    body,
    param,
} from 'express-validator';

export const updateNotificationValidation = [
    param('notificationId').isString().exists(),
    body('isUnread').isBoolean(),
];
