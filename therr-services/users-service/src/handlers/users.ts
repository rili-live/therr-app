import { RequestHandler } from 'express';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { hashPassword } from '../utilities/userHelpers';
import generateCode from '../utilities/generateCode';
import { sendVerificationEmail } from '../api/email';
import accessLevels from '../constants/accessLevels';

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
        const codeDetails = generateCode({ email: req.body.email, type: 'email' });
        const verificationCode = { type: codeDetails.type, code: codeDetails.code };

        return Store.verificationCodes.createCode(verificationCode)
            .then(() => hashPassword(req.body.password))
            .then((hash) => Store.users.createUser({
                email: req.body.email,
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                password: hash,
                phoneNumber: req.body.phoneNumber,
                userName: req.body.userName,
                verificationCodes: JSON.stringify({
                    [codeDetails.type]: {
                        code: codeDetails.code,
                    },
                }),
            }))
            .then((results) => {
                const user = results[0];
                delete user.password;

                return sendVerificationEmail({
                    subject: '[Account Verification] Therr User Account',
                    toAddresses: [req.body.email],
                }, {
                    name: `${req.body.firstName} ${req.body.lastName}`,
                    userName: req.body.userName,
                    verificationCodeToken: codeDetails.token,
                })
                    .then(() => res.status(201).send(user))
                    .catch((error) => {
                        // Delete user to allow re-registration
                        Store.users.deleteUsers({ id: user.id });
                        throw error;
                    });
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

// TODO: RSERV-47 - decode jwt, then check for user and verification code match
// Send an e-mail if verification passes
const verifyUserAccount = (req, res) => {
    const {
        token,
    } = req.params;

    let decodedToken;

    try {
        decodedToken = token && Buffer.from(token, 'base64').toString('ascii');
        decodedToken = JSON.parse(decodedToken);
    } catch (e) {
        return handleHttpError({ err: e, res, message: 'SQL:USER_ROUTES:ERROR' });
    }

    return Store.users.getUsers({ email: decodedToken.email })
        .then((userDetails) => {
            if (!userDetails.length) {
                return handleHttpError({
                    res,
                    message: `No user found with email ${decodedToken.email}.`,
                    statusCode: 404,
                });
            }
            const userVerificationCodes = userDetails[0].verificationCodes;
            Store.verificationCodes.getCode({
                code: decodedToken.code,
                type: req.body.type,
            })
                .then((codeResults) => {
                    if (!codeResults.length) {
                        return handleHttpError({
                            res,
                            message: 'No verification code found',
                            statusCode: 404,
                        });
                    }

                    const isExpired = codeResults[0].msExpiresAt <= Date.now();

                    if (isExpired) {
                        return handleHttpError({
                            res,
                            message: 'Token has expired',
                            statusCode: 400,
                        });
                    }

                    const userHasMatchingCode = userVerificationCodes[codeResults[0].type]
                        && userVerificationCodes[codeResults[0].type].code
                        && userVerificationCodes[codeResults[0].type].code === codeResults[0].code;

                    if (userHasMatchingCode) {
                        userVerificationCodes[codeResults[0].type] = {}; // clear out used code

                        Store.users.updateUser({
                            accessLevels: JSON.stringify([...userDetails[0].accessLevels, accessLevels.EMAIL_VERIFIED]),
                            verificationCodes: JSON.stringify(userVerificationCodes),
                        }, {
                            email: decodedToken.email,
                        });

                        // Set expire rather than delete (gives a window for user to see if already verified)
                        Store.verificationCodes.updateCode({ msExpiresAt: Date.now() }, { id: codeResults[0].id });

                        return res.status(200).send({
                            message: 'Account successfully verified',
                        });
                    }

                    return handleHttpError({
                        res,
                        message: 'Invalid token',
                        statusCode: 400,
                    });
                })
                .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));
        });
};

const resendVerification: RequestHandler = (req: any, res: any) => {
    // TODO: Supply user agent to determine if web or mobile
    const codeDetails = generateCode({ email: req.body.email, type: req.body.type });
    const verificationCode = { type: codeDetails.type, code: codeDetails.code };
    let userVerificationCodes;

    Store.users.getUsers({
        email: req.body.email,
    })
        .then((users) => {
            if (!users.length) {
                return handleHttpError({
                    res,
                    message: 'User not found',
                    statusCode: 404,
                });
            }

            if (users[0].accessLevels.includes(accessLevels.EMAIL_VERIFIED)) {
                return handleHttpError({
                    res,
                    message: 'Email already verified',
                    statusCode: 400,
                });
            }

            userVerificationCodes = users[0].verificationCodes;
            userVerificationCodes[codeDetails.type] = {
                code: codeDetails.code,
            };

            return Store.verificationCodes.createCode(verificationCode)
                .then(() => Store.users.updateUser({
                    verificationCodes: JSON.stringify(userVerificationCodes),
                }, {
                    email: req.body.email,
                }))
                .then((results) => {
                    const user = results[0];
                    delete user.password;

                    return sendVerificationEmail({
                        subject: '[Account Verification] Therr User Account',
                        toAddresses: [req.body.email],
                    }, {
                        name: `${users[0].firstName} ${users[0].lastName}`,
                        userName: users[0].userName,
                        verificationCodeToken: codeDetails.token,
                    })
                        .then(() => res.status(200).send({ message: 'New verification E-mail sent' }))
                        .catch((error) => {
                            // Delete user to allow re-registration
                            Store.users.deleteUsers({ id: user.id });
                            throw error;
                        });
                })
                .catch((err) => handleHttpError({
                    err,
                    res,
                    message: 'SQL:USER_ROUTES:ERROR',
                }));
        });
};

export {
    createUser,
    getUser,
    getUsers,
    updateUser,
    deleteUser,
    verifyUserAccount,
    resendVerification,
};
