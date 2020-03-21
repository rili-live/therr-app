import {
    validationResult,
} from 'express-validator/check'; // eslint-disable-line import/extensions
import handleHttpError from '../utilities/handleHttpError';

export const validate = (req: any, res: any, next: any) => {
    const result = validationResult(req);
    /** Validate that the correct body, query params, and headers exist */
    if (!result.isEmpty()) {
        return handleHttpError({
            res,
            message: req.errorMessage || 'The required parameters were missing or invalid parameters were provided.',
            statusCode: 404,
        });
    }

    return next();
};
