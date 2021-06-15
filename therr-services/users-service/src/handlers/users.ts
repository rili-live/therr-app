import { RequestHandler } from 'express';
import { AccessLevels, ErrorCodes } from 'therr-js-utilities/constants';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { hashPassword } from '../utilities/userHelpers';
import generateCode from '../utilities/generateCode';
import { sendVerificationEmail } from '../api/email';
import generateOneTimePassword from '../utilities/generateOneTimePassword';
import translate from '../utilities/translator';
import { updatePassword } from '../utilities/passwordUtils';
import sendOneTimePasswordEmail from '../api/email/sendOneTimePasswordEmail';
import sendSSONewUserEmail from '../api/email/sendSSONewUserEmail';

export const createUserHelper = (userDetails, isSSO) => {
    // TODO: Supply user agent to determine if web or mobile
    const codeDetails = generateCode({ email: userDetails.email, type: 'email' });
    const verificationCode = { type: codeDetails.type, code: codeDetails.code };
    let password = userDetails.password;
    let user;

    if (isSSO) { // SSO first time login
        password = generateOneTimePassword(8); // Create a different/random permanent password as a placeholder
    }

    return Store.verificationCodes.createCode(verificationCode)
        .then(() => hashPassword(password))
        .then((hash) => {
            const isMissingUserProps = isSSO || !userDetails.phoneNumber || !userDetails.userName || !userDetails.firstName || !userDetails.lastName;
            const userAccessLevels = [
                AccessLevels.DEFAULT,
                (isMissingUserProps ? AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES : AccessLevels.EMAIL_VERIFIED),
            ];
            return Store.users.createUser({
                accessLevels: JSON.stringify(userAccessLevels),
                email: userDetails.email,
                firstName: userDetails.firstName,
                lastName: userDetails.lastName,
                password: hash,
                phoneNumber: userDetails.phoneNumber || undefined,
                userName: userDetails.userName || undefined,
                verificationCodes: JSON.stringify({
                    [codeDetails.type]: {
                        code: codeDetails.code,
                    },
                }),
            });
        })
        // TODO: RSERV-53 - Create userResource with default values (from library constant DefaultUserResources)
        .then((results) => {
            user = results[0];
            delete user.password;

            if (isSSO) {
                // TODO: RMOBILE-26: Centralize password requirements
                const msExpiresAt = Date.now() + (1000 * 60 * 60 * 6); // 6 hours
                const otPassword = generateOneTimePassword(8);

                return hashPassword(otPassword)
                    .then((hash) => Store.users.updateUser({
                        oneTimePassword: `${hash}:${msExpiresAt}`,
                    }, {
                        email: userDetails.email,
                    }))
                    // SSO USER AUTO-REGISTRATION ON FIRST LOGIN
                    .then(() => sendSSONewUserEmail({
                        subject: '[Account Created] Therr One-Time Password',
                        toAddresses: [userDetails.email],
                    }, {
                        oneTimePassword: otPassword,
                    }))
                    .then(() => user);
            }

            // STANDARD USER REGISTRATION
            return sendVerificationEmail({
                subject: '[Account Verification] Therr User Account',
                toAddresses: [userDetails.email],
            }, {
                name: `${userDetails.firstName} ${userDetails.lastName}`,
                userName: userDetails.userName,
                verificationCodeToken: codeDetails.token,
            }).then(() => user);
        })
        .catch((error) => {
            // Delete user to allow re-registration
            if (user) {
                Store.users.deleteUsers({ id: user.id });
            }
            throw error;
        });
};

