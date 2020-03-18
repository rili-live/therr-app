import { RequestHandler } from 'express';
import handleHttpError from '../../utilities/handleHttpError';
import UsersStore from '../../store/UsersStore';
import { hashPassword } from '../../utilities/userHelpers';

// CREATE
const createUsers: RequestHandler = (req: any, res: any) => UsersStore.findUser(req.body)
    .then((findResults) => {
        if (findResults.length) {
            return handleHttpError({
                res,
                message: 'Username, e-mail, and phone number must be unique. A user already exists.',
                statusCode: 400,
            });
        }

        return hashPassword(req.body.password)
            .then((hash) => UsersStore
                .createUser({
                    email: req.body.email,
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    password: hash,
                    phoneNumber: req.body.phoneNumber,
                    userName: req.body.userName,
                })
                .then((results) => res.status(201).send(results[0])));
    })
    .catch((err) => handleHttpError({
        err,
        res,
        message: 'SQL:USER_ROUTES:ERROR',
    }));

// READ
const getUser = (req, res) => UsersStore.getUsers({ id: req.params.id })
    .then((results) => {
        if (!results.length) {
            return handleHttpError({
                res,
                message: `No user found with id, ${req.params.id}.`,
                statusCode: 404,
            });
        }
        return res.status(200).send(results[0]);
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

const getUsers: RequestHandler = (req: any, res: any) => UsersStore.getUsers()
    .then((results) => res.status(200).send(results[0]))
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

// UPDATE
const updateUser = (req, res) => UsersStore.findUser({ id: req.params.id, ...req.body })
    .then((findResults) => {
        if (!findResults.length) {
            return handleHttpError({
                res,
                message: 'Username, e-mail, and phone number must be unique. A user already exists.',
                statusCode: 400,
            });
        }

        return UsersStore
            .updateUser({
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                phoneNumber: req.body.phoneNumber,
                userName: req.body.userName,
            }, {
                id: req.params.id,
            })
            .then((results) => res.status(200).send(results[0]));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

// DELETE
const deleteUser = (req, res) => UsersStore.deleteUsers({ id: req.params.id })
    .then((results) => {
        if (!results.length) {
            return handleHttpError({
                res,
                message: `No user found with id, ${req.params.id}.`,
                statusCode: 404,
            });
        }

        return res.status(200).send({
            message: `User with id, ${req.params.id}, was successfully deleted`,
        });
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

export {
    createUsers,
    getUser,
    getUsers,
    updateUser,
    deleteUser,
};
