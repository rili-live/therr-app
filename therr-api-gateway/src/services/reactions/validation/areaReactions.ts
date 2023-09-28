import {
    body,
    header,
    oneOf,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const searchActiveAreasValidation = [
    header('authorization').exists(),
    header('x-userid').exists(),
    body('offset').exists(),
    body('limit').optional(),
    body('order').optional(),
    body('blockedUsers').exists().isArray(),
    body('shouldHideMatureContent').exists().isBoolean(),
    body('withMedia').isBoolean().optional(),
    body('withUser').isBoolean().optional(),
    body('userLatitude').isNumeric().optional(),
    body('userLongitude').isNumeric().optional(),
    body('lastContentCreatedAt').optional(),
    body('authorId').optional(),
];

export const searchActiveAreasByIdsValidation = [
    header('authorization').exists(),
    header('x-userid').exists(),
    body('blockedUsers').exists().isArray(),
    body('shouldHideMatureContent').exists().isBoolean(),
    body('withMedia').isBoolean().optional(),
    body('withUser').isBoolean().optional(),
    body('userLatitude').isNumeric().optional(),
    body('userLongitude').isNumeric().optional(),
    oneOf([
        body('momentIds').exists().isArray(),
        body('spaceIds').exists().isArray(),
    ]),
];

export const searchBookmarkedAreasValidation = searchActiveAreasValidation;
