import { RequestHandler } from 'express';
import { AccessLevels } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import normalizeEmail from 'normalize-email';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { hashPassword, createUserToken, createRefreshToken } from '../utilities/userHelpers';
import generateCode from '../utilities/generateCode';
import generateOneTimePassword from '../utilities/generateOneTimePassword';
import decryptIntegrationsAccess from '../utilities/decryptIntegrationsAccess';
import { sendVerificationEmail } from '../api/email';
import sendOneTimePasswordEmail from '../api/email/sendOneTimePasswordEmail';
import { isUserProfileIncomplete, redactUserCreds } from './helpers/user';

const createOneTimePassword = (req, res) => {
    const {
        locale,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    const { email, isDashboardRegistration } = req.body;

    return Store.users.getUserByConditions({ email: normalizeEmail(email) })
        .then((userDetails) => {
            if (!userDetails.length) {
                return handleHttpError({
                    res,
                    message: 'User not found',
                    statusCode: 404,
                });
            }

            const msExpiresAt = Date.now() + (1000 * 60 * 60 * 48); // 48 hours
            const otPassword = generateOneTimePassword(8);

            return hashPassword(otPassword)
                .then((hash) => Store.users.updateUser({
                    oneTimePassword: `${hash}:${msExpiresAt}`,
                }, {
                    email,
                }))
                .then(() => sendOneTimePasswordEmail({
                    locale,
                    toAddresses: [email],
                    agencyDomainName: whiteLabelOrigin,
                    brandVariation,
                }, {
                    name: email,
                    oneTimePassword: otPassword,
                }, isDashboardRegistration || userDetails[0].accessLevels.includes(AccessLevels.DASHBOARD_SIGNUP)))
                .then(() => res.status(200).send({ message: 'One time password created and sent' }))
                .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));
        });
};

const verifyUserAccount = (req, res) => {
    const {
        token,
    } = req.params;

    let decodedToken;

    try {
        decodedToken = token && Buffer.from(token, 'base64').toString('ascii');
        decodedToken = JSON.parse(decodedToken);
    } catch (e: any) {
        return handleHttpError({ err: e, res, message: 'SQL:USER_ROUTES:ERROR' });
    }

    return Store.users.getUserByConditions({ email: normalizeEmail(decodedToken.email) })
        .then((userSearchResults) => {
            if (!userSearchResults.length) {
                return handleHttpError({
                    res,
                    message: `No user found with email ${decodedToken.email}.`,
                    statusCode: 404,
                });
            }

            const existingAccessLevels = userSearchResults[0].accessLevels || [];
            if (existingAccessLevels.includes(AccessLevels.EMAIL_VERIFIED)
                || existingAccessLevels.includes(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES)) {
                return handleHttpError({
                    res,
                    message: 'Email already verified',
                    statusCode: 400,
                });
            }

            const userVerificationCodes = userSearchResults[0].verificationCodes;
            return Store.verificationCodes.getCode({
                code: decodedToken.code,
                type: req.body.type,
            })
                .then(async (codeResults) => {
                    if (!codeResults.length) {
                        return handleHttpError({
                            res,
                            message: 'No verification code found',
                            statusCode: 404,
                        });
                    }

                    const isExpired = codeResults[0].msExpiresAt <= Date.now();

                    if (isExpired) {
                        return handleHttpError({
                            res,
                            message: 'Token has expired',
                            statusCode: 400,
                        });
                    }

                    const userHasMatchingCode = userVerificationCodes[codeResults[0].type]
                        && userVerificationCodes[codeResults[0].type].code
                        && userVerificationCodes[codeResults[0].type].code === codeResults[0].code;

                    if (userHasMatchingCode) {
                        userVerificationCodes[codeResults[0].type] = {}; // clear out used code

                        const isMissingUserProps = isUserProfileIncomplete(userSearchResults[0]);
                        const userAccessLevels = new Set(
                            userSearchResults[0].accessLevels,
                        );
                        if (isMissingUserProps) {
                            userAccessLevels.add(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
                        } else {
                            userAccessLevels.add(AccessLevels.EMAIL_VERIFIED);
                        }

                        await Store.users.updateUser({
                            accessLevels: JSON.stringify([...userAccessLevels]),
                            verificationCodes: JSON.stringify(userVerificationCodes),
                        }, {
                            email: decodedToken.email,
                        });

                        // Set expire rather than delete (gives a window for user to see if already verified)
                        await Store.verificationCodes.updateCode({ msExpiresAt: Date.now() }, { id: codeResults[0].id });

                        // Generate auth tokens so client can auto-login after verification
                        const verifiedUser = {
                            ...userSearchResults[0],
                            accessLevels: [...userAccessLevels],
                            isSSO: false,
                            integrations: {
                                ...decryptIntegrationsAccess(userSearchResults[0]?.integrationsAccess),
                            },
                        };
                        const userOrgs = await Store.userOrganizations.get({
                            userId: verifiedUser.id,
                        }).catch(() => []);
                        const idToken = createUserToken(verifiedUser, userOrgs);
                        const refreshTokenData = createRefreshToken(verifiedUser.id);

                        redactUserCreds(verifiedUser);

                        return res.status(200).send({
                            message: 'Account successfully verified',
                            ...verifiedUser,
                            idToken,
                            refreshToken: refreshTokenData.token,
                            userOrganizations: userOrgs,
                        });
                    }

                    return handleHttpError({
                        res,
                        message: 'Invalid token',
                        statusCode: 400,
                    });
                })
                .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));
        });
};

