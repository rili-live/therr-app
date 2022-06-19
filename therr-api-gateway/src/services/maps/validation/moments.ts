import {
    body,
    header,
    param,
} from 'express-validator/check'; // eslint-disable-line import/extensions

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
    header('authorization').exists(),
    header('x-userid').exists(),
    param('momentId').exists(),
    body('withMedia').isBoolean().optional(),
    body('withUser').isBoolean().optional(),
];
