import { RequestHandler } from 'express';
import { AccessLevels, ErrorCodes, UserConnectionTypes } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import normalizeEmail from 'normalize-email';
import { parseHeaders } from 'therr-js-utilities/http';
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
import {
    createUserHelper, getUserHelper, isUserProfileIncomplete, redactUserCreds,
} from './helpers/user';
import requestToDeleteUserData from './helpers/requestToDeleteUserData';
import { checkIsMediaSafeForWork } from './helpers';
import { createOrUpdateAchievement } from './helpers/achievements';
import { getAccessForCodeType } from '../store/InviteCodesStore';
import sendAdminUrgentErrorEmail from '../api/email/admin/sendAdminUrgentErrorEmail';
import sendClaimPendingReviewEmail from '../api/email/for-business/sendClaimPendingReviewEmail';
import sendClaimApprovedEmail from '../api/email/for-business/sendClaimApprovedEmail';

// CREATE
const createUser: RequestHandler = (req: any, res: any) => {
    const {
        locale,
        whiteLabelOrigin,
        brandVariation,
        platform,
    } = parseHeaders(req.headers);

    const {
        activationCode,
        paymentSessionId,
    } = req.body;

    // This is a honeypot hidden field to prevent spam
    if (req.body.website) {
        return handleHttpError({
            res,
            message: 'Invalid Registration',
            statusCode: 400,
            err: new Error(`Attempted spam registration with email ${req.body.email}`),
        });
    }

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

            let getSubsAccessLvlsPromise: Promise<AccessLevels[]> = Promise.resolve([]);

            if (activationCode) {
                getSubsAccessLvlsPromise = Promise.all([
                    Store.inviteCodes.getInviteCodes({
                        code: activationCode,
                        isRedeemed: false,
                    }),
                    Store.inviteCodes.getInviteCodes({
                        userEmail: req.body.email,
                        isRedeemed: true,
                    }),
                ]).then(([validCodes, invalidCodes]) => {
                    if (invalidCodes.length) {
                        sendAdminUrgentErrorEmail({
                            subject: '[Urgent Error] Bad Activation Code',
                            toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                            agencyDomainName: whiteLabelOrigin,
                            brandVariation,
                        }, {
                            errorMessage: 'Activation Code already used',
                        }, {
                            userEmail: req.body.email,
                            activationCode,
                        });
                        return [];
                    }

                    if (validCodes.length) {
                        // TODO: Better error logging
                        Store.inviteCodes.updateInviteCode({
                            id: validCodes[0].id,
                        }, {
                            isRedeemed: true,
                            userEmail: req.body.email,
                        }).catch((err) => {
                            sendAdminUrgentErrorEmail({
                                subject: '[Urgent Error] Activation Code Error',
                                toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                                agencyDomainName: whiteLabelOrigin,
                                brandVariation,
                            }, {
                                errorMessage: `Failed to update activation code: ${err?.message}`,
                            }, {
                                userEmail: req.body.email,
                                activationCode,
                            });
                        });
                        return getAccessForCodeType(validCodes[0].redemptionType);
                    }

                    sendAdminUrgentErrorEmail({
                        subject: '[Urgent Error] Bad Activation Code',
                        toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                        agencyDomainName: whiteLabelOrigin,
                        brandVariation,
                    }, {
                        errorMessage: 'Activation code not found',
                    }, {
                        userEmail: req.body.email,
                        activationCode,
                    });

                    return [];
                }).catch((err) => {
                    sendAdminUrgentErrorEmail({
                        subject: '[Urgent Error] Bad Activation Code',
                        toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                        agencyDomainName: whiteLabelOrigin,
                        brandVariation,
                    }, {
                        errorMessage: `Error fetching activation codes: ${err?.message}`,
                    }, {
                        userEmail: req.body.email,
                        activationCode,
                    });
                    return [];
                });
            } else if (paymentSessionId) {
                // TODO: Use paymentSessionId to fetch subscription details and add accessLevels to user
                console.log('TODO...');
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
                            whiteLabelOrigin,
                            brandVariation,
                        }, {
                            achievementClass: 'communityLeader',
                            achievementTier: '1_1',
                            progressCount: 1,
                        });
                    }
                }).catch((err) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: [`failed to reward invite code user, ${inviteCode}`],
                        traceArgs: {
                            'error.message': err?.message,
                            'error.response': err?.response?.data,
                        },
                    });
                });
            }

            return getSubsAccessLvlsPromise.then((levels) => createUserHelper(
                {
                    email: req.body.email,
                    password: req.body.password,
                    firstName: req.body.firstName,
                    isBusinessAccount: req.body.isBusinessAccount,
                    isCreatorAccount: req.body.isCreatorAccount,
                    isDashboardRegistration: req.body.isDashboardRegistration,
                    settingsEmailMarketing: req.body.settingsEmailMarketing,
                    settingsEmailBusMarketing: req.body.settingsEmailBusMarketing,
                    lastName: req.body.lastName,
                    phoneNumber: req.body.phoneNumber,
                    userName: req.body.userName,
                    accessLevels: levels,
                },
                false,
                undefined,
                !!inviteCode,
                req.headers['x-localecode'],
                whiteLabelOrigin,
                brandVariation,
                platform,
            ).then((user) => res.status(201).send(user)));
        })
        .catch((err) => {
            if (err?.message === 'invalid-password') {
                return handleHttpError({
                    err,
                    res,
                    message: translate(locale, 'errorMessages.auth.invalidPassword'),
                    statusCode: 400,
                });
            }

            return handleHttpError({
                err,
                res,
                message: 'SQL:USER_ROUTES:ERROR',
            });
        });
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
            // Remove credentials from object
            redactUserCreds(userResult);

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
    const authHeader = req.headers.authorization; // undefined if user is not logged in
    const userId = req.headers['x-userid'];

    if (!!authHeader && !!userId && userId !== req.params.id) {
        Store.userConnections.incrementUserConnection(userId, req.params.id, 1)
            .catch((err) => console.log(err));
    }

    return getUserHelper({
        isAuthorized: !!authHeader,
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

    return Store.users.getUserById(userId, ['email', 'phoneNumber', 'isBusinessAccount', 'isCreatorAccount']).then((userSearchResults) => {
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
                    isThirdAccount: false,
                    existingUsers: results,
                });
            }
            if (results.length === 1 && (
                results[0].isBusinessAccount !== requestingUser.isBusinessAccount
                || results[0].isCreatorAccount !== requestingUser.isCreatorAccount)
            ) {
                // 2nd account with this phone number
                return res.status(200).send({
                    isSecondAccount: true,
                    isThirdAccount: false,
                    existingUsers: results,
                });
            }
            // TODO: Unit test
            if (results.length > 1) {
                const hasExistingBusAccount = results.find((result) => result.isBusinessAccount);
                const hasExistingCreatorAccount = results.find((result) => result.isCreatorAccount);
                if ((requestingUser.isBusinessAccount && !hasExistingBusAccount)
                    || (requestingUser.isCreatorAccount && !hasExistingCreatorAccount)) {
                    // 3rd account with this phone number
                    return res.status(200).send({
                        isSecondAccount: false,
                        isThirdAccount: true,
                        existingUsers: results,
                    });
                }
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
            // Remove credentials from object
            redactUserCreds(user);
            return user;
        }));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