const resendVerification: RequestHandler = (req: any, res: any) => {
    const {
        locale,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    // TODO: Supply user agent to determine if web or mobile
    const codeDetails = generateCode({ email: req.body.email, type: req.body.type });
    const verificationCode = { type: codeDetails.type, code: codeDetails.code };
    let userVerificationCodes;

    return Store.users.getUserByConditions({
        email: normalizeEmail(req.body.email),
    })
        .then((users) => {
            if (!users.length) {
                return handleHttpError({
                    res,
                    message: 'User not found',
                    statusCode: 404,
                });
            }

            if (users[0].accessLevels.includes(AccessLevels.EMAIL_VERIFIED)) {
                return handleHttpError({
                    res,
                    message: 'Email already verified',
                    statusCode: 400,
                });
            }

            userVerificationCodes = users[0].verificationCodes;
            userVerificationCodes[codeDetails.type] = {
                code: codeDetails.code,
            };

            return Store.verificationCodes.createCode(verificationCode)
                .then(() => Store.users.updateUser({
                    verificationCodes: JSON.stringify(userVerificationCodes),
                }, {
                    email: req.body.email,
                }))
                .then((results) => {
                    const user = results[0];
                    // Remove credentials from object
                    redactUserCreds(user);

                    return sendVerificationEmail({
                        locale,
                        toAddresses: [req.body.email],
                        agencyDomainName: whiteLabelOrigin,
                        brandVariation,
                    }, {
                        name: users[0].firstName && users[0].lastName ? `${users[0].firstName} ${users[0].lastName}` : users[0].email,
                        verificationCodeToken: codeDetails.token,
                    }, req.body.isDashboardRegistration || users[0].accessLevels.includes(AccessLevels.DASHBOARD_SIGNUP))
                        .then(() => res.status(200).send({ message: 'New verification E-mail sent' }))
                        .catch((error) => {
                            // Delete user to allow re-registration
                            Store.users.deleteUsers({ id: user.id });
                            throw error;
                        });
                })
                .catch((err) => handleHttpError({
                    err,
                    res,
                    message: 'SQL:USER_ROUTES:ERROR',
                }));
        });
};

export {
    createOneTimePassword,
    verifyUserAccount,
    resendVerification,
};
