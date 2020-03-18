import * as express from 'express';
import {
    createUserValidation,
} from '../validation/users';
import {
    validate,
} from '../validation';
import handleHttpError from '../../utilities/handleHttpError';
import { hashPassword } from '../../utilities/userHelpers';
import UsersStore from '../../store/UsersStore';

const router = express.Router();

router.get('/users', (req: any, res: any) => UsersStore.getUsers()
    .then((results) => res.status(200).send(results[0]))
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' })));

router.post('/users', createUserValidation, validate, (req: any, res: any) => UsersStore.findUser(req.body)
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
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' })));

router.get('/users/:id', (req, res) => UsersStore.getUsers({ id: req.params.id })
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
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' })));

router.put('/users/:id', (req, res) => UsersStore.findUser({ id: req.params.id, ...req.body })
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
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' })));

router.delete('/users/:id', (req, res) => UsersStore.deleteUsers({ id: req.params.id })
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
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' })));

export default router;
