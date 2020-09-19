import { RequestHandler } from 'express';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { hashPassword } from '../utilities/userHelpers';
import generateCode from '../utilities/generateCode';
import { sendVerificationEmail } from '../api/email';

// CREATE
const createUser: RequestHandler = (req: any, res: any) => Store.users.findUser(req.body)
    .then((findResults) => {
        if (findResults.length) {
            return handleHttpError({
                res,
                message: 'Username, e-mail, and phone number must be unique. A user already exists.',
                statusCode: 400,
            });
        }

        // TODO: Supply user agent to determine if web or mobile
        const codeDetails = generateCode({});

        return Store.verificationCodes.createCode(codeDetails)
            .then(() => hashPassword(req.body.password))
            .then((hash) => Store.users.createUser({
                email: req.body.email,
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                password: hash,
                phoneNumber: req.body.phoneNumber,
                userName: req.body.userName,
                verificationCodes: JSON.stringify([{ type: codeDetails.type, code: codeDetails.code }]),
            }))
            .then((results) => {
                const user = results[0];
                delete user.password;

                // return sendVerificationEmail(user)
                //     .then((emailResponse) => {
                //         // TODO: RAUTO-7: Validate response
                //         // Generate/store an email verification token
                //         console.log(emailResponse);
                //         return res.status(201).send(user);
                //     });
                return res.status(201).send(user);
            });
    })
    .catch((err) => handleHttpError({
        err,
        res,
        message: 'SQL:USER_ROUTES:ERROR',
    }));

// READ
const getUser = (req, res) => Store.users.getUsers({ id: req.params.id })
    .then((results) => {
        if (!results.length) {
            return handleHttpError({
                res,
                message: `No user found with id, ${req.params.id}.`,
                statusCode: 404,
            });
        }
        const user = results[0];
        delete user.password;
        return res.status(200).send(user);
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

const getUsers: RequestHandler = (req: any, res: any) => Store.users.getUsers()
    .then((results) => {
        res.status(200).send(results[0].map((user) => {
            delete user.password; // eslint-disable-line no-param-reassign
            return user;
        }));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

// UPDATE
const updateUser = (req, res) => Store.users.findUser({ id: req.params.id, ...req.body })
    .then((findResults) => {
        if (!findResults.length) {
            return handleHttpError({
                res,
                message: `No user found with id, ${req.params.id}.`,
                statusCode: 404,
            });
        }

        return Store.users
            .updateUser({
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                phoneNumber: req.body.phoneNumber,
                userName: req.body.userName,
            }, {
                id: req.params.id,
            })
            .then((results) => {
                const user = results[0];
                delete user.password;
                return res.status(200).send(user);
            });
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

// DELETE
const deleteUser = (req, res) => Store.users.deleteUsers({ id: req.params.id })
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
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

export {
    createUser,
    getUser,
    getUsers,
    updateUser,
    deleteUser,
};
