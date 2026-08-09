import {
    body,
} from 'express-validator';

export const sendTestPushNotificationValidation = [
    body('deviceToken').isString().notEmpty().exists(),
    body('type').isString().optional(),
    // Defaults to true in the handler: a dry run asks FCM to validate the token
    // and credentials without delivering, which is what you want on a first pass
    // against a real user's device.
    body('dryRun').isBoolean().optional(),
    body('fromUserName').isString().optional(),
    body('habitName').isString().optional(),
    body('partnerName').isString().optional(),
    body('streakCount').isNumeric().optional(),
];

export default sendTestPushNotificationValidation;