const findUsers: RequestHandler = (req: any, res: any) => Store.users.findUsers({ ids: req.body.ids })
    .then((results) => {
        res.status(200).send(results.map((user) => {
            // Remove credentials from object
            redactUserCreds(user);
            return user;
        }));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

const searchUsers: RequestHandler = (req: any, res: any) => {
    const userId = req.headers['x-userid']; // undefined if user is not logged in

    const {
        ids,
        query,
        queryColumnName,
        limit,
        offset,
    } = req.body;

    const actualLimit = limit || 21;
    const actualOffset = offset || 0;

    const mightKnowPromise = !query
        ? Store.userConnections.getMightKnowUserConnections(userId)
            .then((connections) => Store.users.findUsers({
                ids: connections
                    .map((con) => (con.requestingUserId === userId ? con.acceptingUserId : con.requestingUserId)),
            }))
        : Promise.resolve([]);

    return mightKnowPromise.then((mightKnowResults) => Store.users.searchUsers(userId, {
        ids,
        query,
        queryColumnName,
        limit: actualLimit,
        offset: actualOffset,
    }, true, true)
        .then((results) => {
            res.status(200).send({
                results: results.map((user) => {
                    // Remove credentials from object
                    redactUserCreds(user);
                    return user;
                }),
                mightKnowResults: mightKnowResults.map((user) => ({
                    ...user,
                    isConnected: false,
                })),
                pagination: {
                    itemsPerPage: (actualLimit),
                    pageNumber: actualOffset + 1,
                },
            });
        })).catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));
};

