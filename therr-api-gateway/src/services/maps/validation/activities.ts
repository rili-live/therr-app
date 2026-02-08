import {
    body,
    header,
    param,
} from 'express-validator';

export const getActivityDetailsValidation = [
    header('authorization').optional(),
    header('x-userid').optional(),
    param('activityId').exists(),
    body('withMedia').isBoolean().optional(),
    body('withUser').isBoolean().optional(),
];

export const createActivityValidations = [
    body('memberCount').isNumeric().optional(),
];
