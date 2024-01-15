// import { RequestHandler } from 'express';
import { parseHeaders } from 'therr-js-utilities/http';
import { GroupRequestStatuses } from 'therr-js-utilities/constants';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
// import translate from '../utilities/translator';

// READ
const getUserGroups = (req, res) => Store.userGroups.get({
    userId: req.headers['x-userid'],
})
    .then((results) => res.status(200).send({
        userGroups: results,
    }))
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));

// WRITE
const createUserGroup = (req, res) => {
    const {
        userId,
    } = parseHeaders(req.headers);
    const {
        groupId,
    } = req.body;

    // TODO: Check if group requires approval
    const status = GroupRequestStatuses.APPROVED;

    return Store.userGroups.create({
        groupId,
        userId,
        status,
    })
        .then(([userGroup]) => res.status(201).send(userGroup))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));
};

const updateUserGroup = (req, res) => {
    const {
        userId,
    } = parseHeaders(req.headers);
    const {
        role,
        status,
    } = req.body;

    return Store.userGroups.update(req.params.id, {
        role,
        status,
    })
        .then((results) => res.status(201).send({
            userGroups: results,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));
};

const deleteUserGroup = (req, res) => {
    const {
        userId,
    } = parseHeaders(req.headers);
    const {
        role,
        status,
    } = req.body;

    return Store.userGroups.delete(req.params.id, userId)
        .then((results) => res.status(201).send({
            userGroups: results,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));
};

export {
    getUserGroups,
    createUserGroup,
    updateUserGroup,
    deleteUserGroup,
};
