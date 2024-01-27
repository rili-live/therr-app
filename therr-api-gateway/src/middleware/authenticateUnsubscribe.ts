import * as jwt from 'jsonwebtoken';
import handleHttpError from '../utilities/handleHttpError';

const authenticateUnsubscribe = async (req, res, next) => {
    try {
        if (req.headers['x-subscriber-token']) {
            await new Promise((resolve, reject) => {
                jwt.verify(req.headers['x-subscriber-token'], process.env.JWT_EMAIL_SECRET || '', (err, decoded) => {
                    if (err) {
                        return reject(err);
                    }

                    req['x-userid'] = decoded.id;
                    req.body.email = decoded.email;

                    if (!decoded.id || !decoded.email) {
                        const tokenError = new Error('Decoded token is missing ID or E-mail');
                        tokenError.name = 'JsonWebTokenContentsError';
                        return reject(tokenError);
                    }

                    return resolve('');
                });
            });

            return next();
        }

        return handleHttpError({
            res,
            message: "Invalid 'x-subscriber-token' header provided",
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

export default authenticateUnsubscribe;
