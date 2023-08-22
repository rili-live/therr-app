import { RequestHandler } from 'express';
import { AccessLevels, ErrorCodes } from 'therr-js-utilities/constants';
import printLogs from 'therr-js-utilities/print-logs';
import normalizeEmail from 'normalize-email';
import beeline from '../beeline';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { hashPassword } from '../utilities/userHelpers';
import generateCode from '../utilities/generateCode';
import { sendVerificationEmail } from '../api/email';
import generateOneTimePassword from '../utilities/generateOneTimePassword';
import translate from '../utilities/translator';
import { updatePassword } from '../utilities/passwordUtils';
import sendOneTimePasswordEmail from '../api/email/sendOneTimePasswordEmail';
import sendUserDeletedEmail from '../api/email/admin/sendUserDeletedEmail';
import sendSpaceClaimRequestEmail from '../api/email/admin/sendSpaceClaimRequestEmail';
import { createUserHelper, getUserHelper, isUserProfileIncomplete } from './helpers/user';
import requestToDeleteUserData from './helpers/requestToDeleteUserData';
import { checkIsMediaSafeForWork } from './helpers';
import { createOrUpdateAchievement } from './helpers/achievements';

// CREATE
const createUser: RequestHandler = (req: any, res: any) => {
    const locale = req.headers['x-localecode'] || 'en-us';

    // This is a honeypot hidden field to prevent spam
    if (req.body.website) {
        return handleHttpError({
            res,
            message: 'Invalid Registration',
            statusCode: 400,
            err: new Error(`Attempted spam registration with email ${req.body.email}`),
        });
    }

    // TODO: Find inviter by inviteCode (userName) and credit both for signup
    const {
        inviteCode,
    } = req.body;

    return Store.users.findUser(req.body)
        .then((findResults) => {
            if (findResults.length) {
                return handleHttpError({
                    res,
                    message: 'Username, e-mail, and phone number must be unique. A user already exists.',
                    statusCode: 400,
                    errorCode: ErrorCodes.USER_EXISTS,
                });
            }

            if (inviteCode) {
                Store.users.findUser({
                    userName: inviteCode,
                }).then((inviter) => {
                    if (inviter.length) {
                        // TODO: Send confirmation e-mail to inviter
                        return createOrUpdateAchievement({
                            userId: inviter[0].id,
                            locale,
                        }, {
                            achievementClass: 'communityLeader',
                            achievementTier: '1_1',
                            progressCount: 1,
                        });
                    }
                }).catch((err) => {
                    printLogs({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: [`failed to reward invite code user, ${inviteCode}`],
                        tracer: beeline,
                        traceArgs: {
                            errorMessage: err?.message,
                            errorResponse: err?.response?.data,
                        },
                    });
                });
            }

            return createUserHelper({
                email: req.body.email,
                password: req.body.password,
                firstName: req.body.firstName,
                isBusinessAccount: req.body.isBusinessAccount,
                isDashboardRegistration: req.body.isDashboardRegistration,
                lastName: req.body.lastName,
                phoneNumber: req.body.phoneNumber,
                userName: req.body.userName,
            }, false, undefined, req.headers['x-localecode']).then((user) => res.status(201).send(user));
        })
        .catch((err) => handleHttpError({
            err,
            res,
            message: 'SQL:USER_ROUTES:ERROR',
        }));
};

// READ
const getMe = (req, res) => {
    const userId = req.headers['x-userid'];

    return Store.users.getUsers({ id: userId, settingsIsAccountSoftDeleted: false })
        .then((results) => {
            if (!results.length) {
                return handleHttpError({
                    res,
                    message: `No user found with the provided params: ${JSON.stringify({ id: userId })}`,
                    statusCode: 404,
                });
            }

            const userResult = results[0];
            delete userResult.password;
            delete userResult.oneTimePassword;
            delete userResult.verificationCodes;

            return userResult;
        })
        .then((user) => res.status(200).send(user))
        .catch((err) => handleHttpError({
            err,
            res,
            message: 'SQL:USER_ROUTES:ERROR',
        }));
};

// READ
const getUser = (req, res) => {
    const userId = req.headers['x-userid'];

    return getUserHelper({
        isAuthorized: true,
        requestingUserId: userId,
        targetUserParams: {
            id: req.params.id,
        },
        res,
    });
};

