import {
    body,
    query,
} from 'express-validator';
import { MetricNames } from 'therr-js-utilities/constants';

export const getSignedUrlValidation = [
    query('action').exists(),
    query('filename').exists(),
    query('overrideFromUserId').optional(),
];

export const createCheckInValidation = [
    body('name').isString().equals(MetricNames.SPACE_USER_CHECK_IN).exists(),
    body('spaceId').isString().exists(),
    body('longitude').isNumeric().exists(),
    body('latitude').isNumeric().exists(),
];
