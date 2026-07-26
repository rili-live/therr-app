import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import logSpan from 'therr-js-utilities/log-or-update-span';
import normalizePhoneNumber from 'therr-js-utilities/normalize-phone-number';
import {
    createPhoneVerificationToken,
    verifyPhoneVerificationToken,
    PHONE_VERIFICATION_TOKEN_TTL_SECONDS,
} from 'therr-js-utilities/phone-verification-token';
import {
    ErrorCodes,
    getAvailablePhoneAccountTypes,
    getMaxAccountsPerPhone,
} from 'therr-js-utilities/constants';
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
import canonicalizePhoneNumber, { ICanonicalPhoneNumber } from './canonicalizePhoneNumber';
import { chargeSmsSendBudget, generateVerificationCode } from './verificationCodes';
import * as globalConfig from '../../../../global-config';
import restRequest from '../../utilities/restRequest';
import { hostRegex } from '../../utilities/patterns';

const getTherrFromPhoneNumber = (receivingPhoneNumber: string) => {
    if (receivingPhoneNumber.startsWith('+44')) {
        return process.env.TWILIO_SENDER_PHONE_NUMBER_GB;
    }

    return process.env.TWILIO_SENDER_PHONE_NUMBER;
};

// Codes for the passwordless flows live 5 minutes and allow 5 wrong guesses. A 6-digit code
// has 900k possibilities, so 5 guesses inside a 5 minute window is not brute-forceable even
// before the per-IP rate limiters are considered.
const AUTH_CODE_EXPIRE_SECONDS = 60 * 5;
const AUTH_CODE_MAX_ATTEMPTS = 5;

type PhoneAuthPurpose = 'login' | 'register';

// Cache keys are always keyed on the E.164 form, never on what the caller typed: `+1 (317)
// 555-1234` and `3175551234` are the same handset and must charge the same budget, share the
// same code, and share the same attempt counter.
const authCodeKey = (purpose: PhoneAuthPurpose, e164: string) => `phone-${purpose}-codes:${e164}`;
const authAttemptsKey = (purpose: PhoneAuthPurpose, e164: string) => `phone-${purpose}-attempts:${e164}`;
const authSendsKey = (purpose: PhoneAuthPurpose, e164: string) => `phone-${purpose}-sends:${e164}`;

/** Charges one SMS against this number's hourly budget. See `./verificationCodes`. */
const chargeSmsSendBudgetFor = (purpose: PhoneAuthPurpose, e164: string) => chargeSmsSendBudget(
    redisClient,
    authSendsKey(purpose, e164),
);

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
 * Asks the users-service which accounts are attached to a phone number. Used by both
 * passwordless flows: sign-in only sends an SMS when an account exists, and sign-up refuses
 * to start when one already does.
 *
 * Takes pre-built headers rather than `req` because `/auth/start` calls this *after* it has
 * already answered the client, at which point reaching back into the request object would be
 * reading state whose lifetime is no longer guaranteed.
 */
