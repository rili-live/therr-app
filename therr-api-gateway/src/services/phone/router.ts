import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import normalizePhoneNumber from 'therr-js-utilities/normalize-phone-number';
import {
    createPhoneVerificationToken,
    verifyPhoneVerificationToken,
    PHONE_VERIFICATION_TOKEN_TTL_SECONDS,
} from 'therr-js-utilities/phone-verification-token';
import { ErrorCodes } from 'therr-js-utilities/constants';
import handleHttpError from '../../utilities/handleHttpError';
import { validate } from '../../validation';
import redisClient, { storeRefreshToken } from '../../store/redisClient';
import twilioClient from '../../api/twilio';
import translate from '../../utilities/translator';
import {
    verifyPhoneLimiter,
    verifyPhoneLongLimiter,
    phoneAuthStartLimiter,
    phoneAuthVerifyLimiter,
} from './limitation/phone';
import {
    phoneAuthStartValidation,
    phoneAuthVerifyValidation,
    phoneAuthSelectValidation,
} from './validation/phone';
import resolvePhoneLoginError from './resolvePhoneLoginError';
import * as globalConfig from '../../../../global-config';
import restRequest from '../../utilities/restRequest';
import { hostRegex } from '../../utilities/patterns';

const getTherrFromPhoneNumber = (receivingPhoneNumber: string) => {
    if (receivingPhoneNumber.startsWith('+44')) {
        return process.env.TWILIO_SENDER_PHONE_NUMBER_GB;
    }

    return process.env.TWILIO_SENDER_PHONE_NUMBER;
};

const generateVerificationCode = () => {
    const minm = 100000;
    const maxm = 999999;
    return Math.floor(Math
        .random() * (maxm - minm + 1)) + minm;
};

// Codes for the passwordless flows live 5 minutes and allow 5 wrong guesses. A 6-digit code
// has 900k possibilities, so 5 guesses inside a 5 minute window is not brute-forceable even
// before the per-IP rate limiters are considered.
const AUTH_CODE_EXPIRE_SECONDS = 60 * 5;
const AUTH_CODE_MAX_ATTEMPTS = 5;

type PhoneAuthPurpose = 'login' | 'register';

const authCodeKey = (purpose: PhoneAuthPurpose, phoneNumber: string) => `phone-${purpose}-codes:${phoneNumber}`;
const authAttemptsKey = (purpose: PhoneAuthPurpose, phoneNumber: string) => `phone-${purpose}-attempts:${phoneNumber}`;

/**
 * Internal headers forwarded on every gateway -> users-service hop. The `x-userid` /
 * `x-username` / access-level headers are tacked on by the JWT decode in `authenticate`;
 * on the public passwordless routes below they are simply absent.
 */
const buildInternalHeaders = (req: any) => ({
    authorization: req.headers.authorization || '',
    'x-requestid': uuidv4(),
    'x-localecode': req.headers['x-localecode'] || '',
    'x-platform': req.headers['x-platform'] || '',
    'x-brand-variation': req.headers['x-brand-variation'] || '',
    'x-user-device-token': req.headers['x-user-device-token'] || '',
    // (securely) Tacked on from JWT decode
    'x-userid': req.headers['x-userid'] || req['x-userid'] || '',
    'x-username': req.headers['x-username'] || req['x-username'] || '',
    'x-user-access-levels': req.headers['x-user-access-levels'] || req['x-user-access-levels'] || '',
    'x-organizations': req.headers['x-organizations'] || req['x-organizations'] || '',
    'x-therr-origin-host': req.headers.origin?.match(hostRegex)?.[1] || '',
});

const sendVerificationSms = (locale: string, toPhoneNumber: string, verificationCode: number) => twilioClient.messages
    .create({
        body: translate(locale, 'sms.yourVerificationCode', {
            code: verificationCode,
        }),
        to: toPhoneNumber, // Text this number
        from: getTherrFromPhoneNumber(toPhoneNumber), // From a valid Twilio number
    });

/**
 * Normalizes and sanity-checks a submitted phone number. `normalizePhoneNumber` returns its
 * input unchanged when it cannot parse it, so a result that still isn't E.164 means invalid.
 */
