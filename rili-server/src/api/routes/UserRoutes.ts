import * as express from 'express';
import * as Knex from 'knex';
import * as httpResponse from 'rili-public-library/utilities/http-response';
import printLogs from 'rili-public-library/utilities/print-logs';
import { IConnection } from '../../store/connection';
import { shouldPrintSQLLogs } from '../../server-api';
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
                shouldPrintLogs: shouldPrintSQLLogs,
                messageOrigin: `SQL:USER_ROUTES:${req.method}`,
                messages: [req.baseUrl],
            });
            next();
        });

        router.route('/users')
            .get((req: any, res: any) => this.connection.read.query(knex.select('*').from('main.users').orderBy('id').toString())
                .then((result) => {
                    return res.status(200).send(httpResponse.success(result.rows[0]));
                })
                .catch(err => handleError(err, res)))
            .post(createUserValidation, validate, (req: any, res: any) => {
                return this.checkIfUserExists(req.body).then((exists) => {
                    if (exists) {
                        return res.status(400).send(httpResponse.error({
                            id: HttpErrors.USER_EXISTS,
                            message: 'Username, e-mail, and phone number must be unique. A user already exists.',
                            statusCode: 400,
                        }));
                    }

                    return hashPassword(req.body.password).then((hash) => {
                        return this.connection.write.query(knex.insert({
                            email: req.body.email,
                            firstName: req.body.firstName,
                            lastName: req.body.lastName,
                            password: hash,
                            phoneNumber: req.body.phoneNumber,
                            userName: req.body.userName,
                        }).into('main.users').returning(['email', 'id', 'userName', 'accessLevels']).toString())
                            .then((result) => {
                                return res.status(201).send(httpResponse.success(result.rows[0]));
                            })
                            .catch((err) => {
                                return handleError(err, res);
                            });
                    });
                }).catch((err) => {
                    return handleError(err.toString(), res);
                });
            });

        router.route('/users/:id')
            .get((req, res) => {
                return this.getUser(req.params.id).then((user) => {
                    return res.send(httpResponse.success(user));
                }).catch((err) => {
                    if (err === 404) {
                        return res.status(404).send(httpResponse.error({
                            message: `No user found with id, ${req.params.id}.`,
                            statusCode: 404,
                        }));
                    }

                    return handleError(err, res);
                });
            })
            .put((req, res) => {
                // TODO: Check if (other) users exist with unique properties
                // Throw error
                return this.connection.write.query(knex
                    .update({
                        firstName: req.body.firstName,
                        lastName: req.body.lastName,
                        phoneNumber: req.body.phoneNumber,
                        userName: req.body.userName,
                    })
                    .into('main.users')
                    .where({ id: req.params.id }).returning('*').toString())
                    .then((result) => {
                        // TODO: Handle case where user already exists
                        return this.getUser(req.params.id).then((user) => {
                            res.status(200).send(httpResponse.success(user));
                        });
                    })
                    .catch((err) => {
                        return handleError(err, res);
                    });
            })
            .delete((req, res) => {
                return this.connection.write.query(knex.delete().from('main.users').where({ id: req.params.id }).toString())
                    .then((result) => {
                        if (result.rows.length > 0) {
                            res.status(200).send(httpResponse.success(`User with id, ${req.params.id}, was successfully deleted`));
                        } else {
                            res.status(404).send(httpResponse.error({
                                message: `No user found with id, ${req.params.id}.`,
                                statusCode: 404,
                            }));
                        }
                    })
                    .catch((err) => {
                        return handleError(err, res);
                    });
            });
    }

    checkIfUserExists = (body: any) => {
        const { id, email, userName, phoneNumber } = body;
        return this.connection.read.query(knex.select('*').from('main.users')
            .where(function () {
                return id ? this.where({ id }) : this;
            })
            .orWhere({ email })
            .orWhere({ userName })
            .orWhere({ phoneNumber }).toString())
            .then((result) => {
                return result.rows.length > 0;
            });
    }

    getUser = (value: string, key = 'id') => {
        return this.connection.read.query(knex.select('*').from('main.users').where({ [key]: value }).toString())
            .then((result) => {
                if (result.rows.length > 0) {
                    return result.rows[0];
                }

                throw 404;
            });
    }
}

export default UserRoutes;
