import {
    body,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const subscribersSignupValidation = [
    body('email').exists().isEmail().normalizeEmail(),
];
