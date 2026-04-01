import {
    body,
    param,
} from 'express-validator';

export const createApiKeyValidation = [
    body('name').optional().isString().isLength({ max: 128 }),
    body('accessLevels').optional().isArray(),
    body('accessLevels.*').optional().isString(),
];

export const revokeApiKeyValidation = [
    param('id').isUUID(),
];
