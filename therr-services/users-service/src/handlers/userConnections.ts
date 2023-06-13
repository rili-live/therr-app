import { RequestHandler } from 'express';
import { CurrentSocialValuations, Notifications, PushNotifications } from 'therr-js-utilities/constants';
import { getSearchQueryArgs } from 'therr-js-utilities/http';
import printLogs from 'therr-js-utilities/print-logs';
import normalizePhoneNumber from 'therr-js-utilities/normalize-phone-number';
import normalizeEmail from 'normalize-email';
import emailValidator from 'therr-js-utilities/email-validator';
import deepEmailValidate from 'deep-email-validator';
import sendPushNotificationAndEmail from '../utilities/sendPushNotificationAndEmail';
import beeline from '../beeline';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import { translateNotification } from './notifications';
import { createUserHelper } from './helpers/user';
import sendContactInviteEmail from '../api/email/sendContactInviteEmail';
import twilioClient from '../api/twilio';
import { createOrUpdateAchievement } from './helpers/achievements';
import { parseConfigValue } from './config';

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
    const authorization = req.headers.authorization;
    const userId = req.headers['x-userid'];
    const fromUserFullName = `${requestingUserFirstName} ${requestingUserLastName}`;
    const locale = req.headers['x-localecode'] || 'en-us';
    let acceptingUser: {
        id?: string,
        deviceMobileFirebaseToken?: string;
        email?: string;
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
    if (!acceptingUserId) {
        try {
            const userResults = await Store.users.findUser({
                phoneNumber: acceptingUserPhoneNumber,
                email: acceptingUserEmail,
            }, ['id', 'deviceMobileFirebaseToken', 'email', 'isUnclaimed']);

            let unverifiedUser;

            // 1a. Send email invite when user does not exist
            if (!userResults.length) {
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
                    unverifiedUser = await createUserHelper({
                        email: acceptingUserEmail,
                    }, false, {
                        fromName: fromUserFullName,
                        fromEmail: requestingUserEmail,
                        toEmail: acceptingUserEmail,
                    }, locale);
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
            }, ['id', 'deviceMobileFirebaseToken', 'email', 'isUnclaimed']);

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
            if (getResults.length && !getResults[0].isConnectionBroken) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.userConnections.alreadyExists'),
                    statusCode: 400,
                });
            }

            let connectionPromise;

            if (getResults.length && getResults[0].isConnectionBroken) {
                // Re-create connection after unconnection
                connectionPromise = Store.userConnections.updateUserConnection({
                    requestingUserId: getResults[0].requestingUserId,
                    acceptingUserId: acceptingUser.id as string,
                }, {
                    isConnectionBroken: false,
                    requestStatus: 'pending',
                });
            } else {
                createOrUpdateAchievement({
                    authorization,
                    userId,
                    locale,
                }, {
                    achievementClass: 'socialite',
                    achievementTier: '1_1',
                    progressCount: 1,
                }).catch((err) => {
                    printLogs({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Error while creating socialite achievements for sent friend requests, tier 1_1'],
                        tracer: beeline,
                        traceArgs: {
                            errMessage: err?.message,
                        },
                    });
                });

                connectionPromise = Store.userConnections.createUserConnection({
                    requestingUserId,
                    acceptingUserId: acceptingUser.id as string,
                    requestStatus: 'pending',
                });
            }

            // NOTE: no need to refetch user from DB
            sendPushNotificationAndEmail(() => Promise.resolve([acceptingUser as {
                deviceMobileFirebaseToken: string;
                email: string;
                isUnclaimed: boolean;
            }]), {
                authorization,
                fromUserName: fromUserFullName,
                fromUserId: userId,
                locale,
                toUserId: acceptingUser.id as string,
                type: 'new-connection-request',
                retentionEmailType: PushNotifications.Types.newConnectionRequest,
            }).catch((err) => {
                beeline.addContext({
                    routeName: 'CreateUserConnection',
                    method: sendPushNotificationAndEmail,
                    errorMessage: err.stack,
                });
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
                beeline.addContext({
                    routeName: 'CreateUserConnection',
                    errorMessage: err.stack,
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
    const authorization = req.headers.authorization;
    const userId = req.headers['x-userid'];
    const fromUserFullName = `${requestingUserFirstName} ${requestingUserLastName}`;
    const locale = req.headers['x-localecode'] || 'en-us';
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
                    from: process.env.TWILIO_SENDER_PHONE_NUMBER, // From a valid Twilio number
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
                createOrUpdateAchievement({
                    authorization,
                    userId,
                    locale,
                }, {
                    achievementClass: 'socialite',
                    achievementTier: '1_1',
                    progressCount: createdIds.length,
                }).catch((err) => {
                    printLogs({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Error while creating socialite achievements for multiple sent friend requests, tier 1_1'],
                        tracer: beeline,
                        traceArgs: {
                            errMessage: err?.message,
                        },
                    });
                });
                return Promise.all(emailSendPromises);
            })
            .then(() => Promise.all(phoneSendPromises))
            .catch((err) => { // TODO: change to Promise.allSettled
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

        // 4a. Reward inviter with coins
        if (coinRewardsTotal > 0) {
            Store.users.updateUser({
                settingsTherrCoinTotal: coinRewardsTotal,
            }, {
                id: userId,
            }).catch((err) => {
                printLogs({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: [err?.message],
                    tracer: beeline,
                    traceArgs: {
                        issue: 'error while updating user coins',
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
                const newConnectionUsers: { id: string; deviceMobileFirebaseToken: string; email: string; isUnclaimed: boolean; }[] = [];
                existingUsers
                    .forEach((user) => {
                        if (!connections.find((conn) => conn.acceptingUserId === user.id || conn.requestingUser === user.id)) {
                            newConnectionUserIds.push(user.id);
                            newConnectionUsers.push({
                                id: user.id,
                                deviceMobileFirebaseToken: user.deviceMobileFirebaseToken,
                                email: user.email,
                                isUnclaimed: user.isUnclaimed,
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
                    sendPushNotificationAndEmail(() => Promise.resolve([acceptingUser as {
                        deviceMobileFirebaseToken: string;
                        email: string;
                        isUnclaimed: boolean;
                    }]), {
                        authorization,
                        fromUserName: fromUserFullName,
                        fromUserId: userId,
                        locale,
                        toUserId: acceptingUser.id,
                        type: 'new-connection-request',
                        retentionEmailType: PushNotifications.Types.newConnectionRequest,
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
    const authorization = req.headers.authorization;
    const userId = req.headers['x-userid'];
    const acceptingUserId = userId;
    const locale = req.headers['x-localecode'] || 'en-us';
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

            Store.users.getUserById(requestingUserId, ['userName']).then((otherUserRows) => {
                const fromUserName = otherUserRows[0]?.userName;

                if (requestStatus === 'complete') {
                    Promise.all([
                        // For sender
                        createOrUpdateAchievement({
                            authorization,
                            userId: getResults[0].requestingUserId,
                            locale,
                        }, {
                            achievementClass: 'socialite',
                            achievementTier: '1_2',
                            progressCount: 1,
                        }),

                        // For accepter
                        createOrUpdateAchievement({
                            authorization,
                            userId: getResults[0].acceptingUserId,
                            locale,
                        }, {
                            achievementClass: 'socialite',
                            achievementTier: '1_2',
                            progressCount: 1,
                        }),
                    ]).catch((err) => {
                        printLogs({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: ['Error while creating socialite achievements for accepted friend requests, tier 1_2'],
                            tracer: beeline,
                            traceArgs: {
                                errMessage: err?.message,
                            },
                        });
                    });
                }

                sendPushNotificationAndEmail(Store.users.findUser, {
                    authorization,
                    fromUserName: fromUserName || '',
                    fromUserId: userId,
                    locale,
                    toUserId: getResults[0].acceptingUserId,
                    type: PushNotifications.Types.connectionRequestAccepted,
                });
            }).catch((err) => {
                printLogs({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: [err?.message],
                    tracer: beeline,
                    traceArgs: {
                        port: process.env.USERS_SERVICE_API_PORT,
                        processId: process.pid,
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

export {
    createUserConnection,
    createOrInviteUserConnections,
    getUserConnection,
    searchUserConnections,
    updateUserConnection,
};
