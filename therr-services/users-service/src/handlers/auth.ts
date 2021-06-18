import { RequestHandler } from 'express';
import * as jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { AccessLevels } from 'therr-js-utilities/constants';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { createUserToken } from '../utilities/userHelpers';
import translate from '../utilities/translator';
import { validatePassword } from '../utilities/passwordUtils';
import { createUserHelper } from './users';
import * as globalConfig from '../../../../global-config';

const googleOAuth2ClientId = `${globalConfig[process.env.NODE_ENV].googleOAuth2WebClientId}`;
const googleOAuth2Client = new OAuth2Client(googleOAuth2ClientId);

// Authenticate user
const login: RequestHandler = (req: any, res: any) => {
    const userNameEmailPhone = req.body.userName || req.body.userEmail;

    return Store.users
        .getUsers({ userName: userNameEmailPhone }, { email: userNameEmailPhone }, { phoneNumber: userNameEmailPhone.replace(/\s/g, '') })
        .then((userSearchResults) => {
            const locale = req.headers['x-localecode'] || 'en-us';

            if (!userSearchResults.length && !req.body.isSSO) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.auth.noUserFound'),
                    statusCode: 404,
                });
            }

            if (!req.body.isSSO
                && !(userSearchResults[0].accessLevels.includes(AccessLevels.EMAIL_VERIFIED)
                    || userSearchResults[0].accessLevels.includes(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES))) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.auth.accountNotVerified'),
                    statusCode: 401,
                });
            }

            // eslint-disable-next-line arrow-body-style
            const validateCredentials = () => {
                if (req.body.isSSO) {
                    return googleOAuth2Client.verifyIdToken({
                        idToken: req.body.idToken,
                        audience: googleOAuth2ClientId, // Specify the CLIENT_ID of the app that accesses the backend
                        // Or, if multiple clients access the backend:
                        // [CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
                    }).then((response) => {
                        // Make sure that Google account email is verified
                        if (!response.getPayload()?.email_verified) {
                            return [false, userSearchResults[0]];
                        }

                        if (!userSearchResults.length) { // First time SSO login
                            return createUserHelper({
                                email: req.body.userEmail,
                                firstName: req.body.userFirstName,
                                lastName: req.body.userLastName,
                            }, true).then((user) => [true, user]);
                        }

                        return [true, userSearchResults[0]];
                    });
                }

                return validatePassword({
                    hashedPassword: userSearchResults[0].password,
                    inputPassword: req.body.password,
                    locale,
                    oneTimePassword: userSearchResults[0].oneTimePassword,
                    res,
                }).then((isSuccess) => [isSuccess, userSearchResults[0]]);
            };

            return validateCredentials().then(([isValid, userDetails]) => {
                if (isValid) {
                    const user = {
                        ...userDetails,
                        isSSO: !!req.body.isSSO,
                    };
                    const idToken = createUserToken(user, req.body.rememberMe);
                    delete user.password; // don't send these in response
                    delete user.oneTimePassword; // don't send these in response

                    // Fire and forget
                    Store.users.updateUser({
                        loginCount: user.loginCount + 1,
                    }, {
                        id: user.id,
                    });

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
};

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
