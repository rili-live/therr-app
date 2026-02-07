import {
    body,
    header,
    param,
} from 'express-validator';
import { createAreaValidation, updateAreaValidation } from './areas';

export const getAsPostSpaceDetailsValidation = [
    header('authorization').exists(),
    header('x-userid').exists(),
    param('spaceId').exists(),
    body('withMedia').isBoolean().optional(),
    body('withUser').isBoolean().optional(),
];

export const getSpaceDetailsValidation = [
    header('authorization').optional(),
    header('x-userid').optional(),
    param('spaceId').exists(),
    body('withMedia').isBoolean().optional(),
    body('withUser').isBoolean().optional(),
];

export const createSpaceValidation = [
    ...createAreaValidation,
    body('addressReadable').isString().optional(),
    body('featuredIncentiveKey').isString().optional(),
    body('featuredIncentiveValue').isNumeric().optional(),
    body('featuredIncentiveRewardKey').isString().optional(),
    body('featuredIncentiveRewardValue').isNumeric().optional(),
    body('featuredIncentiveCurrencyId').isString().optional(),
];

export const updateSpaceValidation = [
    ...updateAreaValidation,
    param('spaceId'),
];
