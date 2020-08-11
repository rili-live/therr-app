import {
    validationResult,
} from 'express-validator/check'; // eslint-disable-line import/extensions
import translate from '../utilities/translator';

export const validate = (req: any, res: any, next: any) => {
    const locale = req.headers['x-localecode'] || 'en-us';
    const result = validationResult(req);
    /** Validate that the correct body, query params, and headers exist */
    if (!result.isEmpty()) {
        return res.status(400).json({
            message: req.errorMessage || translate(locale, 'validation'),
        });
    }
    next();
};
