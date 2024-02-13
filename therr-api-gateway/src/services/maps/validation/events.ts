import {
    body,
    header,
    param,
} from 'express-validator/check'; // eslint-disable-line import/extensions
import { createAreaValidation } from './areas';

export const getEventDetailsValidation = [
    header('authorization').optional(),
    header('x-userid').optional(),
    param('eventId').exists(),
    body('withMedia').isBoolean().optional(),
    body('withUser').isBoolean().optional(),
];

export const createEventValidations = [
    ...createAreaValidation,
    body('addressReadable').isString().optional(),
    body('scheduleStartAt').isString().exists(),
    body('scheduleStopAt').isString().exists(),
];
