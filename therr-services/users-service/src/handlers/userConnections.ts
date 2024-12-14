import { RequestHandler } from 'express';
import {
    CurrentSocialValuations, ErrorCodes, Notifications, PushNotifications, UserConnectionTypes,
} from 'therr-js-utilities/constants';
import { getSearchQueryArgs, parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import normalizePhoneNumber from 'therr-js-utilities/normalize-phone-number';
import normalizeEmail from 'normalize-email';
import emailValidator from 'therr-js-utilities/email-validator';
import deepEmailValidate from 'deep-email-validator';
import sendEmailAndOrPushNotification from '../utilities/sendEmailAndOrPushNotification';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import { translateNotification } from './notifications';
import { createUserHelper } from './helpers/user';
import sendContactInviteEmail from '../api/email/for-social/sendContactInviteEmail';
import twilioClient from '../api/twilio';
import { createOrUpdateAchievement } from './helpers/achievements';
import { parseConfigValue } from './config';
import { IFindUsersByContactInfo } from '../store/UsersStore';

/**
 * Used for sorting interests by a singular value. Set defaults to ensure no zero values.
 */
const getInterestRanking = (engagementCount: number, score: number) => Math.ceil((engagementCount || 1) / (score || 5));

const getTherrFromPhoneNumber = (receivingPhoneNumber: string) => {
    if (receivingPhoneNumber.startsWith('+44')) {
        return process.env.TWILIO_SENDER_PHONE_NUMBER_GB;
    }

    return process.env.TWILIO_SENDER_PHONE_NUMBER;
};

const failsafeBlackListRequest = (email) => Store.blacklistedEmails.get({
    email,
}).catch((err) => {
    console.log(err);
    return [];
});

// CREATE
// TODO:RSERV-24: Security, get requestingUserId from user header token
const createUserConnection: RequestHandler = async (req: any, res: any) => {
    const {
        requestingUserId,
        requestingUserFirstName,
        requestingUserLastName,
        requestingUserEmail,
        acceptingUserId,
        acceptingUserPhoneNumber,
        acceptingUserEmail,
    } = req.body;
    const fromUserFullName = `${requestingUserFirstName} ${requestingUserLastName}`;

    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
        platform,
    } = parseHeaders(req.headers);

    let acceptingUser: {
        id?: string,
        deviceMobileFirebaseToken?: string;
        email?: string;
        isUnclaimed?: boolean;
        settingsEmailInvites?: boolean;
    } = {
        id: acceptingUserId,
        email: acceptingUserEmail,
    };

    if (requestingUserId !== userId) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.userConnections.mismatchTokenUserId'),
            statusCode: 400,
        });
    }

    // 1. Lookup User in DB and send e-mail invite if not found
    if (!acceptingUser.id) {
        try {
            const userResults = await Store.users.findUser({
                phoneNumber: acceptingUserPhoneNumber,
                email: acceptingUserEmail,
            }, ['id', 'deviceMobileFirebaseToken', 'email', 'isUnclaimed', 'settingsEmailInvites']);

            let unverifiedUser;

            // 1a. Send email invite when user does not exist
            if (!userResults.length && acceptingUserEmail) {
                const blacklistedEmails = await failsafeBlackListRequest(acceptingUserEmail);
                const emailIsBlacklisted = blacklistedEmails?.length;
                const deepEmailValidation = await deepEmailValidate({
                    email: acceptingUserEmail,
                    sender: process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any,
                    validateSMTP: false, // TODO: Consider enabling after testing in production (not working from localhost?)
                });
                // NOTE: This caused AWS SES Bounce rates to block our account.
                // This is disabled until we can find a better way to handle this.
                const isAutoUserCreateEnabled = await Store.config.get('features.isAutoUserCreateEnabled')
                    .then((configResults) => configResults?.length && parseConfigValue(configResults[0].value, configResults[0].type));

                if (isAutoUserCreateEnabled
                    && !emailIsBlacklisted
                    && acceptingUserEmail
                    && emailValidator.validate(acceptingUserEmail)
                    && deepEmailValidation?.valid) {
                    // NOTE: This caused AWS SES Bounce rates to block our account.
                    // This is disabled until we can find a better way to handle this.
                    unverifiedUser = await createUserHelper(req.headers, {
                        email: acceptingUserEmail,
                    }, false, {
                        fromName: fromUserFullName,
                        fromEmail: requestingUserEmail,
                        toEmail: acceptingUserEmail,
                    }, false);
                } else {
                    return handleHttpError({
                        res,
                        message: translate(locale, 'errorMessages.userConnections.noUserFound'),
                        statusCode: 404,
                    });
                }
            }

            // 1b. Capture user id for step 2 when found in DB or use the unverified user that is created by invite
            acceptingUser = unverifiedUser || userResults[0];

            if (acceptingUser.id === requestingUserId) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.userConnections.noRequestSelf'),
                    statusCode: 400,
                });
            }
        } catch (err: any) {
            return handleHttpError({
                err,
                res,
                message: 'SQL:USER_CONNECTIONS_ROUTES:ERROR',
            });
        }
    } else {
        try {
            const userResults = await Store.users.findUser({
                id: acceptingUserId,
            }, ['id', 'deviceMobileFirebaseToken', 'email', 'isUnclaimed', 'settingsEmailInvites']);

            // 1b. Capture user id for step 2 when found in DB
            acceptingUser = userResults[0];
        } catch (err: any) {
            return handleHttpError({
                err,
                res,
                message: 'SQL:USER_CONNECTIONS_ROUTES:ERROR',
            });
        }
    }

    // TODO: Make this one DB request
    // 2. If user is found, create the connection and send notifications
    return Store.userConnections.getUserConnections({
        requestingUserId,
        acceptingUserId: acceptingUser.id,
    }, true)
        .then((getResults) => {
            let connectionPromise;

            if (getResults.length && !getResults[0].isConnectionBroken && getResults[0].requestStatus !== UserConnectionTypes.MIGHT_KNOW) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.userConnections.alreadyExists'),
                    statusCode: 400,
                });
            }

            if (getResults.length && getResults[0].isConnectionBroken) {
                // Re-create connection after unconnection
                connectionPromise = Store.userConnections.updateUserConnection({
                    requestingUserId: getResults[0].requestingUserId,
                    acceptingUserId: acceptingUser.id as string,
                }, {
                    isConnectionBroken: false,
                    requestStatus: UserConnectionTypes.PENDING,
                });
            } else {
                createOrUpdateAchievement(req.headers, {
                    achievementClass: 'socialite',
                    achievementTier: '1_1',
                    progressCount: 1,
                }).catch((err) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Error while creating socialite achievements for sent friend requests, tier 1_1'],
                        traceArgs: {
                            'error.message': err?.message,
                        },
                    });
                });

                connectionPromise = getResults[0]?.requestStatus === UserConnectionTypes.MIGHT_KNOW
                    ? Store.userConnections.updateUserConnection({
                        requestingUserId,
                        acceptingUserId: acceptingUser.id as string,
                    }, {
                        requestStatus: UserConnectionTypes.PENDING,
                    }).then(([userConnection]) => {
                        if (!userConnection) {
                            return Store.userConnections.updateUserConnection({
                                // Swap to ensure we find the connection
                                requestingUserId: acceptingUser.id as string,
                                acceptingUserId: requestingUserId,
                            }, {
                                requestStatus: UserConnectionTypes.PENDING,
                            });
                        }

                        return [userConnection];
                    })
                    : Store.userConnections.createUserConnection({
                        requestingUserId,
                        acceptingUserId: acceptingUser.id as string,
                        requestStatus: UserConnectionTypes.PENDING,
                    });
            }

            // NOTE: no need to refetch user from DB
            // eslint-disable-next-line no-empty-pattern
            sendEmailAndOrPushNotification(({}, []) => Promise.resolve<any>([acceptingUser as {
                deviceMobileFirebaseToken: string;
                email: string;
                isUnclaimed: boolean;
                settingsEmailInvites: boolean;
            }]), req.headers, {
                authorization,
                fromUser: {
                    id: userId,
                    userName: fromUserFullName,
                },
                locale,
                toUserId: acceptingUser.id as string,
                type: PushNotifications.Types.newConnectionRequest,
                retentionEmailType: PushNotifications.Types.newConnectionRequest,
                whiteLabelOrigin,
                brandVariation,
            });

            return connectionPromise.then(([userConnection]) => Store.notifications.createNotification({
                userId: acceptingUser.id as string,
                type: Notifications.Types.CONNECTION_REQUEST_RECEIVED,
                associationId: userConnection.id,
                isUnread: true,
                messageLocaleKey: Notifications.MessageKeys.CONNECTION_REQUEST_RECEIVED,
                messageParams: {
                    userId: requestingUserId,
                    firstName: requestingUserFirstName,
                    lastName: requestingUserLastName,
                },
            }).then(([notification]) => ({
                ...userConnection,
                notification: translateNotification(notification, locale),
            })).catch((err) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['Error while creating notification for new connection request'],
                    traceArgs: {
                        'error.message': err?.message,
                        'req.routeName': 'CreateUserConnection',
                        method: 'sendEmailAndOrPushNotification',
                    },
                });
            })).then((userConnection) => res.status(201).send(userConnection));
        })
        .catch((err) => handleHttpError({
            err,
            res,
            message: 'SQL:USER_CONNECTIONS_ROUTES:ERROR',
        }));
};

