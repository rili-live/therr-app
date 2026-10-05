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
    // Set by the habits.therr.com/coaches waitlist form. The answers inside
    // coachesWaitlistDetails are whitelisted by the users-service (sanitizeCoachesWaitlistDetails),
    // which drops an unknown value rather than failing the signup, so only the shape is checked here.
    body('isSubscribedToCoachesWaitlist').optional().isBoolean(),
    body('coachesWaitlistDetails').optional().isObject(),
];
