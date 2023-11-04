import { RequestHandler } from 'express';
import * as jwt from 'jsonwebtoken';
import { AccessLevels, CurrentSocialValuations, OAuthIntegrationProviders } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import normalizePhoneNumber from 'therr-js-utilities/normalize-phone-number';
import normalizeEmail from 'normalize-email';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { createUserToken } from '../utilities/userHelpers';
import translate from '../utilities/translator';
import { redactUserCreds, validateCredentials } from './helpers/user';
import TherrEventEmitter from '../api/TherrEventEmitter';
import decryptIntegrationsAccess from '../utilities/decryptIntegrationsAccess';

// calling normalizeEmail on a userName will have no change
const userNameOrEmailOrPhone = (user) => normalizeEmail(user.userName?.trim() || user.userEmail?.trim() || user.email?.trim()?.replace(/\s/g, '') || '')
    || normalizePhoneNumber(
        user.userName?.trim()?.replace(/\s/g, '')
            || user.userEmail?.trim()?.replace(/\s/g, '')
            || user.phoneNumber?.trim()?.replace(/\s/g, '') || '',
    );

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
    const authHeader = req.headers.authorization;
    const userId = req.headers['x-userid'];
    // TODO: Mitigate user with multiple accounts attached to the same phone number.
    // Logging in by phone number should attach to all accounts with that phone number and allow them to pick one
    let userNameEmailPhone = userNameOrEmailOrPhone(req.body);
    let userEmail = normalizeEmail(req.body.userName?.trim() || req.body.userEmail?.trim() || req.body.email?.trim()?.replace(/\s/g, '') || '');
    let userPhone = normalizePhoneNumber(
        req.body.userName?.trim()?.replace(/\s/g, '')
            || req.body.userEmail?.trim()?.replace(/\s/g, '')
            || req.body.email?.trim()?.replace(/\s/g, '')
            || req.body.phoneNumber?.trim()?.replace(/\s/g, '') || '',
    );

    let userHash = userNameEmailPhone ? basicHash(userNameEmailPhone) : undefined;
    let getUsersPromise;

    /**
     * This ensures that already authenticated users associate any oauth2 integrations with their already logged in account.
     * It also prevents creating a new account if the oauth2 user's email does not match the logged in user's email
     */
    if (userId && authHeader) {
        // TODO: Test security concerns like a DDOS attack
        // We should verify the auth bearer token first
        // Consider making this an optionally authed endpoint in API gateway
        getUsersPromise = Store.users.getUsers({ id: userId });
    } else {
        getUsersPromise = userNameEmailPhone
            ? Store.users
                .getUsers(
                    { userName: userNameEmailPhone },
                    { email: userNameEmailPhone },
                    { phoneNumber: userNameEmailPhone },
                )
            : Promise.resolve([]);
    }

    return getUsersPromise
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
                && !(userSearchResults[0]?.accessLevels?.includes(AccessLevels.EMAIL_VERIFIED)
                    || userSearchResults[0]?.accessLevels?.includes(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES))) {
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
                    isDashboard: req.body.isDashboard,
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
            }, res).then(([isValid, userDetails, oauthResponseData]) => {
                if (isValid) {
                    const user = {
                        ...userDetails,
                        isSSO: !!req.body.isSSO,
                        integrations: {
                            ...decryptIntegrationsAccess(userDetails?.integrationsAccess),
                        },
                    };
                    if (oauthResponseData?.access_token) {
                        // TODO: Store access_tokens encrypted in DB for fetching
                        // TODO: Fetch stored access_tokens and return in integrations object
                        user.integrations[OAuthIntegrationProviders.FACEBOOK] = {
                            user_access_token: oauthResponseData.access_token,
                            user_access_token_expires_at: Date.now() + ((oauthResponseData?.expires_in || 0) * 1000),
                        };
                    }
                    userNameEmailPhone = userNameOrEmailOrPhone(userDetails);

                    userEmail = userDetails.email?.trim() || ''; // DB response values should already be normalized
                    userPhone = userDetails.phoneNumber?.trim()?.replace(/\s/g, ''); // DB response values should already be normalized
                    const idToken = createUserToken(user, req.body.rememberMe);
                    userHash = basicHash(userNameEmailPhone);

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
                        if (userPhone) {
                            invitesPromise = Store.invites.getInvitesForPhoneNumber({
                                phoneNumber: userPhone,
                                isAccepted: false,
                            });
                        } else if (userEmail) {
                            invitesPromise = Store.invites.getInvitesForEmail({ email: normalizeEmail(userEmail.trim()), isAccepted: false });
                        } else {
                            invitesPromise = Promise.resolve([]);
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
                        integrationsAccess: user.integrations,
                    }, {
                        id: user.id,
                    }).then((userResponse) => {
                        const finalUser = userResponse[0];
                        // Remove credentials from object
                        redactUserCreds(finalUser);
                        // TODO: Save, Decrypt, and return stored user integrations
                        // const storedIntegrations = decryptIntegrationsAccess(access);
                        return res.status(201).send({
                            ...finalUser,
                            idToken,
                            integrations: user.integrations || {},
                            rememberMe: req.body.rememberMe,
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
