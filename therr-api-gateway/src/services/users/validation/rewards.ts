import {
    body,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createRewardsRequestValidation = [
    body('amount').exists().isNumeric(),
];
