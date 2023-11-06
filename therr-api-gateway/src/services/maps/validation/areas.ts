import {
    body,
    oneOf,
    query,
    param,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createAreaValidation = [
    body('address').optional().isString(),
    body('areaType').optional(),
    body('category').optional(),
    body('expiresAt').optional(),
    body('fromUserId').isString().exists(),
    body('isDashboard').isBoolean().optional(),
    body('spaceId').isString().optional(),
    body('isPublic').isBoolean().optional(),
    body('isDraft').isBoolean().optional(),
    body('message').isString().exists(),
    body('notificationMsg').isString().optional(),
    body('mediaIds').isString().optional(),
    body('mentionsIds').isString().optional(),
    body('hashTags').isString().optional(),
    body('maxViews').isNumeric().optional(),
    body('maxProximity').isDecimal().optional(),
    body('latitude').isDecimal().exists().isNumeric(),
    body('longitude').isDecimal().exists().isNumeric(),
    body('media').isArray().optional(), // TODO: Add granularity
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

export const updateAreaValidation = [
    param('momentId'),
    body('address').optional().isString(),
    body('category').optional(),
    body('expiresAt').optional(),
    body('spaceId').isString().optional(),
    body('isPublic').isBoolean().optional(),
    body('isDraft').isBoolean().optional(),
    body('message').isString().optional(),
    body('notificationMsg').isString().optional(),
    body('mediaIds').isString().optional(),
    body('mentionsIds').isString().optional(),
    body('hashTags').isString().optional(),
    body('maxViews').isNumeric().optional(),
    body('maxProximity').isDecimal().optional(),
    body('latitude').isDecimal().optional().isNumeric(),
    body('longitude').isDecimal().optional().isNumeric(),
    body('media').isArray().optional(), // TODO: Add granularity
    body('addressStreetAddress').optional(),
    body('addressRegion').optional(),
    body('addressLocality').optional(),
    body('postalCode').optional(),
    body('phoneNumber').isString().optional(),
    body('websiteUrl').isString().optional(),
    body('priceRange').isNumeric().optional(),
    body('thirdPartyRatings').optional(),
    body('openingHours').optional(),
];

export const searchAreasValidation = [
    query('longitude').exists(),
    query('latitude').exists(),
];

export const searchMyAreasValidation = [
];

export const deleteAreasValidation = [
    body('ids').isArray(),
];
