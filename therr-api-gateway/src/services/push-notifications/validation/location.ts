import {
    body,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const postLocationChangeValidation = [
    body('latitude').isNumeric().exists(),
    body('longitude').isNumeric().exists(),
    body('lastLocationSendForProcessing').isNumeric().optional(),
];
