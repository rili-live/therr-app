import { RequestHandler } from 'express';
import * as jwt from 'jsonwebtoken';
import { AccessLevels, CurrentSocialValuations } from 'therr-js-utilities/constants';
import printLogs from 'therr-js-utilities/print-logs';
import normalizeEmail from 'normalize-email';
import beeline from '../beeline';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { createUserToken } from '../utilities/userHelpers';
import translate from '../utilities/translator';
import { validateCredentials } from './helpers/user';

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

            return validateCredentials(userSearchResults, {
                locale,
                reqBody: {
                    isSSO: req.body.isSSO,
                    ssoProvider: req.body.ssoProvider,
                    nonce: req.body.nonce,
                    idToken: req.body.idToken,
                    password: req.body.password,
                    userPhoneNumber: req.body.userPhoneNumber,
                    userEmail: req.body.userEmail,
                    userFirstName: req.body.userFirstName,
                    userLastName: req.body.userLastName,
                },
            }, res).then(([isValid, userDetails]) => {
                if (isValid) {
                    const user = {
                        ...userDetails,
                        isSSO: !!req.body.isSSO,
                    };
                    const idToken = createUserToken(user, req.body.rememberMe);

                    // Fire and forget
                    // Reward inviting user for first time login
                    if (!userSearchResults?.length || userSearchResults[0].loginCount < 2) {
                        let invitesPromise: any;
                        if (req.body.phoneNumber) {
                            invitesPromise = Store.invites.getInvitesForPhoneNumber({ phoneNumber: userNameEmailPhone, isAccepted: false });
                        } else {
                            invitesPromise = Store.invites.getInvitesForEmail({ email: userNameEmailPhone, isAccepted: false });
                        }

                        invitesPromise.then((invites) => {
                            if (invites.length) {
                                // TODO: Log response
                                return Store.invites.updateInvite({ id: invites[0].id }, { isAccepted: true });
                            }

                            return Promise.resolve();
                        }).then((response) => {
                            if (response?.length) {
                                return Store.users.updateUser({
                                    settingsTherrCoinTotal: CurrentSocialValuations.invite,
                                }, {
                                    id: response[0]?.requestingUserId,
                                });
                            }

                            return Promise.resolve();
                        }).catch((err) => {
                            printLogs({
                                level: 'error',
                                messageOrigin: 'API_SERVER',
                                messages: [err?.message],
                                tracer: beeline,
                                traceArgs: {
                                    issue: '',
                                    port: process.env.USERS_SERVICE_API_PORT,
                                    processId: process.pid,
                                },
                            });
                        });
                    }

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
