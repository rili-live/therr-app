import { body, param } from 'express-validator';

// Drops — see docs/DROPS.md. The users-service re-validates every field (utilities/drops.ts);
// this only rejects requests that are malformed outright.

export const dropIdValidation = [
    param('id').isUUID(),
];

export const createDropValidation = [
    body('recipientIds').isArray({ min: 1, max: 10 }),
    body('recipientIds.*').isUUID(),
    body('message').optional().isString().isLength({ max: 500 }),
    body('media').optional({ nullable: true }).isObject(),
    body('media.path').optional().isString(),
    body('media.type').optional().isString(),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('placeName').optional().isString().isLength({ max: 120 }),
    body('spaceId').optional({ nullable: true }).isUUID(),
    body('unlockRadiusMeters').optional().isNumeric(),
];

export const openDropValidation = [
    param('id').isUUID(),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('accuracy').optional().isNumeric(),
    body('shouldNotifySender').optional().isBoolean(),
];
