import * as bcrypt from 'bcrypt';
import * as express from 'express';
import * as Knex from 'knex';
import * as httpResponse from 'rili-public-library/utilities/http-response';
import printLogs from 'rili-public-library/utilities/print-logs';
import { shouldPrintSQLLogs } from '../../server-api';
import {
    authenticateUserValidation,
} from '../validation/auth';
import {
    validate,
} from '../validation';
import handleError from '../../utilities/handleError';
import { createUserToken } from '../../utilities/userHelpers';

const router = express.Router();
const notProd = process.env.NODE_ENV !== 'production';

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

        router.route('/auth')
            .post(authenticateUserValidation, validate, (req: any, res: any) => {
                const invalidUserNameOrPassword = httpResponse.error(401, 'Incorrect username or password');
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
                });
            });

        // router.route('/auth/token/:token')
        //     .post((req, res) => {
        //         this.getUser(req.body.userName).then((user) => {
        //             bcrypt.compare(req.body.password, user.password).then((isValid) => {
        //                 if (isValid) {
        //                     return res.status(200).send(httpResponse.success(user));
        //                 }

        //                 return res.status(401).send(invalidUserNameOrPassword);
        //             }).catch((err: any) => {
        //                 return handleError(err, res);
        //             });
        //         }).catch((error) => {
        //             if (error === 404) {
        //                 return res.status(401).send(invalidUserNameOrPassword);
        //             }
        //         });
        //     });
    }

    getUser = (userName: string) => {
        return this.knex.select('*').from('main.users').where({ userName }).debug(notProd)
            .then((results) => {
                if (results && results.length > 0) {
                    return results[0];
                }

                throw 404;
            });
    }
}

export default AuthRoutes;
