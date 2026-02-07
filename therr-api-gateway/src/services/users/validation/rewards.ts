import {
    body,
} from 'express-validator';

export const createRewardsRequestValidation = [
    body('amount').exists().isNumeric(),
    body('provider').optional().isString(),
];