// READ
/**
 * IMPORTANT - This should not return sensitive information. It is used exclusively to check for the existence
 * of a user by phone number.
 */
const getUserByPhoneNumber = (req, res) => {
    const userId = req.headers['x-userid'];
    const { phoneNumber } = req.params;

    return Store.users.getUserById(userId, ['email', 'phoneNumber', 'isBusinessAccount']).then((userSearchResults) => {
        if (!userSearchResults.length) {
            return handleHttpError({
                res,
                message: `No user found with id, ${userId}. User is required to verify phone number.`,
                statusCode: 400,
            });
        }

        return Store.users.getByPhoneNumber(phoneNumber).then((results) => {
            const requestingUser = userSearchResults[0];
            if (!results.length) {
                // 1st account with this phone number
                return res.status(200).send({
                    isSecondAccount: false,
                    existingUsers: results,
                });
            }
            if (results.length === 1 && results[0].isBusinessAccount !== requestingUser.isBusinessAccount) {
                // 2nd account with this phone number
                return res.status(200).send({
                    isSecondAccount: true,
                    existingUsers: results,
                });
            }

            return res.status(400).send({
                existingUsers: results,
                errorCode: ErrorCodes.TOO_MANY_ACCOUNTS,
                statusCode: 400,
            });
        });
    });
};

// READ
/**
 * IMPORTANT - This is a public endpoint without optional authorization
 * Consider any and all implications of data that is returned
 */
const getUserByUserName = (req, res) => {
    const authHeader = req.headers.authorization; // undefined if user is not logged in
    const userId = req.headers['x-userid']; // undefined if user is not logged in
    const { userName } = req.params;
    // NOTE: authorization may be removed in future since these services are in a secure subnet
    const isAuthorized = authHeader || userId;

    return getUserHelper({
        isAuthorized,
        requestingUserId: userId,
        targetUserParams: {
            userName,
        },
        res,
    });
};

