import {
    body,
} from 'express-validator';

export const sendFeedbackValidation = [
    body('feedback').exists().isString(),
];

export const subscribersSignupValidation = [
    body('email').exists().isEmail().normalizeEmail(),
    // Set by the iOS waitlist dialogs on the two landing pages. The users-service coerces it
    // rather than trusting it, so this only rejects an obviously wrong type early.
    body('isSubscribedToIosWaitlist').optional().isBoolean(),
];
