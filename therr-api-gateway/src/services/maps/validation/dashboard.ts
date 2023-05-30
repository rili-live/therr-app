import {
    body,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const requestSpaceClaimValidation = [
    body('address').exists().isString(),
    body('longitude').optional().isNumeric(),
    body('latitude').optional().isNumeric(),
    body('title').exists().isString(),
    body('description').exists().isString(),
];
