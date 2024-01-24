import {
    body,
    header,
    param,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const getEventDetailsValidation = [
    header('authorization').optional(),
    header('x-userid').optional(),
    param('eventId').exists(),
    body('withMedia').isBoolean().optional(),
    body('withUser').isBoolean().optional(),
];
