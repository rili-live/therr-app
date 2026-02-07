import {
    validationResult,
} from 'express-validator';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';

export const validate = (req: any, res: any, next: any) => {
    const locale = req.headers['x-localecode'] || 'en-us';
    const result = validationResult(req);
    /** Validate that the correct body, query params, and headers exist */

    if (!result.isEmpty()) {
        let parameters: any = Object.keys(result.mapped());
        if (parameters[0] === '') {
            parameters = undefined;
        }
        return handleHttpError({
            res,
            message: req.errorMessage || translate(locale, 'validation'),
            resBody: {
                parameters,
            },
            statusCode: 400,
        });
    }

    return next();
};
