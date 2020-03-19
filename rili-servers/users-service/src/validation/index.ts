import {
    validationResult,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const validate = (req: any, res: any, next: any) => {
    const result = validationResult(req);
    /** Validate that the correct body, query params, and headers exist */
    if (!result.isEmpty()) {
        return res.status(400).json({
            message: req.errorMessage || 'The required parameters were not provided.',
        });
    }
    next();
};
