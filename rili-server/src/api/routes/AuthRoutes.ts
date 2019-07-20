import * as bcrypt from 'bcrypt';
import * as express from 'express';
import * as Knex from 'knex';
import * as jwt from 'jsonwebtoken';
import * as httpResponse from 'rili-public-library/utilities/http-response';
import printLogs from 'rili-public-library/utilities/print-logs';
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

const invalidUserNameOrPassword = httpResponse.error({
    message: 'Incorrect username or password',
    statusCode: 401,
});

class AuthRoutes {
    knex: Knex;
    router: express.Router = router;

    constructor(knex: Knex) {
        // TODO: Determine if should end connection after each request
        this.knex = knex;

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
            .post(authenticateUserValidation, validate, (req: any, res: any) => {
                this.getUser(req.body.userName).then((user) => {
                    bcrypt.compare(req.body.password, user.password).then((isValid) => {
                        if (isValid) {
                            const idToken = createUserToken(user, req.body.rememberMe);
                            return res.status(200).send(httpResponse.success({
                                ...user,
                                idToken,
                            }));
                        }

                        return res.status(401).send(invalidUserNameOrPassword);
                    }).catch((err: any) => {
                        return handleError(err, res);
                    });
                }).catch((error) => {
                    if (error === 404) {
                        return res.status(401).send(invalidUserNameOrPassword);
                    }
                    return res.status(500).send('something went wrong');
                });
            });

        // Logout user
        router.route('/auth/logout')
            .post(logoutUserValidation, validate, (req: any, res: any) => {
                this.getUser(req.body.userName).then(() => {
                    return res.status(204).send();
                }).catch((error) => {
                    return res.status(500).send('something went wrong');
                });
            });

        // Validate user token (after login)
        router.route('/auth/user-token/validate')
            .post(authenticateUserTokenValidation, validate, (req: any, res: any) => {
                try {
                    const decodedToken = jwt.verify(req.body.idToken, process.env.SECRET);
                    return res.status(200).send(decodedToken);
                } catch (error) {
                    if (error.name === 'TokenExpiredError') {
                        return res.status(401).send(error.message);
                    }

                    return res.status(500).send('something went wrong');
                }
            });
    }

    getUser = (userName: string) => {
        return this.knex.select('*').from('main.users').where({ userName }).orWhere({ email: userName }).debug(notProd)
            .then((results) => {
                if (results && results.length > 0) {
                    return results[0];
                }

                throw 404;
            });
    }
}

export default AuthRoutes;
