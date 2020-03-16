import * as express from 'express';
import Knex from 'knex';
import * as httpResponse from 'rili-public-library/utilities/http-response.js';
import printLogs from 'rili-public-library/utilities/print-logs.js';
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

const router = express.Router();
const knex: Knex = Knex({ client: 'pg' });

class UserRoutes {
    connection: IConnection;

    router: express.Router = router;

    constructor(connection: any) {
        this.connection = connection;

        // middleware to log time of a user route request
        router.use((req, res, next) => {
            printLogs({
                level: 'http',
                messageOrigin: `SQL:USER_ROUTES:${req.method}`,
                messages: [req.baseUrl],
            });
            next();
        });

        router.route('/users')
            .get((req: any, res: any) => this.connection.read.query(knex.select('*').from('main.users').orderBy('id').toString())
                .then((result) => res.status(200).send(httpResponse.success(result.rows[0])))
                .catch((err) => handleError(err.toString(), res, 'SQL:USER_ROUTES:ERROR')))
            .post(createUserValidation, validate, (req: any, res: any) => this.checkIfUserExists(req.body).then((exists) => {
                if (exists) {
                    return res.status(400).send(httpResponse.error({
                        id: HttpErrors.USER_EXISTS,
                        message: 'Username, e-mail, and phone number must be unique. A user already exists.',
                        statusCode: 400,
                    }));
                }

                return hashPassword(req.body.password).then((hash) => this.connection.write.query(knex.insert({
                    email: req.body.email,
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    password: hash,
                    phoneNumber: req.body.phoneNumber,
                    userName: req.body.userName,
                }).into('main.users').returning(['email', 'id', 'userName', 'accessLevels']).toString())
                    .then((result) => res.status(201).send(httpResponse.success(result.rows[0])))
                    .catch((err) => handleError(err, res, 'SQL:USER_ROUTES:ERROR')));
            }).catch((err) => handleError(err.toString(), res, 'SQL:USER_ROUTES:ERROR')));

        router.route('/users/:id')
            .get((req, res) => this.getUser(req.params.id).then((user) => res.status(200).send(httpResponse.success(user))).catch((err) => {
                if (err === 404) {
                    return res.status(404).send(httpResponse.error({
                        message: `No user found with id, ${req.params.id}.`,
                        statusCode: 404,
                    }));
                }

                return handleError(err, res, 'SQL:USER_ROUTES:ERROR');
            }))
            .put((req, res) => this.connection.write.query(knex.update({ // TODO: Check if (other) users exist with unique properties, Throw error
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                phoneNumber: req.body.phoneNumber,
                userName: req.body.userName,
            })
                .into('main.users')
                .where({ id: req.params.id }).returning('*')
                .toString())
                .then((result) => this.getUser(req.params.id) // TODO: Handle case where user already exists
                    .then((user) => res.status(200).send(httpResponse.success(user))))
                .catch((err) => handleError(err, res, 'SQL:USER_ROUTES:ERROR')))
            .delete((req, res) => this.connection.write.query(knex.delete().from('main.users').where({ id: req.params.id }).toString())
                .then((result) => {
                    if (result.rows.length > 0) {
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

    getUser = (value: string, key = 'id') => this.connection.read.query(knex.select('*').from('main.users').where({ [key]: value }).toString())
        .then((result) => {
            if (result.rows.length > 0) {
                return result.rows[0];
            }

            throw 404; // eslint-disable-line no-throw-literal
        })
}

export default UserRoutes;
