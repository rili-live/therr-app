import jwt from 'jsonwebtoken';
import unless from 'express-unless';
import handleHttpError from '../utilities/handleHttpError';
import isBlacklisted from '../utilities/isBlacklisted';
import { isTokenBlacklisted } from '../store/redisClient';
import authenticateApiKey from './authenticateApiKey';

const verifyJwt = (token: string, secret: string): Promise<any> => new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
        if (err) {
            return reject(err);
        }
        return resolve(decoded);
    });
});

const authenticate = async (req, res, next) => {
    try {
        // Support API key authentication via x-api-key header
        if (req.headers['x-api-key']) {
            return authenticateApiKey(req, res, next);
        }

        if (req.headers.authorization?.split(' ')[0] === 'Bearer') {
            const decoded = await verifyJwt(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET || '');

            // Check if token has been revoked (server-side logout)
            if (decoded.jti && await isTokenBlacklisted(decoded.jti)) {
                return handleHttpError({
                    res,
                    message: 'Token has been revoked',
                    statusCode: 401,
                });
            }

            if (isBlacklisted(req.ip)
            || (decoded && decoded.isBlocked && decoded.isBlocked === true && !req.path.includes('users-service/auth/logout'))) {
                return handleHttpError({
                    res,
                    message: "Invalid 'authorization.' User is blocked.",
                    statusCode: 403,
                });
            }

            req['x-userid'] = decoded.id;
            req['x-username'] = decoded.userName;
            req['x-user-access-levels'] = decoded.accessLevels ? JSON.stringify(decoded.accessLevels) : '[]';
            req['x-organizations'] = decoded.organizations ? JSON.stringify(decoded.organizations) : '{}';

            return next();
        }

        return handleHttpError({
            res,
            message: "Invalid 'authorization' header provided",
            statusCode: 401,
        });
    } catch (err: any) {
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

authenticate.unless = unless;

export default authenticate;
