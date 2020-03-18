import * as bcrypt from 'bcrypt';
import * as express from 'express';
import * as jwt from 'jsonwebtoken';
import * as httpResponse from 'rili-public-library/utilities/http-response.js';
import {
    authenticateUserTokenValidation,
    authenticateUserValidation,
    logoutUserValidation,
} from '../validation/auth';
import {
    validate,
} from '../validation';
import handleHttpError from '../../utilities/handleHttpError';
import { createUserToken } from '../../utilities/userHelpers';
import UsersStore from '../../store/UsersStore';

const router = express.Router();

const invalidUserNameOrPassword = httpResponse.error({
    message: 'Incorrect username or password',
    statusCode: 401,
});

// Login user
router.post('/auth', authenticateUserValidation, validate, (req: any, res: any) => UsersStore
    .getUsers({ userName: req.body.userName }, { email: req.body.userName })
    .then((results) => {
        if (!results.length) {
            return res.status(404).send('User not found');
        }
        bcrypt.compare(req.body.password, results[0].password).then((isValid) => {
            if (isValid) {
                const idToken = createUserToken(results[0], req.body.rememberMe);
                return res.status(201).send(httpResponse.success({
                    ...results[0],
                    idToken,
                }));
            }

            return res.status(401).send(invalidUserNameOrPassword);
        }).catch((err: any) => handleHttpError({ err, res, message: 'SQL:AUTH_ROUTES:ERROR' }));
    }).catch(() => res.status(500).send('something went wrong')));

// Logout user
router.post('/auth/logout', logoutUserValidation, validate, (req: any, res: any) => UsersStore.getUsers(req.body.userName)
    .then((results) => {
        if (!results.length) {
            return res.status(404).send('User not found');
        }
        res.status(204).send();
    })
    .catch(() => res.status(500).send('something went wrong')));

// Validate user token (after login)
router.post('/auth/user-token/validate', authenticateUserTokenValidation, validate, (req: any, res: any) => {
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

export default router;