const toE164 = (rawPhoneNumber: any): string | undefined => {
    const normalized = normalizePhoneNumber(`${rawPhoneNumber || ''}`.trim().replace(/\s/g, ''));

    // E.164 caps the whole number at 15 digits, so it is 1 leading digit + 6..14 more.
    return /^\+[1-9]\d{6,14}$/.test(normalized) ? normalized : undefined;
};

/**
 * Asks the users-service which accounts are attached to a phone number. Used by both
 * passwordless flows: sign-in only sends an SMS when an account exists, and sign-up refuses
 * to start when one already does.
 */
const lookupAccountsByPhone = (req: any, phoneNumber: string): Promise<{ accountCount: number, accounts: any[] }> => restRequest({
    headers: buildInternalHeaders(req),
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/auth/phone/lookup`,
    data: { phoneNumber },
}).then((response: any) => ({
    accountCount: response?.data?.accountCount || 0,
    accounts: response?.data?.accounts || [],
}));

/**
 * Best-effort refresh token registration, mirroring what `POST /users-service/auth` does on
 * a password login. A failure here must never block a successful sign-in.
 */
const trackRefreshToken = (responseData: any) => {
    try {
        if (responseData?.refreshToken) {
            const decoded = jwt.decode(responseData.refreshToken) as { jti?: string; id?: string; exp?: number; brand?: string } | null;
            if (decoded?.jti && decoded?.id && decoded?.exp) {
                const ttl = decoded.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0) {
                    storeRefreshToken(decoded.id, decoded.jti, ttl, decoded.brand);
                }
            }
        }
    } catch (err) {
        // Non-critical: don't block login
    }
};

/**
 * Validates a submitted code against the cached one, counting failures so a code cannot be
 * guessed by repeatedly posting. Resolves `true` only on an exact match; the caller is
 * responsible for clearing the cache entry once the code has been spent.
 */
const isSubmittedCodeValid = async (
    purpose: PhoneAuthPurpose,
    phoneNumber: string,
    submittedCode: string,
): Promise<boolean> => {
    const cachedCode = await redisClient.get(authCodeKey(purpose, phoneNumber));

    if (!cachedCode) {
        return false;
    }

    if (cachedCode !== submittedCode) {
        const attempts = await redisClient.incr(authAttemptsKey(purpose, phoneNumber));
        // Keep the attempt counter alive exactly as long as the code it guards.
        await redisClient.expire(authAttemptsKey(purpose, phoneNumber), AUTH_CODE_EXPIRE_SECONDS);
        if (attempts >= AUTH_CODE_MAX_ATTEMPTS) {
            // Burn the code so an attacker has to trigger a fresh SMS (and a fresh rate limit).
            await redisClient.del(authCodeKey(purpose, phoneNumber));
        }
        return false;
    }

    return true;
};

const clearSubmittedCode = (purpose: PhoneAuthPurpose, phoneNumber: string) => Promise.all([
    redisClient.del(authCodeKey(purpose, phoneNumber)),
    redisClient.del(authAttemptsKey(purpose, phoneNumber)),
]);

const phoneRouter = express.Router();

/**
 * Creates a verification code and sends it to the user provided phone number
 *
 * NOTE: This is the *authenticated* variant, used when an already signed-in user adds or
 * changes the phone number on their profile. The passwordless sign-in/sign-up routes further
 * down are unauthenticated and key their codes on the phone number rather than the user id.
 */
phoneRouter.post('/verify', verifyPhoneLimiter, validate, async (req, res) => {
    const userId = req.headers['x-userid'] || req['x-userid'];
    const userLocale = (req.headers['x-localecode'] || 'en-us') as string;

    try {
        const { phoneNumber } = req.body;
        const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

        const isNumberValid: boolean = await new Promise((resolve) => {
            const config: any = {
                headers: buildInternalHeaders(req),
                method: 'get',
                url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/by-phone/${normalizedPhoneNumber}`,
            };

            restRequest(config)
                .then(() => resolve(true))
                .catch((error) => {
                    // Phone number is already in use, so we cannot allow this user to use it
                    // NOTE: Users are allowed one personal account, one creator account, and one business account per phone number
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
            .then(() => sendVerificationSms(userLocale, normalizedPhoneNumber, verificationCode))
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
                        headers: buildInternalHeaders(req),
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

/**
 * PASSWORDLESS SIGN-IN — step 1.
 *
 * Texts a one-time code to a phone number that already has an account.
 *
 * Enumeration-safe by design: the response is identical whether or not an account exists,
 * for the same reason `POST /auth/email-precheck` returns a single neutral hint. An SMS is
 * only dispatched when the number resolves to at least one account, so we neither confirm
 * existence to the caller nor burn Twilio credit on unknown numbers.
 */
phoneRouter.post('/auth/start', phoneAuthStartLimiter, phoneAuthStartValidation, validate, async (req, res) => {
    const userLocale = (req.headers['x-localecode'] || 'en-us') as string;
    const normalizedPhoneNumber = toE164(req.body?.phoneNumber);

    if (!normalizedPhoneNumber) {
        return handleHttpError({
            res,
            message: 'Invalid phone number',
            statusCode: 400,
        });
    }

    // Uniform response, declared once so every exit path below is provably identical.
    const neutralResponse = () => res.status(200).send({
        status: 'sent',
        expiresInSeconds: AUTH_CODE_EXPIRE_SECONDS,
    });

    try {
        const { accountCount } = await lookupAccountsByPhone(req, normalizedPhoneNumber);

        if (!accountCount) {
            return neutralResponse();
        }

        const verificationCode = generateVerificationCode();
        await redisClient.setex(authCodeKey('login', normalizedPhoneNumber), AUTH_CODE_EXPIRE_SECONDS, verificationCode);
        await redisClient.del(authAttemptsKey('login', normalizedPhoneNumber));
        await sendVerificationSms(userLocale, normalizedPhoneNumber, verificationCode);

        return neutralResponse();
    } catch (err: any) {
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
    }
});

/**
 * Exchanges proof of phone ownership for a session. Shared by `/auth/verify` (proof = a
 * correct SMS code) and `/auth/select` (proof = the short-lived token minted by
 * `/auth/verify` when the number matched more than one account).
 */
const completePhoneLogin = (req: any, res: any, args: {
    phoneNumber: string;
    userId?: string;
    rememberMe?: boolean;
}) => restRequest({
    headers: buildInternalHeaders(req),
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/auth/phone`,
    data: {
        phoneNumber: args.phoneNumber,
        userId: args.userId,
        rememberMe: args.rememberMe,
    },
}).then((response: any) => {
    trackRefreshToken(response?.data);

    return res.status(201).send(response?.data);
}).catch((err: any) => handleHttpError({ res, ...resolvePhoneLoginError(err) }));

/**
 * PASSWORDLESS SIGN-IN — step 2.
 *
 * Validates the texted code and signs the user in. When the number is attached to more than
 * one account (Therr permits a personal + creator + business account per number) we cannot
 * pick for them, so we return the candidate list plus a short-lived proof token and let the
 * client render an account picker, which posts back to `/auth/select`.
 */
phoneRouter.post('/auth/verify', phoneAuthVerifyLimiter, phoneAuthVerifyValidation, validate, async (req, res) => {
    const normalizedPhoneNumber = toE164(req.body?.phoneNumber);
    const submittedCode = `${req.body?.verificationCode || ''}`.trim();

    if (!normalizedPhoneNumber) {
        return handleHttpError({
            res,
            message: 'Invalid phone number',
            statusCode: 400,
        });
    }

    try {
        const isValid = await isSubmittedCodeValid('login', normalizedPhoneNumber, submittedCode);

        if (!isValid) {
            return handleHttpError({
                res,
                message: 'Invalid verification code',
                statusCode: 400,
            });
        }

        const { accountCount, accounts } = await lookupAccountsByPhone(req, normalizedPhoneNumber);

        // Code is correct — spend it either way. From here ownership is carried by the signed
        // token, so the account-picker round-trip doesn't need the SMS code again.
        await clearSubmittedCode('login', normalizedPhoneNumber);

        if (!accountCount) {
            return handleHttpError({
                res,
                message: 'No account found for this phone number',
                statusCode: 404,
            });
        }

        if (accountCount > 1) {
            return res.status(200).send({
                requiresAccountSelection: true,
                accounts,
                phoneNumber: normalizedPhoneNumber,
                phoneVerificationToken: createPhoneVerificationToken(normalizedPhoneNumber, 'login'),
                expiresInSeconds: PHONE_VERIFICATION_TOKEN_TTL_SECONDS,
            });
        }

        return completePhoneLogin(req, res, {
            phoneNumber: normalizedPhoneNumber,
            userId: accounts[0]?.id,
            rememberMe: req.body?.rememberMe,
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PHONE_ROUTES:ERROR' });
    }
});

/**
 * PASSWORDLESS SIGN-IN — step 2b (multi-account numbers only).
 *
 * Completes sign-in for the account the user picked. Authorization comes entirely from the
 * `phoneVerificationToken` minted by `/auth/verify`; the requested account must actually be
 * attached to the phone number in that token, which the users-service re-checks.
 */
phoneRouter.post('/auth/select', phoneAuthVerifyLimiter, phoneAuthSelectValidation, validate, async (req, res) => {
    const claims = verifyPhoneVerificationToken(req.body?.phoneVerificationToken, 'login');

    if (!claims) {
        return handleHttpError({
            res,
            message: 'Invalid or expired verification token',
            statusCode: 401,
        });
    }

    return completePhoneLogin(req, res, {
        phoneNumber: claims.phoneNumber,
        userId: req.body?.userId,
        rememberMe: req.body?.rememberMe,
    });
});

/**
 * PASSWORDLESS SIGN-UP — step 1.
 *
 * Texts a one-time code to a phone number that has no account yet. Unlike `/auth/start` this
 * one deliberately DOES report `USER_EXISTS`: a sign-up form that silently did nothing for an
 * already-registered number would be a dead end, and the client uses the error to offer
 * "sign in instead". The number is already known to whoever holds the handset, and the same
 * disclosure exists today on the authenticated `/phone/verify` route.
 */
phoneRouter.post('/register/start', phoneAuthStartLimiter, phoneAuthStartValidation, validate, async (req, res) => {
    const userLocale = (req.headers['x-localecode'] || 'en-us') as string;
    const normalizedPhoneNumber = toE164(req.body?.phoneNumber);

    if (!normalizedPhoneNumber) {
        return handleHttpError({
            res,
            message: 'Invalid phone number',
            statusCode: 400,
        });
    }

    try {
        const { accountCount } = await lookupAccountsByPhone(req, normalizedPhoneNumber);

        if (accountCount) {
            return handleHttpError({
                err: new Error('Phone number already exists'),
                errorCode: ErrorCodes.USER_EXISTS,
                res,
                message: 'An account already exists for this phone number',
                statusCode: 400,
            });
        }

        const verificationCode = generateVerificationCode();
        await redisClient.setex(authCodeKey('register', normalizedPhoneNumber), AUTH_CODE_EXPIRE_SECONDS, verificationCode);
        await redisClient.del(authAttemptsKey('register', normalizedPhoneNumber));
        await sendVerificationSms(userLocale, normalizedPhoneNumber, verificationCode);

        return res.status(200).send({
            status: 'sent',
            phoneNumber: normalizedPhoneNumber,
            expiresInSeconds: AUTH_CODE_EXPIRE_SECONDS,
        });
    } catch (err: any) {
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
    }
});

/**
 * PASSWORDLESS SIGN-UP — step 2.
 *
 * Validates the texted code and hands back a short-lived, signed proof of phone ownership.
 * The client passes it to `POST /users-service/users` alongside the email it collects next;
 * the users-service verifies the signature and creates the account already MOBILE_VERIFIED.
 */
phoneRouter.post('/register/verify', phoneAuthVerifyLimiter, phoneAuthVerifyValidation, validate, async (req, res) => {
    const normalizedPhoneNumber = toE164(req.body?.phoneNumber);
    const submittedCode = `${req.body?.verificationCode || ''}`.trim();

    if (!normalizedPhoneNumber) {
        return handleHttpError({
            res,
            message: 'Invalid phone number',
            statusCode: 400,
        });
    }

    try {
        const isValid = await isSubmittedCodeValid('register', normalizedPhoneNumber, submittedCode);

        if (!isValid) {
            return handleHttpError({
                res,
                message: 'Invalid verification code',
                statusCode: 400,
            });
        }

        await clearSubmittedCode('register', normalizedPhoneNumber);

        return res.status(200).send({
            phoneNumber: normalizedPhoneNumber,
            phoneVerificationToken: createPhoneVerificationToken(normalizedPhoneNumber, 'register'),
            expiresInSeconds: PHONE_VERIFICATION_TOKEN_TTL_SECONDS,
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PHONE_ROUTES:ERROR' });
    }
});

export default phoneRouter;
