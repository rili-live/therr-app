import * as bcrypt from 'bcrypt';
import * as express from 'express';
import Knex from 'knex';
import * as jwt from 'jsonwebtoken';
import * as httpResponse from 'rili-public-library/utilities/http-response.js';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import { IConnection } from '../../store/connection';
import { shouldPrintSQLLogs } from '../../server-api';
import {
    authenticateUserTokenValidation,
    authenticateUserValidation,
    logoutUserValidation,
} from '../validation/auth';
import {
    validate,
} from '../validation';
import handleError from '../../utilities/handleError';
import { createUserToken } from '../../utilities/userHelpers';

const router = express.Router();
const notProd = process.env.NODE_ENV !== 'production';
const knex: Knex = Knex({ client: 'pg' });

const invalidUserNameOrPassword = httpResponse.error({
    message: 'Incorrect username or password',
    statusCode: 401,
});

class AuthRoutes {
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

        // Login user
        router.route('/auth')
            .post(authenticateUserValidation, validate, (req: any, res: any) => this.getUser(req.body.userName).then((user) => {
                bcrypt.compare(req.body.password, user.password).then((isValid) => {
                    if (isValid) {
                        const idToken = createUserToken(user, req.body.rememberMe);
                        return res.status(200).send(httpResponse.success({
                            ...user,
                            idToken,
                        }));
                    }

                    return res.status(401).send(invalidUserNameOrPassword);
                }).catch((err: any) => handleError(err, res));
            }).catch((error) => {
                if (error === 404) {
                    return res.status(401).send(invalidUserNameOrPassword);
                }
                return res.status(500).send('something went wrong');
            }));

        // Logout user
        router.route('/auth/logout')
            .post(logoutUserValidation, validate, (req: any, res: any) => this.getUser(req.body.userName)
                .then(() => res.status(204).send()).catch((error) => res.status(500).send('something went wrong')));

        // Validate user token (after login)
        router.route('/auth/user-token/validate')
            .post(authenticateUserTokenValidation, validate, (req: any, res: any) => {
                try {
                    const decodedToken = jwt.verify(req.body.idToken, process.env.SECRET || '');
                    return res.status(200).send(decodedToken);
                } catch (error) {
                    if (error.name === 'TokenExpiredError') {
                        return res.status(401).send(error.message);
                    }

                    return res.status(500).send('something went wrong');
                }
            });
    }

    getUser = (userName: string) => this.connection.read.query(knex.select('*').from('main.users').where({ userName }).orWhere({ email: userName })
        .toString())
        .then((result) => {
            if (result.rows.length > 0) {
                return result.rows[0];
            }

            throw 404; // eslint-disable-line
        })
}

export default AuthRoutes;
