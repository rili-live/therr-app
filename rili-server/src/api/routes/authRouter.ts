import * as bcrypt from 'bcrypt';
import * as express from 'express';
import * as jwt from 'jsonwebtoken';
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

// Login user
router.post('/auth', authenticateUserValidation, validate, (req: any, res: any) => UsersStore
    .getUsers({ userName: req.body.userName }, { email: req.body.userName })
    .then((results) => {
        if (!results.length) {
            return res.status(404).send('User not found');
        }
        return bcrypt.compare(req.body.password, results[0].password)
            .then((isValid) => [results, isValid]);
    })
    .then(([results, isValid]) => {
        if (isValid) {
            const idToken = createUserToken(results[0], req.body.rememberMe);
            return res.status(201).send({
                ...results[0],
                idToken,
            });
        }

        return handleHttpError({
            res,
            message: 'Incorrect username or password',
            statusCode: 401,
        });
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:AUTH_ROUTES:ERROR' })));

// Logout user
router.post('/auth/logout', logoutUserValidation, validate, (req: any, res: any) => UsersStore.getUsers(req.body.userName)
    .then((results) => {
        if (!results.length) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
            });
        }
        res.status(204).send();
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:AUTH_ROUTES:ERROR' })));

// Validate user token (after login)
router.post('/auth/user-token/validate', authenticateUserTokenValidation, validate, (req: any, res: any) => {
    try {
        const decodedToken = jwt.verify(req.body.idToken, process.env.SECRET || '');
        return res.status(200).send(decodedToken);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return handleHttpError({
                res,
                err,
                message: err.message,
                statusCode: 401,
            });
        }

        return handleHttpError({ err, res, message: 'SQL:AUTH_ROUTES:ERROR' });
    }
});

export default router;
