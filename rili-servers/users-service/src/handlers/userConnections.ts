import { RequestHandler } from 'express';
import { getSearchQueryArgs } from 'rili-public-library/utilities/http.js';
import handleHttpError from '../utilities/handleHttpError';
import UserConnectionsStore from '../store/UserConnectionsStore';
import UsersStore from '../store/UsersStore';

// CREATE
// TODO:RSERV-24: Security, get requestingUserId from user header token
const createUserConnection: RequestHandler = async (req: any, res: any) => {
    const {
        requestingUserId,
        acceptingUserId,
        acceptingUserPhoneNumber,
        acceptingUserEmail,
    } = req.body;
    let acceptingId;
    if (!acceptingUserId) {
        try {
            const userResults = await UsersStore.findUser({
                phoneNumber: acceptingUserPhoneNumber,
                email: acceptingUserEmail,
            });

            if (!userResults.length) {
                return handleHttpError({
                    res,
                    message: 'No user found with the provided criteria.',
                    statusCode: 404,
                });
            }
            acceptingId = userResults[0].id;

            if (acceptingId === requestingUserId) {
                return handleHttpError({
                    res,
                    message: 'Cannot make a user connection with self.',
                    statusCode: 400,
                });
            }
        } catch (err) {
            console.log(err);
            return handleHttpError({
                err,
                res,
                message: 'SQL:USER_CONNECTIONS_ROUTES:ERROR',
            });
        }
    }

    return UserConnectionsStore.getUserConnections({
        requestingUserId,
        acceptingUserId: acceptingId,
    })
        .then((getResults) => {
            if (getResults.length) {
                return handleHttpError({
                    res,
                    message: 'This user connection already exists.',
                    statusCode: 400,
                });
            }

            return UserConnectionsStore.createUserConnection({
                requestingUserId: req.body.requestingUserId,
                acceptingUserId: req.body.acceptingUserId || acceptingId,
                requestStatus: 'pending',
            }).then((results) => res.status(201).send({ id: results[0].id }));
        })
        .catch((err) => handleHttpError({
            err,
            res,
            message: 'SQL:USER_CONNECTIONS_ROUTES:ERROR',
        }));
};

// READ
const getUserConnection = (req, res) => UserConnectionsStore.getUserConnections({
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
        query,
        itemsPerPage,
        pageNumber,
    } = req.query;
    const integerColumns = ['requestingUserId', 'acceptingUserId', 'interactionCount'];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const searchPromise = UserConnectionsStore.searchUserConnections(searchArgs[0], searchArgs[1]);
    const countPromise = UserConnectionsStore.countRecords({
        filterBy,
        query,
    });

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
// TODO: Assess security implications to prevent anyone from hacking this endpoint
const updateUserConnection = (req, res) => UserConnectionsStore.getUserConnections({
    requestingUserId: req.params.requestingUserId,
    acceptingUserId: req.body.acceptingUserId,
})
    .then((getResults) => {
        const {
            interactionCount,
            isConnectionBroken,
            requestStatus,
        } = req.body;

        if (!getResults.length) {
            return handleHttpError({
                res,
                message: `No user connection found with id, ${req.params.id}.`,
                statusCode: 404,
            });
        }

        return UserConnectionsStore
            .updateUserConnection({
                requestingUserId: req.params.requestingUserId,
                acceptingUserId: req.body.acceptingUserId,
            }, {
                interactionCount,
                isConnectionBroken,
                requestStatus,
            })
            .then((results) => res.status(202).send(results[0]));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_CONNECTIONS_ROUTES:ERROR' }));

export {
    createUserConnection,
    getUserConnection,
    searchUserConnections,
    updateUserConnection,
};
