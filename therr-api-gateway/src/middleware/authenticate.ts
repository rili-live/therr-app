import * as jwt from 'jsonwebtoken';
import unless from 'express-unless';
import handleHttpError from '../utilities/handleHttpError';

const authenticate = async (req, res, next) => {
    try {
        if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            await new Promise((resolve, reject) => {
                jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET || '', (err, decoded) => {
                    if (err) {
                        return reject(err);
                    }

                    req['x-userid'] = decoded.id;

                    if (decoded && decoded.isBlocked && decoded.isBlocked === true && !req.path.includes('users-service/auth/logout')) {
                        return handleHttpError({
                            res,
                            message: "Invalid 'authorization.' User is blocked.",
                            statusCode: 403,
                        });
                    }

                    return resolve('');
                });
            });

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
