import { RequestHandler } from 'express';
import { Notifications } from 'therr-js-utilities/constants';
import { getSearchQueryArgs } from 'therr-js-utilities/http';
import sendPushNotification from '../utilities/sendPushNotification';
import beeline from '../beeline';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import { translateNotification } from './notifications';
import sendNewUserInviteEmail from '../api/email/sendNewUserInviteEmail';
import { createUserHelper } from './users';

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
    // eslint-disable-next-line eqeqeq
    const fromUserFullName = `${requestingUserFirstName} ${requestingUserLastName}`;
    const locale = req.headers['x-localecode'] || 'en-us';
    let acceptingId = acceptingUserId;

    if (!acceptingUserId) {
        try {
            const userResults = await Store.users.findUser({
                phoneNumber: acceptingUserPhoneNumber,
                email: acceptingUserEmail,
            });

            if (!userResults.length) {
                if (acceptingUserEmail) {
                    // TODO: Ratelimit this to prevent spamming new user email
                    // fire and forget
                    createUserHelper({
                        email: acceptingUserEmail,
                    }, false, {
                        fromName: fromUserFullName,
                        fromEmail: requestingUserEmail,
                        toEmail: acceptingUserEmail,
                    });

                    return res.status(201).send({
                        requestRecipientEmail: acceptingUserEmail,
                    });
                }

                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.userConnections.noUserFound'),
                    statusCode: 404,
                });
            }
            acceptingId = userResults[0].id;

            if (acceptingId === requestingUserId) {
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
    }

    // TODO: Make this one DB request
    return Store.userConnections.getUserConnections({
        requestingUserId,
        acceptingUserId: acceptingId,
    }, true)
        .then((getResults) => {
            const toUserIdForNotification = acceptingId;

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
                    acceptingUserId: getResults[0].acceptingUserId,
                }, {
                    isConnectionBroken: false,
                    requestStatus: 'pending',
                });
            } else {
                connectionPromise = Store.userConnections.createUserConnection({
                    requestingUserId,
                    acceptingUserId: acceptingId,
                    requestStatus: 'pending',
                });
            }

            sendPushNotification(Store.users.findUser, {
                authorization,
                fromUserName: fromUserFullName,
                fromUserId: userId,
                locale,
                toUserId: toUserIdForNotification,
                type: 'new-connection-request',
            });

            return connectionPromise.then(([userConnection]) => Store.notifications.createNotification({
                userId: acceptingId,
                type: Notifications.Types.CONNECTION_REQUEST_RECEIVED,
                associationId: userConnection.id,
                isUnread: true,
                messageLocaleKey: Notifications.MessageKeys.CONNECTION_REQUEST_RECEIVED,
                messageParams: { firstName: requestingUserFirstName, lastName: requestingUserLastName },
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

            sendPushNotification(Store.users.findUser, {
                authorization,
                fromUserName: '', // TODO: Fetch this or send it from the frontend
                fromUserId: userId,
                locale,
                toUserId: getResults[0].acceptingUserId,
                type: 'connection-request-accepted',
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
    getUserConnection,
    searchUserConnections,
    updateUserConnection,
};
