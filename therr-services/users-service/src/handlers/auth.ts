import * as bcrypt from 'bcrypt';
import { RequestHandler } from 'express';
import * as jwt from 'jsonwebtoken';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { createUserToken } from '../utilities/userHelpers';
import translate from '../utilities/translator';

// Authenticate user
const login: RequestHandler = (req: any, res: any) => Store.users
    .getUsers({ userName: req.body.userName }, { email: req.body.userName })
    .then((results) => {
        const locale = req.headers['x-localecode'] || 'en-us';

        if (!results.length) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.auth.noUserFound'),
                statusCode: 404,
            });
        }
        return bcrypt
            .compare(req.body.password, results[0].password)
            .then((isValid) => {
                if (isValid) {
                    const idToken = createUserToken(results[0], req.body.rememberMe);
                    const user = results[0];
                    delete user.password;
                    return res.status(201).send({
                        ...user,
                        idToken,
                    });
                }

                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.auth.incorrectUserPass'),
                    statusCode: 401,
                });
            });
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:AUTH_ROUTES:ERROR' }));

// Logout user
const logout: RequestHandler = (req: any, res: any) => Store.users.getUsers({ userName: req.body.userName })
    .then((results) => {
        if (!results.length) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
            });
        }
        // TODO: Invalidate token
        res.status(204).send(req.request);
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:AUTH_ROUTES:ERROR' }));

const verifyToken: RequestHandler = (req: any, res: any) => {
    try {
        const decodedToken = jwt.verify(req.body.idToken, process.env.JWT_SECRET || '');
        return res.status(200).send(decodedToken);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return handleHttpError({
                res,
                err,
                message: err.message,
                statusCode: 401,
            });
        }

        return handleHttpError({ err, res, message: 'SQL:AUTH_ROUTES:ERROR' });
    }
};

export {
    login,
    logout,
    verifyToken,
};
