import express from 'express';
import normalizePhoneNumber from 'therr-js-utilities/normalize-phone-number';
import handleHttpError from '../../utilities/handleHttpError';
import { validate } from '../../validation';
import redisClient from '../../store/redisClient';
import twilioClient from '../../api/twilio';
import translate from '../../utilities/translator';

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
phoneRouter.post('/verify', validate, async (req, res) => {
    const userId = req.headers['x-userid'] || req['x-userid'];
    const userLocale = (req.headers['x-localecode'] || 'en-us') as string;

    try {
        const { phoneNumber } = req.body;
        const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
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
                    cacheKey,
                });
            }).catch((err: any) => handleHttpError({ err, res, message: 'SQL:PHONE_ROUTES:ERROR' }));
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PHONE_ROUTES:ERROR' });
    }
});

phoneRouter.post('/validate-code', validate, async (req, res) => {
    const userId = req.headers['x-userid'] || req['x-userid'];

    try {
        const { verificationCode } = req.body;
        const cacheKey = `phone-verification-codes:${userId}`;

        return redisClient.get(cacheKey)
            .then((cachedCode) => {
                if (cachedCode && cachedCode === verificationCode) {
                    // TODO: Make request to update user verification status
                    return redisClient.del(cacheKey);
                }
                return Promise.reject(new Error('Invalid verification code'));
            })
            // eslint-disable-next-line arrow-body-style
            .then(() => {
                return res.status(201).send();
            }).catch((err: any) => handleHttpError({ err, res, message: 'SQL:PHONE_ROUTES:ERROR' }));
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PHONE_ROUTES:ERROR' });
    }
});

export default phoneRouter;

// Examples
// curl -d '{"phoneNumber":"+13175448348"}' -H "Content-Type: application/json" -X POST http://localhost:7770/v1/phone/verify -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEwZmUwNDM3LTZmMGItNGI1Ni05YThmLTRlZjJkMjY4ZmUxYiIsInVzZXJOYW1lIjpudWxsLCJlbWFpbCI6InphbnNlbG1AdGhlcnIuY29tIiwicGhvbmVOdW1iZXIiOm51bGwsImlzQmxvY2tlZCI6ZmFsc2UsImlzU1NPIjp0cnVlLCJpYXQiOjE2NzMzNzYzMzIsImV4cCI6MTY3NDI0MDMzMn0.QIRJq0IkMYHLWhy6DPSY0YQGziBK7hUlK-2Dkqcd34c"
// curl -d '{"verificationCode":"482156"}' -H "Content-Type: application/json" -X POST http://localhost:7770/v1/phone/validate-code -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEwZmUwNDM3LTZmMGItNGI1Ni05YThmLTRlZjJkMjY4ZmUxYiIsInVzZXJOYW1lIjpudWxsLCJlbWFpbCI6InphbnNlbG1AdGhlcnIuY29tIiwicGhvbmVOdW1iZXIiOm51bGwsImlzQmxvY2tlZCI6ZmFsc2UsImlzU1NPIjp0cnVlLCJpYXQiOjE2NzMzNzYzMzIsImV4cCI6MTY3NDI0MDMzMn0.QIRJq0IkMYHLWhy6DPSY0YQGziBK7hUlK-2Dkqcd34c"
