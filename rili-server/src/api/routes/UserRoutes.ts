import * as express from 'express';
import Knex from 'knex';
import * as httpResponse from 'rili-public-library/utilities/http-response.js';
import { IConnection } from '../../store/connection';
import {
    createUserValidation,
} from '../validation/users';
import {
    validate,
} from '../validation';
import handleError from '../../utilities/handleError';
import { hashPassword } from '../../utilities/userHelpers';
import { HttpErrors } from '../../constants';
import UsersStore from '../../store/UsersStore';

const router = express.Router();
const knex: Knex = Knex({ client: 'pg' });

class UserRoutes {
    connection: IConnection;

    router: express.Router = router;

    constructor(connection: any) {
        this.connection = connection;

        router.route('/users')
            .get((req: any, res: any) => UsersStore.getUsers()
                .then((results) => res.status(200).send(httpResponse.success(results[0])))
                .catch((err) => handleError(err.toString(), res, 'SQL:USER_ROUTES:ERROR')))

            .post(createUserValidation, validate, (req: any, res: any) => this.checkIfUserExists(req.body).then((exists) => {
                if (exists) {
                    return res.status(400).send(httpResponse.error({
                        id: HttpErrors.USER_EXISTS,
                        message: 'Username, e-mail, and phone number must be unique. A user already exists.',
                        statusCode: 400,
                    }));
                }

                return hashPassword(req.body.password)
                    .then((hash) => UsersStore.createUser({
                        email: req.body.email,
                        firstName: req.body.firstName,
                        lastName: req.body.lastName,
                        password: hash,
                        phoneNumber: req.body.phoneNumber,
                        userName: req.body.userName,
                    })
                        .then((results) => res.status(201).send(httpResponse.success(results[0])))
                        .catch((err) => handleError(err, res, 'SQL:USER_ROUTES:ERROR')));
            }).catch((err) => handleError(err.toString(), res, 'SQL:USER_ROUTES:ERROR')));

        router.route('/users/:id')
            .get((req, res) => UsersStore.getUsers({
                id: req.params.id,
            }).then((results) => res.status(200).send(httpResponse.success(results[0]))).catch((err) => {
                if (err === 404) {
                    return res.status(404).send(httpResponse.error({
                        message: `No user found with id, ${req.params.id}.`,
                        statusCode: 404,
                    }));
                }

                return handleError(err, res, 'SQL:USER_ROUTES:ERROR');
            }))

            .put((req, res) => UsersStore.updateUser({
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                phoneNumber: req.body.phoneNumber,
                userName: req.body.userName,
            }, {
                id: req.params.id,
            })
                .then((results) => res.status(200).send(httpResponse.success(results[0])))
                .catch((err) => handleError(err, res, 'SQL:USER_ROUTES:ERROR')))

            .delete((req, res) => UsersStore.deleteUsers({ id: req.params.id })
                .then((results) => {
                    if (results.length > 0) {
                        return res.status(200).send(httpResponse.success(`User with id, ${req.params.id}, was successfully deleted`));
                    }

                    return res.status(404).send(httpResponse.error({
                        message: `No user found with id, ${req.params.id}.`,
                        statusCode: 404,
                    }));
                })
                .catch((err) => handleError(err, res, 'SQL:USER_ROUTES:ERROR')));
    }

    checkIfUserExists = (body: any) => {
        const {
            id, email, userName, phoneNumber,
        } = body;
        return this.connection.read.query(knex.select('*').from('main.users')
            .where(function () {
                return id ? this.where({ id }) : this;
            })
            .orWhere({ email })
            .orWhere({ userName })
            .orWhere({ phoneNumber })
            .toString())
            .then((result) => result.rows.length > 0);
    }
}

export default UserRoutes;