const lookupAccountsByPhone = (headers: any, phoneNumber: string): Promise<{ accountCount: number, accounts: any[] }> => restRequest({
    headers,
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
    e164: string,
    submittedCode: string,
): Promise<boolean> => {
    const cachedCode = await redisClient.get(authCodeKey(purpose, e164));

    if (!cachedCode) {
        return false;
    }

    if (cachedCode !== submittedCode) {
        const attempts = await redisClient.incr(authAttemptsKey(purpose, e164));
        // Keep the attempt counter alive exactly as long as the code it guards.
        await redisClient.expire(authAttemptsKey(purpose, e164), AUTH_CODE_EXPIRE_SECONDS);
        if (attempts >= AUTH_CODE_MAX_ATTEMPTS) {
            // Burn the code so an attacker has to trigger a fresh SMS (and a fresh rate limit).
            await redisClient.del(authCodeKey(purpose, e164));
        }
        return false;
    }

    return true;
};

const clearSubmittedCode = (purpose: PhoneAuthPurpose, e164: string) => Promise.all([
    redisClient.del(authCodeKey(purpose, e164)),
    redisClient.del(authAttemptsKey(purpose, e164)),
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
 * Texts a sign-in code, if the number has earned one.
 *
 * Runs *after* `/auth/start` has already responded, so it reports nothing back to the caller
 * and must swallow every failure it can produce. That includes an unroutable region: on this
 * route an SMS is only ever attempted for a number that has an account, so answering "region
 * not enabled" would confirm the account's existence — the one thing this flow withholds.
 */
const dispatchLoginCode = async (headers: any, locale: string, phone: ICanonicalPhoneNumber) => {
    try {
        const { accountCount } = await lookupAccountsByPhone(headers, phone.canonical);

        if (!accountCount) {
            return;
        }

        if (!(await chargeSmsSendBudgetFor('login', phone.e164))) {
            return;
        }

        const verificationCode = generateVerificationCode();
        await redisClient.setex(authCodeKey('login', phone.e164), AUTH_CODE_EXPIRE_SECONDS, verificationCode);
        await redisClient.del(authAttemptsKey('login', phone.e164));
        await sendVerificationSms(locale, phone.e164, verificationCode);
    } catch (err: any) {
        // The caller is already gone, so logging is the only channel left. Without this a
        // misconfigured Twilio sender would look, from the outside, exactly like a user
        // mistyping their number.
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [err?.message, 'Failed to dispatch passwordless sign-in code'],
            traceArgs: {
                'phone.region': phone.e164.slice(0, 3),
                'process.id': process.pid,
            },
        });
    }
};

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
    const phone = canonicalizePhoneNumber(req.body?.phoneNumber);

    if (!phone) {
        return handleHttpError({
            res,
            message: 'Invalid phone number',
            statusCode: 400,
        });
    }

    // Snapshot the forwarding headers while the request is unambiguously in scope: the work
    // below outlives the response.
    const internalHeaders = buildInternalHeaders(req);

    // Answer first, unconditionally, and only then decide whether to send anything. Every
    // check that governs the decision — does this number have an account, has it had its
    // hourly allowance, will Twilio accept the region — costs a round trip, and running any
    // of them before responding makes the "account exists" case measurably slower than the
    // "no account" case. That latency difference hands back, to anyone with a stopwatch,
    // exactly the answer the uniform response body exists to withhold.
    res.status(200).send({
        status: 'sent',
        expiresInSeconds: AUTH_CODE_EXPIRE_SECONDS,
    });

    // `.catch` is belt-and-braces: `dispatchLoginCode` already swallows its own failures, but
    // it now runs detached from the request. Express 4 ignores a handler's return value, so
    // any rejection escaping it would be an unhandled rejection — which Node surfaces as an
    // uncaught exception, and this service's `uncaughtException` handler answers by exiting.
    // One SMS failing must never be able to take the gateway down.
    return dispatchLoginCode(internalHeaders, userLocale, phone).catch(() => undefined);
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
    const phone = canonicalizePhoneNumber(req.body?.phoneNumber);
    const submittedCode = `${req.body?.verificationCode || ''}`.trim();

    if (!phone) {
        return handleHttpError({
            res,
            message: 'Invalid phone number',
            statusCode: 400,
        });
    }

    try {
        const isValid = await isSubmittedCodeValid('login', phone.e164, submittedCode);

        if (!isValid) {
            return handleHttpError({
                res,
                message: 'Invalid verification code',
                statusCode: 400,
            });
        }

        const { accountCount, accounts } = await lookupAccountsByPhone(buildInternalHeaders(req), phone.canonical);

        // Code is correct — spend it either way. From here ownership is carried by the signed
        // token, so the account-picker round-trip doesn't need the SMS code again.
        await clearSubmittedCode('login', phone.e164);

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
                phoneNumber: phone.canonical,
                phoneVerificationToken: createPhoneVerificationToken(phone.canonical, 'login'),
                expiresInSeconds: PHONE_VERIFICATION_TOKEN_TTL_SECONDS,
            });
        }

        return completePhoneLogin(req, res, {
            phoneNumber: phone.canonical,
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
 * Texts a one-time code to a phone number that has room for another account. Unlike
 * `/auth/start` this one deliberately DOES report `USER_EXISTS`: a sign-up form that silently
 * did nothing for a number at its cap would be a dead end, and the client uses the error to
 * offer "sign in instead". The number is already known to whoever holds the handset, and the
 * same disclosure exists today on the authenticated `/phone/verify` route.
 *
 * "Has room" is per-brand: Therr allows a personal + creator + business account per number
 * (the same allowance `/auth/verify` and `getUserByPhoneNumber` already grant), Habits allows
 * exactly one. See `getMaxAccountsPerPhone`.
 */
phoneRouter.post('/register/start', phoneAuthStartLimiter, phoneAuthStartValidation, validate, async (req, res) => {
    const userLocale = (req.headers['x-localecode'] || 'en-us') as string;
    const phone = canonicalizePhoneNumber(req.body?.phoneNumber);

    if (!phone) {
        return handleHttpError({
            res,
            message: 'Invalid phone number',
            statusCode: 400,
        });
    }

    try {
        const { accounts } = await lookupAccountsByPhone(buildInternalHeaders(req), phone.canonical);
        const brandVariation = `${req.headers['x-brand-variation'] || ''}`;

        if (!getAvailablePhoneAccountTypes(accounts, brandVariation).length) {
            return handleHttpError({
                err: new Error('Phone number has reached its account limit'),
                errorCode: ErrorCodes.USER_EXISTS,
                res,
                message: getMaxAccountsPerPhone(brandVariation) > 1
                    ? 'This phone number already has the maximum number of accounts'
                    : 'An account already exists for this phone number',
                statusCode: 400,
            });
        }

        // Sign-up has no enumeration constraint to protect (it reports USER_EXISTS outright),
        // so unlike the sign-in flow this one can tell the caller it has hit the cap.
        if (!(await chargeSmsSendBudgetFor('register', phone.e164))) {
            return handleHttpError({
                res,
                message: 'Too many verification codes requested for this number. Please try again later.',
                statusCode: 429,
            });
        }

        const verificationCode = generateVerificationCode();
        await redisClient.setex(authCodeKey('register', phone.e164), AUTH_CODE_EXPIRE_SECONDS, verificationCode);
        await redisClient.del(authAttemptsKey('register', phone.e164));
        await sendVerificationSms(userLocale, phone.e164, verificationCode);

        return res.status(200).send({
            status: 'sent',
            phoneNumber: phone.canonical,
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
 *
 * Also reports which account types the number may still register. That is only meaningful once
 * the number already holds an account, and it is only disclosed *after* the code is verified —
 * before that point the caller has proven nothing about the handset.
 */
phoneRouter.post('/register/verify', phoneAuthVerifyLimiter, phoneAuthVerifyValidation, validate, async (req, res) => {
    const phone = canonicalizePhoneNumber(req.body?.phoneNumber);
    const submittedCode = `${req.body?.verificationCode || ''}`.trim();

    if (!phone) {
        return handleHttpError({
            res,
            message: 'Invalid phone number',
            statusCode: 400,
        });
    }

    try {
        const isValid = await isSubmittedCodeValid('register', phone.e164, submittedCode);

        if (!isValid) {
            return handleHttpError({
                res,
                message: 'Invalid verification code',
                statusCode: 400,
            });
        }

        await clearSubmittedCode('register', phone.e164);

        const { accountCount, accounts } = await lookupAccountsByPhone(buildInternalHeaders(req), phone.canonical);
        const brandVariation = `${req.headers['x-brand-variation'] || ''}`;

        return res.status(200).send({
            phoneNumber: phone.canonical,
            // The token carries the canonical form because `createUserHelper` writes it
            // straight into main.users.phoneNumber, and that column has to hold the same
            // dialect every phone lookup re-derives.
            phoneVerificationToken: createPhoneVerificationToken(phone.canonical, 'register'),
            expiresInSeconds: PHONE_VERIFICATION_TOKEN_TTL_SECONDS,
            existingAccountCount: accountCount,
            availableAccountTypes: getAvailablePhoneAccountTypes(accounts, brandVariation),
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PHONE_ROUTES:ERROR' });
    }
});

export default phoneRouter;
