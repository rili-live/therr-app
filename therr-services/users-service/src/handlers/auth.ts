import { RequestHandler } from 'express';
import * as jwt from 'jsonwebtoken';
import { AccessLevels, CurrentSocialValuations } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import normalizeEmail from 'normalize-email';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { createUserToken } from '../utilities/userHelpers';
import translate from '../utilities/translator';
import { validateCredentials } from './helpers/user';
import TherrEventEmitter from '../api/TherrEventEmitter';

// Used to disguise customer info, but be consistent for same input string
const basicHash = (input: string) => {
    let hash = 0;
    let i;
    let chr;
    if (input.length === 0) return hash;
    for (i = 0; i < input.length; i += 1) {
        chr = input.charCodeAt(i);
        // eslint-disable-next-line no-bitwise
        hash = ((hash << 5) - hash) + chr;
        // eslint-disable-next-line no-bitwise
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

// Authenticate user
const login: RequestHandler = (req: any, res: any) => {
    const userNameEmailPhone = req.body.userName?.trim() || req.body.userEmail?.trim();

    const userHash = basicHash(userNameEmailPhone);

    return Store.users
        .getUsers(
            { userName: userNameEmailPhone },
            { email: normalizeEmail(userNameEmailPhone) },
            { phoneNumber: userNameEmailPhone.replace(/\s/g, '') },
        )
        .then((userSearchResults) => {
            const locale = req.headers['x-localecode'] || 'en-us';

            if (userSearchResults.length) {
                /**
                 * This is simply an event trigger. It could be triggered by a user logging in, or any other common event.
                 * We will probably want to move this to a scheduler to run at a set interval.
                 *
                 * Uses createdAt to target recently created users
                 */
                TherrEventEmitter.runThoughtReactionDistributorAlgorithm(userSearchResults[0].id, 'createdAt', 3);
            }

            if (!userSearchResults.length && !req.body.isSSO) {
                logSpan({
                    level: 'warn',
                    messageOrigin: 'API_SERVER',
                    messages: ['user auth failed: user not found'],
                    traceArgs: {
                        'user.hash': userHash,
                    },
                });
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.auth.noUserFound'),
                    statusCode: 404,
                });
            }

            if (!req.body.isSSO
                && !(userSearchResults[0].accessLevels.includes(AccessLevels.EMAIL_VERIFIED)
                    || userSearchResults[0].accessLevels.includes(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES))) {
                logSpan({
                    level: 'warn',
                    messageOrigin: 'API_SERVER',
                    messages: ['user auth failed: user not verified'],
                    traceArgs: {
                        'user.hash': userHash,
                    },
                });
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
                    ssoPlatform: req.body.ssoPlatform,
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

                    logSpan({
                        level: 'info',
                        messageOrigin: 'API_SERVER',
                        messages: ['user login success'],
                        traceArgs: {
                            'user.isSSO': req.body.isSSO,
                            'user.loginCount': !userSearchResults?.length ? 1 : userSearchResults[0].loginCount,
                            'user.hash': userHash,
                            'user.id': userDetails.id,
                        },
                    });

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
                            logSpan({
                                level: 'error',
                                messageOrigin: 'API_SERVER',
                                messages: [err?.message],
                                traceArgs: {
                                    issue: '',
                                    port: process.env.USERS_SERVICE_API_PORT,
                                    'process.id': process.pid,
                                },
                            });
                        });
                    }

                    return Store.users.updateUser({
                        accessLevels: JSON.stringify([...new Set(user.accessLevels)]),
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

                logSpan({
                    level: 'warn',
                    messageOrigin: 'API_SERVER',
                    messages: ['user auth failed: incorrect password'],
                    traceArgs: {
                        'user.hash': userHash,
                    },
                });

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