// CREATE
const createUser: RequestHandler = (req: any, res: any) => Store.users.findUser(req.body)
    .then((findResults) => {
        if (findResults.length) {
            return handleHttpError({
                res,
                message: 'Username, e-mail, and phone number must be unique. A user already exists.',
                statusCode: 400,
                errorCode: ErrorCodes.USER_EXISTS,
            });
        }

        return createUserHelper(req.body, false).then((user) => res.status(201).send(user));
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
        const locale = req.headers['x-localecode'] || 'en-us';
        const userId = req.headers['x-userid'];
        const {
            email,
            password,
            oldPassword,
            userName,
        } = req.body;

        if (!findResults.length) {
            return handleHttpError({
                res,
                message: `No user found with id, ${req.params.id}.`,
                statusCode: 404,
            });
        }

        // TODO: If password, validate and update password
        let passwordPromise: Promise<any> = Promise.resolve();

        if (password && oldPassword) {
            passwordPromise = updatePassword({
                hashedPassword: findResults[0].password,
                inputPassword: oldPassword,
                locale,
                oneTimePassword: findResults[0].oneTimePassword,
                res,
                emailArgs: {
                    email,
                    userName,
                },
                newPassword: password,
                userId,
            });
        }

        passwordPromise
            .then(() => Store.users
                .updateUser({
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    phoneNumber: req.body.phoneNumber,
                    userName: req.body.userName,
                    deviceMobileFirebaseToken: req.body.deviceMobileFirebaseToken,
                }, {
                    id: req.params.id,
                })
                .then((results) => {
                    const user = results[0];
                    delete user.password;
                    return res.status(202).send(user);
                }))
            .catch((e) => handleHttpError({
                res,
                message: translate(locale, 'User/password combination is incorrect'),
                statusCode: 400,
            }));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

// UPDATE PASSWORD
const updateUserPassword = (req, res) => Store.users.findUser({ id: req.headers['x-userid'] })
    .then((findResults) => {
        const locale = req.headers['x-localecode'] || 'en-us';
        const userId = req.headers['x-userid'];
        const {
            email,
            newPassword,
            userName,
        } = req.body;

        if (!findResults.length) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
            });
        }

        return updatePassword({
            hashedPassword: findResults[0].password,
            inputPassword: req.body.oldPassword,
            locale,
            oneTimePassword: findResults[0].oneTimePassword,
            res,
            emailArgs: {
                email,
                userName,
            },
            newPassword,
            userId,
        })
            .then(() => res.status(204).send())
            .catch(() => handleHttpError({
                res,
                message: translate(locale, 'User/password combination is incorrect'),
                statusCode: 400,
            }));
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

const createOneTimePassword = (req, res) => {
    const { email } = req.body;

    return Store.users.getUsers({ email })
        .then((userDetails) => {
            if (!userDetails.length) {
                return handleHttpError({
                    res,
                    message: 'User not found',
                    statusCode: 404,
                });
            }

            const msExpiresAt = Date.now() + (1000 * 60 * 60 * 6); // 6 hours
            const otPassword = generateOneTimePassword(8);

            return hashPassword(otPassword)
                .then((hash) => Store.users.updateUser({
                    oneTimePassword: `${hash}:${msExpiresAt}`,
                }, {
                    email,
                }))
                .then(() => sendOneTimePasswordEmail({
                    subject: '[Forgot Password?] Therr One-Time Password',
                    toAddresses: [email],
                }, {
                    oneTimePassword: otPassword,
                }))
                .then(() => res.status(200).send({ message: 'One time password created and sent' }))
                .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));
        });
};

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
            return Store.verificationCodes.getCode({
                code: decodedToken.code,
                type: req.body.type,
            })
                .then(async (codeResults) => {
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

                        await Store.users.updateUser({
                            accessLevels: JSON.stringify([...userDetails[0].accessLevels, AccessLevels.EMAIL_VERIFIED]),
                            verificationCodes: JSON.stringify(userVerificationCodes),
                        }, {
                            email: decodedToken.email,
                        });

                        // Set expire rather than delete (gives a window for user to see if already verified)
                        await Store.verificationCodes.updateCode({ msExpiresAt: Date.now() }, { id: codeResults[0].id });

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

            if (users[0].accessLevels.includes(AccessLevels.EMAIL_VERIFIED)) {
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
    updateUserPassword,
    deleteUser,
    createOneTimePassword,
    verifyUserAccount,
    resendVerification,
};
