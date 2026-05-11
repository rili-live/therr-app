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

export const getSpacePairingsValidation = [
    param('spaceId').exists(),
];

export const submitPairingFeedbackValidation = [
    param('spaceId').exists(),
    body('pairedSpaceId').isString().notEmpty(),
    body('isHelpful').isBoolean(),
];

// Shape-only check: defers full normalization to maps-service but rejects
// trivially-malformed requests at the edge so they don't burn an internal RPC.
const isOpeningHoursShape = (v: unknown): boolean => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    const obj = v as Record<string, unknown>;
    return Array.isArray(obj.schema)
        && obj.schema.length > 0
        && obj.schema.every((s) => typeof s === 'string')
        && typeof obj.timezone === 'string'
        && obj.timezone.trim().length > 0;
};

export const submitCorrectionValidation = [
    param('spaceId').isUUID(),
    body('fieldName').isIn(['phoneNumber', 'websiteUrl', 'openingHours']),
    body('value').exists(),
    body('value').custom((value, { req }) => {
        const fieldName = req.body?.fieldName;
        if (fieldName === 'phoneNumber' || fieldName === 'websiteUrl') {
            if (typeof value !== 'string' || !value.trim()) {
                throw new Error(`${fieldName} value must be a non-empty string`);
            }
            return true;
        }
        if (fieldName === 'openingHours') {
            if (!isOpeningHoursShape(value)) {
                throw new Error('openingHours value must be { schema: string[], timezone: string }');
            }
            return true;
        }
        return true;
    }),
];

export const getCorrectionsSummaryValidation = [
    header('authorization').exists(),
    header('x-userid').exists(),
    param('spaceId').isUUID(),
];
