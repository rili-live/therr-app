import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import normalizePhoneNumber from 'therr-js-utilities/normalize-phone-number';
import { ErrorCodes } from 'therr-js-utilities/constants';
import handleHttpError from '../../utilities/handleHttpError';
import { validate } from '../../validation';
import redisClient from '../../store/redisClient';
import twilioClient from '../../api/twilio';
import translate from '../../utilities/translator';
import { verifyPhoneLimiter, verifyPhoneLongLimiter } from './limitation/phone';
import * as globalConfig from '../../../../global-config';
import restRequest from '../../utilities/restRequest';

const generateVerificationCode = () => {
    const minm = 100000;
    const maxm = 999999;
    return Math.floor(Math
        .random() * (maxm - minm + 1)) + minm;
};

const phoneRouter = express.Router();

/**
 * Creates a verification code and sends it to the user provided phone number
 */
phoneRouter.post('/verify', verifyPhoneLimiter, validate, async (req, res) => {
    const userId = req.headers['x-userid'] || req['x-userid'];
    const userLocale = (req.headers['x-localecode'] || 'en-us') as string;

    try {
        const { phoneNumber } = req.body;
        const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

        const isNumberValid: boolean = await new Promise((resolve) => {
            const config: any = {
                headers: {
                    authorization: req.headers.authorization || '',
                    'x-requestid': uuidv4(),
                    'x-localecode': req.headers['x-localecode'] || '',
                    'x-platform': req.headers['x-platform'] || '',
                    'x-user-device-token': req.headers['x-user-device-token'] || '',
                    // (securely) Tacked on from JWT decode
                    'x-userid': req.headers['x-userid'] || req['x-userid'] || '',
                    'x-username': req.headers['x-username'] || req['x-username'] || '',
                    'x-user-access-levels': req.headers['x-user-access-levels'] || req['x-user-access-levels'] || '',
                },
                method: 'get',
                url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/by-phone/${normalizedPhoneNumber}`,
            };

            restRequest(config)
                .then(() => resolve(true))
                .catch((error) => {
                    // Phone number not yet in use, so we can allow this user to use it
                    // NOTE: Users are allowed one personal account and one business account
                    if (error?.response?.data?.statusCode === 400 && error?.response?.data?.errorCode === ErrorCodes.TOO_MANY_ACCOUNTS) {
                        return resolve(false);
                    }

                    return resolve(true);
                });
        });

        if (!isNumberValid) {
            return handleHttpError({
                err: new Error('Phone number already exists'),
                errorCode: ErrorCodes.USER_EXISTS,
                res,
                message: 'SQL:PHONE_ROUTES:ERROR',
                statusCode: 400,
            });
        }

        const verificationCode = generateVerificationCode();
        const codeCacheKey = `phone-verification-codes:${userId}`;
        const phoneCacheKey = `phone-verification-phone-number:${userId}`;
        const expireSeconds = 60 * 5;

        // TODO: User Redis Pipeline
        return Promise.all([
            redisClient.setex(codeCacheKey, expireSeconds, verificationCode),
            redisClient.setex(phoneCacheKey, expireSeconds, normalizedPhoneNumber),
        ])
            .then(() => twilioClient.messages
                .create({
                    body: translate(userLocale, 'sms.yourVerificationCode', {
                        code: verificationCode,
                    }),
                    to: normalizedPhoneNumber, // Text this number
                    from: process.env.TWILIO_SENDER_PHONE_NUMBER, // From a valid Twilio number
                }))
            // eslint-disable-next-line arrow-body-style
            .then(() => {
                return res.status(200).send({
                    phoneNumber: normalizedPhoneNumber,
                });
            }).catch((err: any) => {
                if (err?.message?.includes('SMS has not been enabled for the region')) {
                    return handleHttpError({
                        err,
                        errorCode: ErrorCodes.INVALID_REGION,
                        res,
                        message: 'Region not enabled for phone number',
                        statusCode: 405,
                    });
                }
                return handleHttpError({ err, res, message: 'SQL:PHONE_ROUTES:ERROR' });
            });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PHONE_ROUTES:ERROR' });
    }
});

phoneRouter.post('/validate-code', verifyPhoneLongLimiter, validate, async (req, res) => {
    const userId = req.headers['x-userid'] || req['x-userid'];

    try {
        const { verificationCode } = req.body;
        const codeCacheKey = `phone-verification-codes:${userId}`;
        const phoneCacheKey = `phone-verification-phone-number:${userId}`;

        // TODO: User Redis Pipeline
        return Promise.all([
            redisClient.get(codeCacheKey),
            redisClient.get(phoneCacheKey),
        ])
            .then(([cachedCode, normalizedPhoneNumber]) => {
                if (cachedCode && cachedCode === verificationCode) {
                    redisClient.del(codeCacheKey);
                    const config: any = {
                        headers: {
                            authorization: req.headers.authorization || '',
                            'x-requestid': uuidv4(),
                            'x-localecode': req.headers['x-localecode'] || '',
                            'x-platform': req.headers['x-platform'] || '',
                            'x-user-device-token': req.headers['x-user-device-token'] || '',
                            // (securely) Tacked on from JWT decode
                            'x-userid': req.headers['x-userid'] || req['x-userid'] || '',
                            'x-username': req.headers['x-username'] || req['x-username'] || '',
                            'x-user-access-levels': req.headers['x-user-access-levels'] || req['x-user-access-levels'] || '',
                        },
                        method: 'put',
                        url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/${userId}/verify-phone`,
                        data: {
                            phoneNumber: normalizedPhoneNumber,
                        },
                    };

                    return restRequest(config);
                }
                return Promise.reject(new Error('Invalid verification code'));
            })
            // eslint-disable-next-line arrow-body-style
            .then(() => {
                return res.status(201).send();
            }).catch((err: any) => {
                if (err.message === 'Invalid verification code') {
                    return handleHttpError({
                        res,
                        err,
                        message: err.message,
                        statusCode: 400,
                    });
                }

                return handleHttpError({ err, res, message: 'SQL:PHONE_ROUTES:ERROR' });
            });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PHONE_ROUTES:ERROR' });
    }
});

export default phoneRouter;
