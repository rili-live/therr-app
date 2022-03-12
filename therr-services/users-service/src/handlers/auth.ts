import { RequestHandler } from 'express';
import * as jwt from 'jsonwebtoken';
import appleSignin from 'apple-signin-auth';
import { OAuth2Client } from 'google-auth-library';
import { AccessLevels } from 'therr-js-utilities/constants';
import normalizeEmail from 'normalize-email';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { createUserToken } from '../utilities/userHelpers';
import translate from '../utilities/translator';
import { validatePassword } from '../utilities/passwordUtils';
import { createUserHelper, isUserProfileIncomplete } from './users';
import * as globalConfig from '../../../../global-config';

const googleOAuth2ClientId = `${globalConfig[process.env.NODE_ENV].googleOAuth2WebClientId}`;
const googleOAuth2Client = new OAuth2Client(googleOAuth2ClientId);

// Authenticate user
const login: RequestHandler = (req: any, res: any) => {
    const userNameEmailPhone = req.body.userName?.trim() || req.body.userEmail?.trim();

    return Store.users
        .getUsers(
            { userName: userNameEmailPhone },
            { email: normalizeEmail(userNameEmailPhone) },
            { phoneNumber: userNameEmailPhone.replace(/\s/g, '') },
        )
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
                    let verifyTokenPromise;
                    if (req.body.ssoProvider === 'google') {
                        verifyTokenPromise = googleOAuth2Client.verifyIdToken({
                            idToken: req.body.idToken,
                            audience: googleOAuth2ClientId, // Specify the CLIENT_ID of the app that accesses the backend
                            // Or, if multiple clients access the backend:
                            // [CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
                        });
                    } else if (req.body.ssoProvider === 'apple') {
                        verifyTokenPromise = appleSignin.verifyIdToken(req.body.idToken, {
                            // Optional Options for further verification - Full list can be found
                            // here https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback
                            audience: 'com.therr.mobile.Therr', // client id - can also be an array
                            nonce: req.body.nonce,
                            ignoreExpiration: false, // default is false
                        });
                    } else {
                        verifyTokenPromise = Promise.reject(new Error('Unsupported SSO Provider'));
                    }
                    return verifyTokenPromise.then((response) => {
                        // Make sure that Google account email is verified
                        if ((req.body.ssoProvider === 'google' && !response.getPayload()?.email_verified)
                            || (req.body.ssoProvider === 'apple' && !response.email_verified)) {
                            return [false, userSearchResults[0]];
                        }

                        if (!userSearchResults.length) { // First time SSO login
                            return createUserHelper({
                                email: req.body.userEmail,
                                firstName: req.body.userFirstName,
                                lastName: req.body.userLastName,
                            }, true).then((user) => [true, user]);
                        }

                        // Verify user because they are using email SSO
                        const isMissingUserProps = isUserProfileIncomplete(userSearchResults[0]);
                        const userAccessLevels = [
                            AccessLevels.DEFAULT,
                        ];
                        if (isMissingUserProps) {
                            userAccessLevels.push(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
                        } else {
                            userAccessLevels.push(AccessLevels.EMAIL_VERIFIED);
                        }

                        return [true, { ...userSearchResults[0], accessLevels: userAccessLevels }];
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

                    // Fire and forget
                    return Store.users.updateUser({
                        accessLevels: JSON.stringify(user.accessLevels),
                        loginCount: user.loginCount + 1,
                    }, {
                        id: user.id,
                    }).then((userResponse) => {
                        const finalUser = userResponse[0];
                        delete finalUser.password; // don't send these in response
                        delete finalUser.oneTimePassword; // don't send these in response
                        return res.status(201).send({
                            ...finalUser,
                            idToken,
                        });
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
    } catch (err: any) {
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