const createOrInviteUserConnections: RequestHandler = async (req: any, res: any) => {
    const {
        requestingUserId,
        requestingUserFirstName,
        requestingUserLastName,
        requestingUserEmail,
        inviteList,
    } = req.body;
    // TODO: Use email instead?
    const fromUserFullName = `${requestingUserFirstName} ${requestingUserLastName}`;
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    let coinRewardsTotal = 0;

    if (requestingUserId !== userId) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.userConnections.mismatchTokenUserId'),
            statusCode: 400,
        });
    }

    // 1. Lookup Users in DB, collect those that exist, send e-mail invite to those that do not yet exist
    try {
        const userResults = await Store.users.findUsersByContactInfo(inviteList);
        const existingUsers: any[] = [];
        const otherUserEmails: any[] = [];
        const otherUserPhoneNumbers: any[] = [];
        inviteList.forEach((contact) => {
            const isFound = userResults.some((result) => {
                if (contact.email && normalizeEmail(contact.email) === result.email) {
                    existingUsers.push(result);
                    return true;
                }

                if (contact.phoneNumber && result.phoneNumber && normalizePhoneNumber(contact.phoneNumber) === result.phoneNumber) {
                    existingUsers.push(result);
                    return true;
                }

                return false;
            });

            if (!isFound) {
                if (contact.email) {
                    if (emailValidator.validate(contact.email)) {
                        otherUserEmails.push({
                            email: normalizeEmail(contact.email),
                        });
                    }
                } else if (contact.phoneNumber) {
                    const normalizedPhoneNumber = normalizePhoneNumber(contact.phoneNumber);
                    if (normalizedPhoneNumber) {
                        otherUserPhoneNumbers.push({
                            phoneNumber: normalizedPhoneNumber,
                        });
                    }
                }
                // If no email or normal phone number, do nothing
            }
        });

        // NOTE: Current set to 0 coin reward while we debug spammers
        coinRewardsTotal += (otherUserEmails.length * CurrentSocialValuations.inviteSent) + (otherUserPhoneNumbers.length * CurrentSocialValuations.inviteSent);

        // 2. Send email invites if user does not exist
        const emailSendPromises: any[] = [];
        otherUserEmails.forEach((contact) => {
            emailSendPromises.push(sendContactInviteEmail({
                subject: `${requestingUserFirstName} ${requestingUserLastName} invited you to Therr app`,
                toAddresses: [contact.email],
                agencyDomainName: whiteLabelOrigin,
                brandVariation,
            }, {
                fromName: `${requestingUserFirstName} ${requestingUserLastName}`,
                fromEmail: requestingUserEmail || '',
                toEmail: contact.email,
            }));
        });

        // 3. Send phone invites if user does not exist
        const phoneSendPromises: any[] = [];
        otherUserPhoneNumbers.forEach((contact) => {
            phoneSendPromises.push(twilioClient.messages
                .create({
                    body: translate(locale, 'invites.phone', {
                        name: `${requestingUserFirstName} ${requestingUserLastName}`,
                    }),
                    to: contact.phoneNumber, // Text this number
                    from: getTherrFromPhoneNumber(contact.phoneNumber), // From a valid Twilio number
                }));
        });

        // 4. Create db invites for tracking
        // TODO: Prevent resending email/phone request if invite already exists
        Store.invites.createIfNotExist([...existingUsers, ...otherUserEmails, ...otherUserPhoneNumbers]
            .map((invite) => ({
                requestingUserId: userId,
                email: invite.email,
                phoneNumber: invite.phoneNumber,
                isAccepted: false,
            })))
            .then((createdIds) => {
                createOrUpdateAchievement(req.headers, {
                    achievementClass: 'socialite',
                    achievementTier: '1_1',
                    progressCount: createdIds.length,
                }).catch((err) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Error while creating socialite achievements for multiple sent friend requests, tier 1_1'],
                        traceArgs: {
                            'error.message': err?.message,
                        },
                    });
                });
                return Promise.all(emailSendPromises);
            })
            .then(() => Promise.all(phoneSendPromises))
            .catch((err) => { // TODO: change to Promise.allSettled
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: [err?.message],
                    traceArgs: {
                        issue: 'failed to create invite',
                    },
                });
            });

        // 4a. Reward inviter with coins
        if (coinRewardsTotal > 0) {
            Store.users.updateUser({
                settingsTherrCoinTotal: coinRewardsTotal,
            }, {
                id: userId,
            }).catch((err) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: [err?.message],
                    traceArgs: {
                        issue: 'error while updating user coins',
                        'error.message': err?.message,
                    },
                });
            });
        }

        // 5. Send in-app invites to existing users
        if (existingUsers.length > 0) {
            // Query db and send connection requests if don't already exist
            return Store.userConnections.findUserConnections(userId, existingUsers.map((user) => user.id)).then((connections) => {
                // TODO: Determine if we can replace this logic in the SQL query
                const newConnectionUserIds: any = [];
                const newConnectionUsers: {
                    id: string;
                    deviceMobileFirebaseToken: string;
                    email: string;
                    isUnclaimed: boolean;
                    settingsEmailInvites: boolean;
                }[] = [];
                existingUsers
                    .forEach((user) => {
                        if (!connections.find((conn) => conn.acceptingUserId === user.id || conn.requestingUser === user.id)) {
                            newConnectionUserIds.push(user.id);
                            newConnectionUsers.push({
                                id: user.id,
                                deviceMobileFirebaseToken: user.deviceMobileFirebaseToken,
                                email: user.email,
                                isUnclaimed: user.isUnclaimed,
                                settingsEmailInvites: user.settingsEmailInvites,
                            });
                        }
                    });

                return Store.userConnections.createUserConnections(userId, newConnectionUserIds).then((response) => ({
                    userConnections: response,
                    newConnectionUsers,
                }));
            }).then(({ userConnections, newConnectionUsers }) => {
                // 5a. Send notifications to each new connection request
                newConnectionUsers.forEach((acceptingUser) => {
                    // NOTE: no need to refetch user from DB
                    sendEmailAndOrPushNotification(() => Promise.resolve([acceptingUser as {
                        deviceMobileFirebaseToken: string;
                        email: string;
                        isUnclaimed: boolean;
                        settingsEmailInvites: boolean;
                    }]), req.headers, {
                        authorization,
                        fromUser: {
                            id: userId,
                            userName: fromUserFullName,
                        },
                        locale,
                        toUserId: acceptingUser.id,
                        type: PushNotifications.Types.newConnectionRequest,
                        retentionEmailType: PushNotifications.Types.newConnectionRequest,
                        whiteLabelOrigin,
                        brandVariation,
                    });
                });

                return res.status(201).send({ userConnections });
            }).catch((err) => handleHttpError({
                err,
                res,
                message: 'SQL:USER_CONNECTIONS_ROUTES:ERROR',
            }));
        }

        return res.status(201).send({});
    } catch (err: any) {
        return handleHttpError({
            err,
            res,
            message: 'SQL:USER_CONNECTIONS_ROUTES:ERROR',
        });
    }
};

