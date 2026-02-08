import {
    body,
} from 'express-validator';

export const postLocationChangeValidation = [
    body('radiusOfAwareness').isNumeric().optional(),
    body('radiusOfInfluence').isNumeric().optional(),
    body('latitude').isNumeric().exists(),
    body('longitude').isNumeric().exists(),
    body('lastLocationSendForProcessing').isNumeric().optional(),
];
