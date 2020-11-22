import {
    body,
    oneOf,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createMomentValidation = [
    body('expiresAt').optional(),
    body('fromUserId').isNumeric().exists(),
    body('isPublic').isBoolean().optional(),
    body('message').isString().exists(),
    body('notificationMsg').isString().optional(),
    body('mediaIds').isString().optional(),
    body('mentionIds').isString().optional(),
    body('hashTags').isString().optional(),
    body('maxViews').isNumeric().optional(),
    body('latitude').isDecimal().exists(),
    body('longitude').isDecimal().exists(),
    oneOf([
        body('radius').isDecimal().exists(),
        body('polygonCoords').custom((polygonCoords, { req }) => {
            if (!Array.isArray(polygonCoords)) {
                return Promise.reject('polygonCoords must be an array'); // eslint-disable-line prefer-promise-reject-errors
            }
            const invalid = polygonCoords.some((polygonCoord) => {
                if (!Array.isArray(polygonCoord)
                    || polygonCoord.length !== 2
                    || !Number.isNaN(polygonCoord[0])
                    || !Number.isNaN(parseFloat(polygonCoord[0]))
                    || !Number.isNaN(polygonCoord[1])
                    || !Number.isNaN(parseFloat(polygonCoord[1]))) {
                    (req as any).errorMessage = 'polygonCoords must be an array of coordinate arrays (latitude,longitude)';
                    return true;
                }
                return false;
            });

            return invalid ? Promise.reject((req as any).errorMessage) : Promise.resolve();
        }),
    ]),
];

export const searchMomentsValidation = [
    body('longitude').exists(),
    body('latitude').exists(),
];
