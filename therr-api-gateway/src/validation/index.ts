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
        let nestedErrors;

        if (parameters[0] === '') {
            parameters = undefined;
        } else if (parameters[0] === '_error') {
            const mapped: any = result.mapped()['_error']; // eslint-disable-line dot-notation
            req.errorMessage = mapped.msg;
            parameters = mapped.nestedErrors.map((e: any) => e.param);
            nestedErrors = JSON.stringify(mapped.nestedErrors);
        }
        return handleHttpError({
            res,
            message: req.errorMessage || translate(locale, 'validation.defaultMessage'),
            resBody: {
                parameters,
                nestedErrors,
            },
            statusCode: 400,
        });
    }

    return next();
};