const findPeopleYouMayKnow: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const requestingUserId = userId;
    const locale = req.headers['x-localecode'] || 'en-us';

    const { contacts } = req.body;
    const contactEmails: IFindUsersByContactInfo[] = [];
    const contactPhones: IFindUsersByContactInfo[] = [];
    contacts.forEach((contact) => {
        if (contact.emailAddresses?.length) {
            contact.emailAddresses.forEach((item: any) => {
                contactEmails.push({
                    email: item.email,
                });
            });
        }
        if (contact.phoneNumbers?.length) {
            contact.phoneNumbers.forEach((item: any) => {
                contactPhones.push({
                    phoneNumber: item.number,
                });
            });
        }
    });

    const contactsLimitedForPerformance = contactEmails.slice(0, 500).concat(contactPhones.slice(0, 500));

    return Store.users.findUsersByContactInfo(contactsLimitedForPerformance, ['id']).then((users: { id: string; }[]) => {
        // TODO: Add db constraint to prevent requestingUserId equal to acceptingUserId
        const filteredUsers = users.filter((u) => u.id !== requestingUserId);
        const mightKnowConnections = filteredUsers.map((user) => ({
            requestingUserId,
            acceptingUserId: user.id,
            requestStatus: UserConnectionTypes.MIGHT_KNOW,
        }));

        return Store.userConnections.createIfNotExist(mightKnowConnections);
    })
        .then((connections) => res.status(201).send({ mightKnow: connections.length }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_CONNECTIONS_ROUTES:ERROR' }));
};

// READ
const getUserConnection = (req, res) => Store.userConnections.getUserConnections({
    requestingUserId: req.params.requestingUserId,
    acceptingUserId: Number(req.query.acceptingUserId),
})
    .then((results) => {
        if (!results.length) {
            return handleHttpError({
                res,
                message: `No user connection found with id, ${req.params.id}.`,
                statusCode: 404,
            });
        }
        return res.status(200).send(results[0]);
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_CONNECTIONS_ROUTES:ERROR' }));

const getTopRankedConnections = (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    const {
        groupSize,
        distanceMeters,
        latitude,
        longitude,
        pageSize,
    } = req.query;
    let requestingUserDetails: any = {};

    return Store.users.getUserById(userId, ['id', 'lastKnownLatitude', 'lastKnownLongitude'])
        .then(([user]) => {
            requestingUserDetails = {
                ...user,
                lastKnownLatitude: latitude || user.lastKnownLatitude,
                lastKnownLongitude: longitude || user.lastKnownLongitude,
            };
            if (!requestingUserDetails.lastKnownLatitude || !requestingUserDetails.lastKnownLongitude) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.userConnections.locationRequired'),
                    statusCode: 400,
                    errorCode: ErrorCodes.LOCATION_REQUIRED,
                });
            }

            return Store.userConnections.searchUserConnections({
                orderBy: 'interactionCount',
                filterBy: 'lastKnownLocation',
                query: distanceMeters || 96560.6, // ~60 miles converted to meters
                order: 'desc',
                pagination: {
                    itemsPerPage: pageSize || 20,
                    pageNumber: 1,
                },
                userId,
                latitude: requestingUserDetails.lastKnownLatitude,
                longitude: requestingUserDetails.lastKnownLongitude,
            }).then((results) => {
                const userIds = results?.reduce((acc, cur) => [...new Set([...acc, cur.requestingUserId, cur.acceptingUserId])], [requestingUserDetails.id]);

                return Store.userInterests.getByUserIds(userIds, {
                    isEnabled: true,
                }, 'engagementCount', ['userId', 'interestId', 'score', 'engagementCount', 'isEnabled', 'updatedAt'])
                    .then((userInterests) => {
                        const interestsIdMap = {};
                        userInterests.forEach((uInterest) => {
                            if (uInterest.isEnabled) {
                                const thisUser = {
                                    id: uInterest.userId,
                                    score: uInterest.score,
                                    engagementCount: uInterest.engagementCount,
                                    ranking: getInterestRanking(uInterest.engagementCount, uInterest.score),
                                    updatedAt: uInterest.updatedAt,
                                };
                                if (!interestsIdMap[uInterest.interestId]) {
                                    interestsIdMap[uInterest.interestId] = {
                                        displayNameKey: uInterest.displayNameKey,
                                        emoji: uInterest.emoji,
                                        users: [thisUser],
                                    };
                                } else {
                                    interestsIdMap[uInterest.interestId].users.push(thisUser);
                                }
                            }
                        });
                        let sharedInterests = {};
                        Object.entries(interestsIdMap).forEach(([key, value]) => {
                            if (interestsIdMap[key]?.users?.length > 1) {
                                sharedInterests[key] = value;
                            }
                        });
                        // Use own user interests when no other users nearby
                        if (!results?.length) {
                            sharedInterests = interestsIdMap;
                        }
                        return res.status(200).send({
                            results,
                            sharedInterests,
                            requestingUserDetails,
                            hasNearbyConnections: !!results?.length,
                            pagination: {
                                itemsPerPage: Number(20),
                                pageNumber: Number(1),
                            },
                        });
                    });
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_CONNECTIONS_ROUTES:ERROR' }));
};

const searchUserConnections: RequestHandler = (req: any, res: any) => {
    const {
        filterBy,
        filterOperator,
        query,
        itemsPerPage,
        pageNumber,
        shouldCheckReverse,
    } = req.query;
    const integerColumns = ['interactionCount'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const searchPromise = Store.userConnections.searchUserConnections(searchArgs[0], searchArgs[1], shouldCheckReverse);
    const countPromise = Store.userConnections.countRecords({
        filterBy,
        filterOperator,
        query,
    }, shouldCheckReverse);

    return Promise.all([searchPromise, countPromise]).then(([results, countResult]) => {
        const response = {
            results,
            pagination: {
                totalItems: Number(countResult[0].count),
                itemsPerPage: Number(itemsPerPage),
                pageNumber: Number(pageNumber),
            },
        };

        res.status(200).send(response);
    })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_CONNECTIONS_ROUTES:ERROR' }));
};

// UPDATE
// TODO: RSERV-32 - return associated users (same as search userConnections does)
const updateUserConnection = (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    const acceptingUserId = userId;
    const requestingUserId = req.body.otherUserId;

    return Store.userConnections.getUserConnections({
        requestingUserId,
        acceptingUserId,
    }, true)
        .then((getResults) => {
            const {
                interactionCount,
                isConnectionBroken,
                requestStatus,
            } = req.body;

            if (!getResults.length) {
                return handleHttpError({
                    res,
                    message: `No user connection found with requesting user id, ${requestingUserId}.`,
                    statusCode: 404,
                });
            }

            Store.users.getUserById(requestingUserId, ['userName', 'email']).then((otherUserRows) => {
                const fromUserName = otherUserRows[0]?.userName || otherUserRows[0]?.email;

                if (requestStatus === UserConnectionTypes.COMPLETE) {
                    Promise.all([
                        // For sender
                        createOrUpdateAchievement({
                            'x-userid': getResults[0].requestingUserId,
                            ...req.headers,
                        }, {
                            achievementClass: 'socialite',
                            achievementTier: '1_2',
                            progressCount: 1,
                        }),

                        // For accepter
                        createOrUpdateAchievement({
                            'x-userid': getResults[0].acceptingUserId,
                            ...req.headers,
                        }, {
                            achievementClass: 'socialite',
                            achievementTier: '1_2',
                            progressCount: 1,
                        }),
                    ]).catch((err) => {
                        logSpan({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: ['Error while creating socialite achievements for accepted friend requests, tier 1_2'],
                            traceArgs: {
                                'error.message': err?.message,
                            },
                        });
                    });
                }

                sendEmailAndOrPushNotification(Store.users.findUser, req.headers, {
                    authorization,
                    fromUser: {
                        id: userId,
                        userName: fromUserName || '',
                    },
                    locale,
                    toUserId: getResults[0].acceptingUserId,
                    type: PushNotifications.Types.connectionRequestAccepted,
                    whiteLabelOrigin,
                    brandVariation,
                });
            }).catch((err) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: [err?.message],
                    traceArgs: {
                        'error.message': err?.message,
                    },
                });
            });

            return Store.userConnections
                .updateUserConnection({
                    requestingUserId: getResults[0].requestingUserId,
                    acceptingUserId: getResults[0].acceptingUserId,
                }, {
                    interactionCount,
                    isConnectionBroken,
                    requestStatus,
                })
                .then(() => Store.userConnections.getExpandedUserConnections({
                    requestingUserId: getResults[0].requestingUserId,
                    acceptingUserId: getResults[0].acceptingUserId,
                }))
                .then((results) => res.status(202).send(results[0]));
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_CONNECTIONS_ROUTES:ERROR' }));
};

const updateUserConnectionType = (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    const acceptingUserId = userId;
    const requestingUserId = req.body.otherUserId;

    return Store.userConnections.getUserConnections({
        requestingUserId,
        acceptingUserId,
    }, true)
        .then((getResults) => {
            if (!getResults.length) {
                return handleHttpError({
                    res,
                    message: `No user connection found with requesting user id, ${requestingUserId}.`,
                    statusCode: 404,
                });
            }

            return Store.userConnections
                .updateUserConnection({
                    requestingUserId: getResults[0].requestingUserId,
                    acceptingUserId: getResults[0].acceptingUserId,
                }, {
                    type: req.body.type,
                })
                .then(() => Store.userConnections.getExpandedUserConnections({
                    requestingUserId: getResults[0].requestingUserId,
                    acceptingUserId: getResults[0].acceptingUserId,
                }))
                .then((results) => res.status(202).send(results[0]));
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_CONNECTIONS_ROUTES:ERROR' }));
};

const incrementUserConnection = (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    const requestingUserId = userId;

    if (!userId) {
        return res.status(200).send({
            message: 'Missing user ID',
        });
    }

    const {
        incrBy,
        acceptingUserId,
    } = req.body;

    const ceilIncrBy = Math.min(5, (incrBy || 1));

    return Store.userConnections
        .incrementUserConnection(acceptingUserId, requestingUserId, ceilIncrBy)
        .then((results) => res.status(200).send(results[0]))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_CONNECTIONS_ROUTES:ERROR' }));
};

export {
    createUserConnection,
    createOrInviteUserConnections,
    findPeopleYouMayKnow,
    getTopRankedConnections,
    getUserConnection,
    searchUserConnections,
    updateUserConnection,
    updateUserConnectionType,
    incrementUserConnection,
};