const getUsers: RequestHandler = (req: any, res: any) => Store.users.getUsers()
    .then((results) => {
        res.status(200).send(results.map((user) => {
            delete user.password; // eslint-disable-line no-param-reassign
            delete user.oneTimePassword; // eslint-disable-line no-param-reassign
            delete user.verificationCodes; // eslint-disable-line no-param-reassign
            return user;
        }));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

const findUsers: RequestHandler = (req: any, res: any) => Store.users.findUsers({ ids: req.body.ids })
    .then((results) => {
        res.status(200).send(results.map((user) => {
            delete user.password; // eslint-disable-line no-param-reassign
            delete user.oneTimePassword; // eslint-disable-line no-param-reassign
            delete user.verificationCodes; // eslint-disable-line no-param-reassign
            return user;
        }));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

// UPDATE
const updateUser = (req, res) => {
    const locale = req.headers['x-localecode'] || 'en-us';
    const userId = req.headers['x-userid'];

    return Store.users.getUserById(userId)
        .then((userSearchResults) => {
            const {
                email,
                password,
                oldPassword,
                userName,
            } = req.body;

            if (!userSearchResults.length) {
                return handleHttpError({
                    res,
                    message: `No user found with id, ${userId}.`,
                    statusCode: 404,
                });
            }

            // TODO: If password, validate and update password
            let passwordPromise: Promise<any> = Promise.resolve();

            let mediaPromise: Promise<boolean> = Promise.resolve(true);

            // Prevent unsafe media
            if (req.body.media?.profilePicture) {
                mediaPromise = checkIsMediaSafeForWork([req.body.media?.profilePicture]);
            }

            if (password && oldPassword) {
                passwordPromise = updatePassword({
                    hashedPassword: userSearchResults[0].password,
                    inputPassword: oldPassword,
                    locale,
                    oneTimePassword: userSearchResults[0].oneTimePassword,
                    res,
                    emailArgs: {
                        email,
                        userName,
                    },
                    newPassword: password,
                    userId,
                });
            }

            // TODO: Don't allow updating phone number unless user phone number is already verified
            const updateArgs: any = {
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                media: req.body.media,
                phoneNumber: req.body.phoneNumber,
                hasAgreedToTerms: req.body.hasAgreedToTerms,
                isBusinessAccount: req.body.isBusinessAccount,
                userName: req.body.userName,
                deviceMobileFirebaseToken: req.body.deviceMobileFirebaseToken,
                settingsBio: req.body.settingsBio,
                settingsThemeName: req.body.settingsThemeName,
                settingsPushMarketing: req.body.settingsPushMarketing,
                settingsPushBackground: req.body.settingsPushBackground,
                settingsIsAccountSoftDeleted: req.body.settingsIsAccountSoftDeleted,
                shouldHideMatureContent: req.body.shouldHideMatureContent,
            };

            const isMissingUserProps = isUserProfileIncomplete(updateArgs, userSearchResults[0]);

            // Replace the email verified access level with the missing properties access level
            if (isMissingUserProps && userSearchResults[0].accessLevels?.includes(AccessLevels.EMAIL_VERIFIED)) {
                const userAccessLevels = userSearchResults[0].accessLevels.filter((level) => level !== AccessLevels.EMAIL_VERIFIED);
                userAccessLevels.push(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
                updateArgs.accessLevels = JSON.stringify(userAccessLevels);
            }
            // Replace the missing properties access level with the email verified access level
            if (!isMissingUserProps && userSearchResults[0].accessLevels?.includes(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES)) {
                const userAccessLevels = userSearchResults[0].accessLevels.filter((level) => level !== AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
                userAccessLevels.push(AccessLevels.EMAIL_VERIFIED);
                updateArgs.accessLevels = JSON.stringify(userAccessLevels);
            }

            passwordPromise
                .catch((e) => handleHttpError({
                    res,
                    message: translate(locale, 'User/password combination is incorrect'),
                    statusCode: 400,
                }))
                .then(() => mediaPromise)
                .then((isMediaSafeForWork) => {
                    if (!isMediaSafeForWork) {
                        return handleHttpError({
                            res,
                            message: translate(locale, 'Restricted media'),
                            statusCode: 400,
                        });
                    }
                    return Store.users
                        .updateUser(updateArgs, {
                            id: userId,
                        })
                        .then((results) => {
                            const user = results[0];
                            delete user.password;
                            delete user.oneTimePassword;
                            delete user.verificationCodes;

                            // TODO: Investigate security issue
                            // Lockdown updateUser
                            return res.status(202).send({ ...user, id: userId }); // Precaution, always return correct request userID to prevent polution
                        });
                });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));
};

const updateLastKnownLocation = (req, res) => {
    const userId = req.headers['x-userid'];
    const {
        latitude,
        longitude,
    } = req.body;

    if (userId !== req.params.id) {
        return handleHttpError({
            res,
            message: 'UserIds do not match',
            statusCode: 400,
        });
    }

    return Store.users
        .updateUser({
            lastKnownLatitude: latitude,
            lastKnownLongitude: longitude,
        }, {
            id: userId,
        }).then(() => res.status(200).send({
            latitude,
            longitude,
        })).catch((e) => handleHttpError({
            res,
            message: e.message,
            statusCode: 500,
        }));
};

const updatePhoneVerification = (req, res) => Store.users.findUser({ id: req.params.id })
    .then((userSearchResults) => {
        const userId = req.headers['x-userid'];

        if (!userSearchResults.length) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
            });
        }

        const userAccessLevels = [...(userSearchResults[0].accessLevels || [])];
        userAccessLevels.push(AccessLevels.MOBILE_VERIFIED);

        return Store.users
            .updateUser({
                // remove duplicates using Set()
                accessLevels: JSON.stringify([...new Set([...userAccessLevels])]),
                phoneNumber: req.body.phoneNumber,
            }, {
                id: userId,
            }).then((results) => {
                const user = results[0];
                delete user.password;
                delete user.oneTimePassword;
                delete user.verificationCodes;
                res.status(200).send({ ...user, id: userId });
            });
    }).catch((e) => handleHttpError({
        res,
        message: e.message,
        statusCode: 400,
    }));

const updateUserCoins = (req, res) => {
    const locale = req.headers['x-localecode'] || 'en-us';
    const userId = req.headers['x-userid'];

    return Store.users.getUserById(userId)
        .then((userSearchResults) => {
            const {
                email,
                password,
                oldPassword,
                userName,
            } = req.body;

            if (!userSearchResults.length) {
                return handleHttpError({
                    res,
                    message: `No user found with id, ${userId}.`,
                    statusCode: 404,
                });
            }

            // TODO: If password, validate and update password
            let passwordPromise: Promise<any> = Promise.resolve();

            if (password && oldPassword) {
                passwordPromise = updatePassword({
                    hashedPassword: userSearchResults[0].password,
                    inputPassword: oldPassword,
                    locale,
                    oneTimePassword: userSearchResults[0].oneTimePassword,
                    res,
                    emailArgs: {
                        email,
                        userName,
                    },
                    newPassword: password,
                    userId,
                });
            }

            const updateArgs: any = {
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                media: req.body.media,
                phoneNumber: req.body.phoneNumber,
                hasAgreedToTerms: req.body.hasAgreedToTerms,
                userName: req.body.userName,
                deviceMobileFirebaseToken: req.body.deviceMobileFirebaseToken,
                shouldHideMatureContent: req.body.shouldHideMatureContent,
            };

            // IMPORTANT: Only reward users who opt-in to background push notifications
            // TODO: Weight reward based on settingsPushTopics opt-in (Each with its own valuation)
            // TODO: increment/decrement should be stored on block-chain for auditability
            if (req.body.settingsTherrCoinTotal && userSearchResults[0].settingsPushBackground) {
                // increment/decrement
                updateArgs.settingsTherrCoinTotal = userSearchResults[0] + req.body.settingsTherrCoinTotal;
            }

            const isMissingUserProps = isUserProfileIncomplete(updateArgs, userSearchResults[0]);

            if (isMissingUserProps && userSearchResults[0].accessLevels?.includes(AccessLevels.EMAIL_VERIFIED)) {
                const userAccessLevels = userSearchResults[0].accessLevels.filter((level) => level !== AccessLevels.EMAIL_VERIFIED);
                userAccessLevels.push(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
                updateArgs.accessLevels = JSON.stringify(userAccessLevels);
            }
            if (!isMissingUserProps && userSearchResults[0].accessLevels?.includes(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES)) {
                const userAccessLevels = userSearchResults[0].accessLevels.filter((level) => level !== AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
                userAccessLevels.push(AccessLevels.EMAIL_VERIFIED);
                updateArgs.accessLevels = JSON.stringify(userAccessLevels);
            }

            passwordPromise
                .then(() => Store.users
                    .updateUser(updateArgs, {
                        id: userId,
                    })
                    .then((results) => {
                        const user = results[0];
                        delete user.password;
                        delete user.oneTimePassword;
                        delete user.verificationCodes;

                        // TODO: Investigate security issue
                        // Lockdown updateUser
                        return res.status(202).send({ ...user, id: userId }); // Precaution, always return correct request userID to prevent polution
                    }))
                .catch((e) => handleHttpError({
                    res,
                    message: translate(locale, 'User/password combination is incorrect'),
                    statusCode: 400,
                }));
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));
};

const blockUser = (req, res) => Store.users.findUser({ id: req.params.id })
    .then((findResults) => {
        const userId = req.headers['x-userid'];

        if (!findResults.length) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
            });
        }

        return Store.users
            .updateUser({
                // TODO: Should this included the existing blocked users? (verify this update works)
                // remove duplicates using Set()
                blockedUsers: [...new Set([...findResults[0].blockedUsers, ...(req.body.blockedUsers || []), req.params.id])],
            }, {
                id: userId,
            }).then((response) => res.status(200).send({ blockedUsers: response[0].blockedUsers }));
    }).catch((e) => handleHttpError({
        res,
        message: e.message,
        statusCode: 400,
    }));

const reportUser = (req, res) => Store.users.findUser({ id: req.params.id })
    .then((findResults) => {
        const userId = req.headers['x-userid'];

        if (!findResults.length) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
            });
        }

        return Store.users
            .updateUser({
                // remove duplicates using Set()
                wasReportedBy: [...new Set([...findResults[0].wasReportedBy, userId])],
            }, {
                id: req.params.id,
            }).then(() => res.status(200).send());
    }).catch((e) => handleHttpError({
        res,
        message: e.message,
        statusCode: 400,
    }));