/**
 * Fetches users that may be a good influencer match for the requesting user
 */
const searchUserPairings: RequestHandler = (req: any, res: any) => {
    const userId = req.headers['x-userid']; // undefined if user is not logged in

    // TODO: Implement prediction algorithm to find users relevant to the requesting user

    const {
        ids,
        query,
        queryColumnName,
        limit,
        offset,
    } = req.body;

    const actualLimit = limit || 21;
    const actualOffset = offset || 0;

    return Store.users.searchUserSocials(userId, {
        ids,
        query,
        queryColumnName,
        limit: actualLimit,
        offset: actualOffset,
    })
        .then((results) => {
            res.status(200).send({
                results: results.map((user) => {
                    // Remove credentials from object
                    redactUserCreds(user);
                    return user;
                }),
                pagination: {
                    itemsPerPage: (actualLimit),
                    pageNumber: actualOffset + 1,
                },
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));
};

// UPDATE
const updateUser = (req, res) => {
    const {
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    return Store.users.getUserById(userId)
        .then((userSearchResults) => {
            const {
                email,
                password,
                oldPassword,
                userName,
                organization,
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
                    whiteLabelOrigin,
                    brandVariation,
                }).catch((e) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['bad password update'],
                        traceArgs: {
                            'error.message': e?.message,
                            'error.response': e?.response?.data,
                        },
                    });
                    throw new Error('bad-password');
                });
            }

            let orgsPromise: Promise<any[]> = Promise.resolve([]);

            // TODO: Add organization to x-organizations header?
            if (organization) {
                if (organization.id) {
                    orgsPromise = Store.organizations.update(organization.id, {
                        creatorId: userId,
                        name: organization.name,
                        description: organization.description,
                        settingsGeneralBusinessType: organization.settingsGeneralBusinessType,
                    });
                } else {
                    orgsPromise = Store.organizations.count(userId).then((response) => {
                        if (response[0].count >= 5) {
                            return Promise.reject(new Error('max-organizations'));
                        }

                        return Store.organizations.create([{
                            creatorId: userId,
                            name: organization.name,
                            description: organization.description,
                            settingsGeneralBusinessType: organization.settingsGeneralBusinessType,
                        }]).then((orgsResult) => Store.userOrganizations.create([{
                            userId,
                            organizationId: orgsResult[0].id,
                            inviteStatus: 'accepted',
                            accessLevels: [AccessLevels.ORGANIZATIONS_ADMIN],
                        }]).then(() => orgsResult));
                    });
                }
            }

            // TODO: Don't allow updating phone number unless user phone number is already verified
            const updateArgs: any = {
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                media: req.body.media,
                phoneNumber: req.body.phoneNumber,
                hasAgreedToTerms: req.body.hasAgreedToTerms,
                isBusinessAccount: req.body.isBusinessAccount,
                isCreatorAccount: req.body.isCreatorAccount,
                userName: req.body.userName,
                deviceMobileFirebaseToken: req.body.deviceMobileFirebaseToken,
                settingsBio: req.body.settingsBio,
                settingsEmailMarketing: req.body.settingsEmailMarketing,
                settingsEmailBusMarketing: req.body.settingsEmailBusMarketing,
                settingsEmailLikes: req.body.settingsEmailLikes,
                settingsEmailInvites: req.body.settingsEmailInvites,
                settingsEmailMentions: req.body.settingsEmailMentions,
                settingsEmailMessages: req.body.settingsEmailMessages,
                settingsEmailReminders: req.body.settingsEmailReminders,
                settingsEmailBackground: req.body.settingsEmailBackground,
                settingsThemeName: req.body.settingsThemeName,
                settingsIsProfilePublic: req.body.settingsIsProfilePublic,
                settingsPushMarketing: req.body.settingsPushMarketing,
                settingsPushBackground: req.body.settingsPushBackground,
                settingsIsAccountSoftDeleted: req.body.settingsIsAccountSoftDeleted,
                shouldHideMatureContent: req.body.shouldHideMatureContent,
            };

            const isMissingUserProps = isUserProfileIncomplete(updateArgs, userSearchResults[0]);

            // Replace the email verified access level with the missing properties access level
            if (isMissingUserProps && userSearchResults[0].accessLevels?.includes(AccessLevels.EMAIL_VERIFIED)) {
                const userAccessLevels = new Set(userSearchResults[0].accessLevels.filter((level) => level !== AccessLevels.EMAIL_VERIFIED));
                userAccessLevels.add(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
                updateArgs.accessLevels = JSON.stringify([...userAccessLevels]);
            }
            // Replace the missing properties access level with the email verified access level
            if (!isMissingUserProps && userSearchResults[0].accessLevels?.includes(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES)) {
                const userAccessLevels = new Set(userSearchResults[0].accessLevels.filter((level) => level !== AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES));
                userAccessLevels.add(AccessLevels.EMAIL_VERIFIED);
                updateArgs.accessLevels = JSON.stringify([...userAccessLevels]);
            }

            return Promise.all([passwordPromise, orgsPromise, mediaPromise])
                .then(([passwordResult, orgsResult, isMediaSafeForWork]) => {
                    if (!isMediaSafeForWork) {
                        return handleHttpError({
                            res,
                            message: translate(locale, 'errorMessages.privacy.restrictedMedia'),
                            statusCode: 400,
                        });
                    }
                    return Store.users
                        .updateUser(updateArgs, {
                            id: userId,
                        })
                        .then(async (results) => {
                            const user = results[0];
                            // Remove credentials from object
                            redactUserCreds(user);

                            const userOrgs = await Store.userOrganizations.get({
                                userId: user.id,
                            }).catch((err) => {
                                logSpan({
                                    level: 'error',
                                    messageOrigin: 'API_SERVER',
                                    messages: [err?.message, 'Failed to fetch user organizations for idToken'],
                                    traceArgs: {
                                        issue: '',
                                        port: process.env.USERS_SERVICE_API_PORT,
                                        'process.id': process.pid,
                                    },
                                });
                                return [];
                            });

                            // TODO: Investigate security issue
                            // Lockdown updateUser
                            return res.status(202).send({
                                ...user,
                                id: userId,
                                organizations: orgsResult,
                                userOrganizations: userOrgs,
                            }); // Precaution, always return correct request userID to prevent pollution
                        });
                });
        })
        .catch((err) => {
            if (err?.message?.includes('users_username_unique')) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.user.uniqueUserName'),
                    statusCode: 400,
                });
            }
            if (err?.message === 'bad-password') {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.user.invalidUserNamePassword'),
                    statusCode: 400,
                });
            }
            if (err?.message === 'max-organizations') {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.user.maxOrgs'),
                    statusCode: 400,
                });
            }

            return handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' });
        });
};

