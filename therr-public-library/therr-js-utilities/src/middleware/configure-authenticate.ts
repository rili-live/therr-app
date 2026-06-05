import express from 'express';
import jwt from 'jsonwebtoken';
import { hasValidStandardClaims } from '../constants';

export default (handleHttpError: any) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET || '');
            // Reject forged/foreign tokens whose iss/aud claims don't match.
            // Legacy tokens without those claims still pass.
            if (!hasValidStandardClaims(decoded)) {
                return handleHttpError({
                    res,
                    message: "Invalid 'authorization' header provided",
                    statusCode: 401,
                });
            }
            return next();
        }

        return handleHttpError({
            res,
            message: "Invalid 'authorization' header provided",
            statusCode: 401,
        });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return handleHttpError({
                res,
                err,
                message: err.message,
                statusCode: 401,
            });
        }
        if (err.name === 'JsonWebTokenError') {
            return handleHttpError({
                res,
                err,
                message: err.message,
                statusCode: 403,
            });
        }

        return handleHttpError({ err, res, message: 'SQL:AUTH_ROUTES:ERROR' });
    }
};
