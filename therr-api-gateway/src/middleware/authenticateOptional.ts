import jwt from 'jsonwebtoken';
import unless from 'express-unless';
import { hasValidStandardClaims } from 'therr-js-utilities/constants';
import handleHttpError from '../utilities/handleHttpError';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('api-gateway: JWT_SECRET environment variable is required');
}

/**
 * This middleware should be used cautiously and in rare situations where
 * the backing service has secure logic to mitigated authenticated/non-authenticated users
 */
const authenticateOptional = async (req, res, next) => {
    try {
        if (req.headers.authorization?.split(' ')[0] === 'Bearer') {
            await new Promise((resolve, reject) => {
                jwt.verify(req.headers.authorization.split(' ')[1], JWT_SECRET, (err, decoded) => {
                    if (err) {
                        return reject(err);
                    }

                    // Reject tokens whose iss/aud claims don't match (forged/foreign).
                    // Legacy tokens with no such claims still pass. Surface as a
                    // JsonWebTokenError so the catch maps it to a 403 like any other
                    // invalid token.
                    if (!hasValidStandardClaims(decoded)) {
                        const claimErr: any = new Error('invalid token claims');
                        claimErr.name = 'JsonWebTokenError';
                        return reject(claimErr);
                    }

                    req['x-userid'] = decoded.id;
                    req['x-username'] = decoded.userName;
                    req['x-user-access-levels'] = decoded.accessLevels ? JSON.stringify(decoded.accessLevels) : '[]';
                    req['x-organizations'] = decoded.organizations ? JSON.stringify(decoded.organizations) : '{}';

                    return resolve('');
                });
            });
        }

        // Authentication with this middleware is optional, so continue forward even if no authorization header exists
        return next();
    } catch (err: any) {
        // If the requesting user did supply an auth header, follow the normal logic for invalid tokens
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

authenticateOptional.unless = unless;

export default authenticateOptional;