const updateLastKnownLocation = (req, res) => {
    const {
        locale,
        userId,
    } = parseHeaders(req.headers);
    const {
        latitude,
        longitude,
    } = req.body;

    if (userId !== req.params.id) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.user.misMatchUserIDs'),
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

        const userAccessLevels = new Set(userSearchResults[0].accessLevels || []);
        userAccessLevels.add(AccessLevels.MOBILE_VERIFIED);

        return Store.users
            .updateUser({
                // remove duplicates using Set()
                accessLevels: JSON.stringify([...userAccessLevels]),
                phoneNumber: req.body.phoneNumber,
            }, {
                id: userId,
            }).then((results) => {
                const user = results[0];
                // Remove credentials from object
                redactUserCreds(user);
                res.status(200).send({ ...user, id: userId });
            });
    }).catch((e) => handleHttpError({
        res,
        message: e.message,
        statusCode: 400,
    }));

const updateUserCoins = (req, res) => {
    const {
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

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
                    whiteLabelOrigin,
                    brandVariation,
                }).catch((e) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['bad password update'],
                        traceArgs: {
                            'error.message': e?.message,
                            'error.response': e?.response?.data,
                        },
                    });
                    throw new Error('bad-password');
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
                const userAccessLevels = new Set(userSearchResults[0].accessLevels.filter((level) => level !== AccessLevels.EMAIL_VERIFIED));
                userAccessLevels.add(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES);
                updateArgs.accessLevels = JSON.stringify([...userAccessLevels]);
            }
            if (!isMissingUserProps && userSearchResults[0].accessLevels?.includes(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES)) {
                const userAccessLevels = new Set(userSearchResults[0].accessLevels.filter((level) => level !== AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES));
                userAccessLevels.add(AccessLevels.EMAIL_VERIFIED);
                updateArgs.accessLevels = JSON.stringify([...userAccessLevels]);
            }

            passwordPromise
                .then(() => Store.users
                    .updateUser(updateArgs, {
                        id: userId,
                    })
                    .then((results) => {
                        const user = results[0];
                        // Remove credentials from object
                        redactUserCreds(user);

                        // TODO: Investigate security issue
                        // Lockdown updateUser
                        return res.status(202).send({ ...user, id: userId }); // Precaution, always return correct request userID to prevent pollution
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
        const {
            locale,
            userId,
            whiteLabelOrigin,
            brandVariation,
        } = parseHeaders(req.headers);
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
            whiteLabelOrigin,
            brandVariation,
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
    const {
        userName,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    // User should only be able to delete self
    if (userId !== req.params.id) {
        return handleHttpError({
            res,
            message: `Unable to delete user, ${req.params.id}. Does not match requester ID`,
            statusCode: 400,
        });
    }

    return Store.users.deleteUsers({ id: req.params.id })
        .then(([deletedUser]) => {
            // TODO: Delete notifications in users service
            // TODO: Delete messages in messages service
            // TODO: Delete forums, forumMessages in messages service
            requestToDeleteUserData(req.headers);

            // TODO: Delete user session from redis in websocket-service
            // TODO: Delete user media data from cloud storage
            sendUserDeletedEmail({
                subject: '😞 User Account Deleted',
                toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                agencyDomainName: whiteLabelOrigin,
                brandVariation,
            }, {
                userDetails: {
                    id: userId,
                    userName,
                    ...deletedUser,
                },
            });

            return res.status(200).send({
                message: `User with id, ${req.params.id}, was successfully deleted`,
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));
};

const createOneTimePassword = (req, res) => {
    const {
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
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
    const {
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
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
                    // Remove credentials from object
                    redactUserCreds(user);

                    return sendVerificationEmail({
                        subject: '[Account Verification] Therr User Account',
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

const requestSpace: RequestHandler = (req: any, res: any) => {
    const {
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    // TODO: Supply user agent to determine if web or mobile
    const {
        address,
        longitude,
        latitude,
        title,
        notificationMsg,
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

            redactUserCreds(users[0]);

            return Promise.all([
                sendClaimPendingReviewEmail({
                    subject: 'Business Space Request in Review',
                    toAddresses: [users[0].email],
                    agencyDomainName: whiteLabelOrigin,
                    brandVariation,
                    recipientIdentifiers: {
                        id: users[0].id,
                        accountEmail: users[0].email,
                    },
                }, {
                    spaceName: title || notificationMsg,
                }),
                sendSpaceClaimRequestEmail({
                    subject: '[Urgent Request] User Claimed a Space',
                    toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                    agencyDomainName: whiteLabelOrigin,
                    brandVariation,
                }, {
                    address,
                    longitude,
                    latitude,
                    title: title || notificationMsg,
                    description,
                    userId,
                }),
            ]).then(() => users[0]);
        })
        .then((user) => res.status(200).send({
            message: 'Request sent to admin',
            user: {
                accessLevels: user.accessLevels,
                isBusinessAccount: user.isBusinessAccount,
                email: user.email,
            },
        }))
        .catch((err) => handleHttpError({
            err,
            res,
            message: 'SQL:USER_ROUTES:ERROR',
        }));
};

const approveSpaceRequest: RequestHandler = (req: any, res: any) => {
    const {
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    // TODO: Supply user agent to determine if web or mobile
    const {
        address,
        longitude,
        latitude,
        title,
        notificationMsg,
        description,
        id: spaceId,
        fromUserId,
        requestedByUserId,
    } = req.body;

    return Store.users.getUserById(requestedByUserId || fromUserId)
        .then((users) => {
            if (!users.length) {
                return handleHttpError({
                    res,
                    message: 'User not found',
                    statusCode: 404,
                });
            }

            redactUserCreds(users[0]);

            return sendClaimApprovedEmail({
                subject: 'Approved: Business Space Request',
                toAddresses: [users[0].email],
                agencyDomainName: whiteLabelOrigin,
                brandVariation,
                recipientIdentifiers: {
                    id: users[0].id,
                    accountEmail: users[0].email,
                },
            }, {
                spaceName: title || notificationMsg,
                spaceId,
            }).then(() => users[0]);
        })
        .then((user) => res.status(200).send({
            message: 'Request approved by admin',
            user: {
                id: user.id,
            },
        }))
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
    searchUsers,
    searchUserPairings,
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
    approveSpaceRequest,
};
