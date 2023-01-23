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

        const numberExists: boolean = await new Promise((resolve) => {
            const config: any = {
                headers: {
                    authorization: req.headers.authorization || '',
                    'x-requestid': uuidv4(),
                    'x-localecode': req.headers['x-localecode'] || '',
                    'x-userid': req.headers['x-userid'] || req['x-userid'] || '',
                    'x-user-device-token': req.headers['x-user-device-token'] || '',
                },
                method: 'get',
                url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/by-phone/${normalizedPhoneNumber}`,
            };

            restRequest(config)
                .then(() => resolve(true))
                .catch((error) => {
                    // Phone number not yet in use, so we can allow this user to use it
                    if (error?.response?.data?.statusCode === 404) {
                        return resolve(false);
                    }

                    return resolve(true);
                });
        });

        if (numberExists) {
            return handleHttpError({
                err: new Error('Phone number already exists'),
                errorCode: ErrorCodes.USER_EXISTS,
                res,
                message: 'SQL:PHONE_ROUTES:ERROR',
                statusCode: 400,
            });
        }

        const verificationCode = generateVerificationCode();
        const cacheKey = `phone-verification-codes:${userId}`;
        const expireSeconds = 60 * 5;

        return redisClient.setex(cacheKey, expireSeconds, verificationCode)
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
            }).catch((err: any) => handleHttpError({ err, res, message: 'SQL:PHONE_ROUTES:ERROR' }));
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PHONE_ROUTES:ERROR' });
    }
});

phoneRouter.post('/validate-code', verifyPhoneLongLimiter, validate, async (req, res) => {
    const userId = req.headers['x-userid'] || req['x-userid'];

    try {
        const { verificationCode } = req.body;
        const cacheKey = `phone-verification-codes:${userId}`;

        return redisClient.get(cacheKey)
            .then((cachedCode) => {
                if (cachedCode && cachedCode === verificationCode) {
                    // TODO: Make request to update user verification status
                    // The web app currently does not require verification for signup,
                    // and we may have older users who are unverified
                    return redisClient.del(cacheKey);
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
