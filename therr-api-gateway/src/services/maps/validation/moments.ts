import {
    body,
    header,
    param,
} from 'express-validator';

export const createIntegratedMomentValidation = [
    header('authorization').exists(),
    header('x-userid').exists(),
    body('platform').isString().exists(),
    body('accessToken').exists(),
    body('mediaId').exists(),
];

export const dynamicCreateIntegratedMomentValidation = [
    header('authorization').exists(),
    header('x-userid').exists(),
    body('platform').isString().exists(),
    body('media').exists(),
    body('userId').exists(),
];

export const getMomentDetailsValidation = [
    header('authorization').optional(),
    header('x-userid').optional(),
    param('momentId').exists(),
    body('withMedia').isBoolean().optional(),
    body('withUser').isBoolean().optional(),
];
