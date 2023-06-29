import {
    query,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const getSignedUrlValidation = [
    query('action').exists(),
    query('filename').exists(),
    query('overrideFromUserId').optional(),
];
