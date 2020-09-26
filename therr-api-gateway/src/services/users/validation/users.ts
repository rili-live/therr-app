import {
    body,
    oneOf,
    param,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createUserValidation = [
    body('phoneNumber').exists().isMobilePhone('any'),
    body('email').exists().isString(),
    body('password').exists().isString().isLength({ min: 8 }),
    body('userName').exists().isString(),
];

export const changePasswordValidation = [
    body('oldPassword').exists().isString(),
    body('newPassword').exists().isString(),
];

export const forgotPasswordValidation = [
    body('email').exists().isString(),
];

export const verifyUserAccountValidation = [
    oneOf([
        body('type').exists().isString().equals('email'),
        body('type').exists().isString().equals('mobile'),
    ]),
    param('token').exists().isString(),
];

export const resendVerificationValidation = [
    oneOf([
        body('type').exists().isString().equals('email'),
        body('type').exists().isString().equals('mobile'),
    ]),
    body('email').exists().isString(),
];
