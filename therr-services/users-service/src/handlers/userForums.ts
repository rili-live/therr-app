// import { RequestHandler } from 'express';
import { parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
// import translate from '../utilities/translator';

// READ
const getUserForums = (req, res) => Store.userForums.get({
    userId: req.headers['x-userid'],
})
    .then((results) => res.status(200).send({
        userForums: results,
    }))
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));

// WRITE
const createUserForum = (req, res) => {
    const {
        userId,
    } = parseHeaders(req.headers);
    const {
        groupId,
        role,
        status,
    } = req.body;

    return Store.userForums.create({
        groupId,
        userId,
        role,
        status,
    })
        .then((results) => res.status(201).send({
            userForums: results,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));
};

export {
    getUserForums,
    createUserForum,
};
