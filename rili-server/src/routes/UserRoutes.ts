import * as express from 'express';
import { Client, Pool } from 'pg';
import * as httpResponse from 'rili-public-library/utilities/http-response';
import printLogs from 'rili-public-library/utilities/print-logs';
import { shouldPrintSQLLogs } from '../server-api';
const router = express.Router();

class UserRoutes {
    connection: Pool | Client;
    router: express.Router = router;

    constructor(connection: Pool | Client) {
        // TODO: Determine if should end connection after each request
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

        router.route('/')
            .get((req, res) => {
                const sql = `
                    SELECT * from users;
                `;
                connection.query(
                    sql,
                    (err, results) => {
                        if (err) {
                            this.handleError(err, res);
                            return;
                        }

                        res.status(200).send(httpResponse.success(results.rows));
                    },
                );
            })
            .post((req, res) => {
                const sql = `
                    INSERT INTO users (first_name, last_name, phone_number) values($1, $2, $3) RETURNING *;
                `;
                const values = [req.body.firstName, req.body.lastName, req.body.phoneNumber];
                connection.query(
                    sql,
                    values,
                    (err, results) => {
                        if (err) {
                            this.handleError(err, res);
                            return;
                        }

                        res.status(201).send(httpResponse.success(results.rows[0]));
                    },
                );
            });

        router.route('/:id')
            .get((req, res) => {
                this.getUser(req.params.id).then((user) => {
                    res.send(user);
                }).catch((err) => {
                    if (err === 404) {
                        res.status(404).send(httpResponse.error(404, `No user found with id, ${req.params.id}.`));
                    } else {
                        this.handleError(err, res);
                    }
                });
            })
            .put((req, res) => {
                const sql = `
                    UPDATE users
                    SET
                        first_name = $1,
                        last_name = $2,
                        phone_number = $3
                    WHERE id = $4;
                `;
                const values = [req.body.firstName, req.body.lastName, req.body.phoneNumber, req.params.id];
                connection.query(
                    sql,
                    values,
                    (err, results) => {
                        if (err) {
                            this.handleError(err, res);
                            return;
                        }

                        // TODO: Handle case where user already exists
                        this.getUser(req.params.id).then((user) => {
                            res.status(200).send(httpResponse.success(user));
                        });
                    },
                );
            })
            .delete((req, res) => {
                const sql = `
                    DELETE from users
                    WHERE id = $1;
                `;
                const values = [req.params.id];
                connection.query(
                    sql,
                    values,
                    (err, results) => {
                        if (err) {
                            this.handleError(err, res);
                            return;
                        }

                        if (results.rowCount > 0) {
                            res.status(200).send(httpResponse.success(`Customer with id, ${req.params.id}, was successfully deleted`));
                        } else {
                            res.status(404).send(httpResponse.error(404, `No user found with id, ${req.params.id}.`));
                        }
                    },
                );
            });
    }

    getUser = (userId: string) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM users WHERE id = $1`;
            const values = [userId];
            this.connection.query(
                sql,
                values,
                (err, results) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (results && results.rows.length > 0) {
                        resolve(results.rows[0]);
                    } else {
                        reject(404);
                    }
                },
            );
        });
    }

    handleError = (err: Error, res: express.Response) => {
        // TODO: Handle various error status codes
        printLogs({
            shouldPrintLogs: shouldPrintSQLLogs,
            messageOrigin: `SQL:USER_ROUTES:ERROR`,
            messages: [err.toString()],
        });
        res.status(500).end(httpResponse.error(500, err.toString()));
    }
}

export default UserRoutes;
