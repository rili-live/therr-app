import {
    body,
} from 'express-validator';

export const sendFeedbackValidation = [
    body('feedback').exists().isString(),
];

export const subscribersSignupValidation = [
    body('email').exists().isEmail().normalizeEmail(),
];
