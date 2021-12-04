import {
    body,
    header,
    param,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const getSpaceDetailsValidation = [
    header('authorization').exists(),
    header('x-userid').exists(),
    param('spaceId').exists(),
    body('withMedia').isBoolean().optional(),
    body('withUser').isBoolean().optional(),
];
