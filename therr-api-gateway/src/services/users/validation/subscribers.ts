import {
    body,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const sendFeedbackValidation = [
    body('feedbacok').exists().isString(),
];

export const subscribersSignupValidation = [
    body('email').exists().isEmail().normalizeEmail(),
];
