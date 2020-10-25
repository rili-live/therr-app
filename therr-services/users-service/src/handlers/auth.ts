import { RequestHandler } from 'express';
import * as jwt from 'jsonwebtoken';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { createUserToken } from '../utilities/userHelpers';
import translate from '../utilities/translator';
import { validatePassword } from '../utilities/passwordUtils';
import accessLevels from '../constants/accessLevels';

// Authenticate user
const login: RequestHandler = (req: any, res: any) => Store.users
    .getUsers({ userName: req.body.userName }, { email: req.body.userName }, { phoneNumber: req.body.userName.replace(/\s/g, '') })
    .then(async (results) => {
        const locale = req.headers['x-localecode'] || 'en-us';

        if (!results.length) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.auth.noUserFound'),
                statusCode: 404,
            });
        }

        if (!results[0].accessLevels.includes(accessLevels.EMAIL_VERIFIED) && !results[0].accessLevels.includes(accessLevels.MOBILE_VERIFIED)) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.auth.accountNotVerified'),
                statusCode: 401,
            });
        }

        return validatePassword({
            hashedPassword: results[0].password,
            inputPassword: req.body.password,
            locale,
            oneTimePassword: results[0].oneTimePassword,
            res,
        }).then((isValid) => {
            if (isValid) {
                const idToken = createUserToken(results[0], req.body.rememberMe);
                const user = results[0];
                delete user.password; // don't send these in response
                delete user.oneTimePassword; // don't send these in response
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
