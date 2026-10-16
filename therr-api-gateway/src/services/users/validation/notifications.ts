import {
    body,
    param,
} from 'express-validator';

export const updateNotificationValidation = [
    param('notificationId').isString().exists(),
    body('isUnread').isBoolean(),
];

export const recordPushOpenValidation = [
    body('notificationQueueId').isUUID(),
    body('pressActionId').optional().isString().isLength({ max: 100 }),
];