// UPDATE PASSWORD
const updateUserPassword = (req, res) => Store.users.findUser({ id: req.headers['x-userid'] })
    .then((findResults) => {
        const locale = req.headers['x-localecode'] || 'en-us';
        const userId = req.headers['x-userid'];
        const {
            email,
            newPassword,
            userName,
        } = req.body;

        if (!findResults.length) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
            });
        }

        return updatePassword({
            hashedPassword: findResults[0].password,
            inputPassword: req.body.oldPassword,
            locale,
            oneTimePassword: findResults[0].oneTimePassword,
            res,
            emailArgs: {
                email,
                userName,
            },
            newPassword,
            userId,
        })
            .then(() => res.status(204).send())
            .catch(() => handleHttpError({
                res,
                message: translate(locale, 'User/password combination is incorrect'),
                statusCode: 400,
            }));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

// DELETE
const deleteUser = (req, res) => {
    const userId = req.headers['x-userid'];
    const userName = req.headers['x-username'];

    // User should only be able to delete self
    if (userId !== req.params.id) {
        return handleHttpError({
            res,
            message: `Unable to delete user, ${req.params.id}. Does not match requester ID`,
            statusCode: 400,
        });
    }

    return Store.users.deleteUsers({ id: req.params.id })
        .then(() => {
            // TODO: Delete messages in messages service
            // TODO: Delete notifications in notifications service
            requestToDeleteUserData(req.headers);

            // TODO: Delete user session from redis in websocket-service
            // TODO: Delete user media data from cloud storage
            sendUserDeletedEmail({
                subject: '😞 User Account Deleted',
                toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
            }, {
                userId,
                userName,
            });

            return res.status(200).send({
                message: `User with id, ${req.params.id}, was successfully deleted`,
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));
};

const createOneTimePassword = (req, res) => {
    const { email, isDashboardRegistration } = req.body;

    return Store.users.getUsers({ email: normalizeEmail(email) })
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
                    subject: '[Forgot Password?] Therr One-Time Password',
                    toAddresses: [email],
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

    return Store.users.getUsers({ email: normalizeEmail(decodedToken.email) })
        .then((userSearchResults) => {
            if (!userSearchResults.length) {
                return handleHttpError({
                    res,
                    message: `No user found with email ${decodedToken.email}.`,
                    statusCode: 404,
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
                        const userAccessLevels = [
                            ...userSearchResults[0].accessLevels,
                        ];
                        if (isMissingUserProps) {
                            userAccessLevels.push(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
                        } else {
                            userAccessLevels.push(AccessLevels.EMAIL_VERIFIED);
                        }

                        await Store.users.updateUser({
                            accessLevels: JSON.stringify(userAccessLevels),
                            verificationCodes: JSON.stringify(userVerificationCodes),
                        }, {
                            email: decodedToken.email,
                        });

                        // Set expire rather than delete (gives a window for user to see if already verified)
                        await Store.verificationCodes.updateCode({ msExpiresAt: Date.now() }, { id: codeResults[0].id });

                        return res.status(200).send({
                            message: 'Account successfully verified',
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
    // TODO: Supply user agent to determine if web or mobile
    const codeDetails = generateCode({ email: req.body.email, type: req.body.type });
    const verificationCode = { type: codeDetails.type, code: codeDetails.code };
    let userVerificationCodes;

    return Store.users.getUsers({
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
                    delete user.password;
                    delete user.oneTimePassword;

                    return sendVerificationEmail({
                        subject: '[Account Verification] Therr User Account',
                        toAddresses: [req.body.email],
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

const requestSpace: RequestHandler = (req: any, res: any) => {
    const locale = req.headers['x-localecode'] || 'en-us';
    const userId = req.headers['x-userid'];
    // TODO: Supply user agent to determine if web or mobile
    const {
        address,
        longitude,
        latitude,
        title,
        description,
    } = req.body;

    return Store.users.getUserById(userId)
        .then((users) => {
            if (!users.length) {
                return handleHttpError({
                    res,
                    message: 'User not found',
                    statusCode: 404,
                });
            }

            return sendSpaceClaimRequestEmail({
                subject: '[Urgent Request] User Claimed a Space',
                toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
            }, {
                address,
                longitude,
                latitude,
                title,
                description,
                userId,
            });
        })
        .then(() => res.status(200).send({ message: 'Request sent to admin' }))
        .catch((err) => handleHttpError({
            err,
            res,
            message: 'SQL:USER_ROUTES:ERROR',
        }));
};

export {
    createUser,
    getMe,
    getUser,
    getUserByPhoneNumber,
    getUserByUserName,
    getUsers,
    findUsers,
    updateUser,
    updateLastKnownLocation,
    updatePhoneVerification,
    updateUserCoins,
    blockUser,
    reportUser,
    updateUserPassword,
    deleteUser,
    createOneTimePassword,
    verifyUserAccount,
    resendVerification,
    requestSpace,
};
