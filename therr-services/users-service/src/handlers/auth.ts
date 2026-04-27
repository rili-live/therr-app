import { randomBytes } from 'crypto';
import { RequestHandler } from 'express';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
    AccessLevels, BrandVariations, CurrentSocialValuations, OAuthIntegrationProviders,
} from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import normalizePhoneNumber from 'therr-js-utilities/normalize-phone-number';
import { parseHeaders } from 'therr-js-utilities/http';
import normalizeEmail from 'normalize-email';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { createUserToken, createRefreshToken } from '../utilities/userHelpers';
import translate from '../utilities/translator';
import { redactUserCreds, validateCredentials } from './helpers/user';
import TherrEventEmitter from '../api/TherrEventEmitter';
import decryptIntegrationsAccess from '../utilities/decryptIntegrationsAccess';
import {
    mintHandoffCode,
    redeemHandoffCode,
    cancelHandoffCode,
} from '../store/redisClient';

// Multi-app brand check. Used to gate writes to user.brandVariations on login (so a malicious
// x-brand-variation header can't pollute the JSONB array) and to validate handoff endpoints'
// targetBrand / requestedBrand inputs.
const isKnownBrand = (brand: any): boolean => typeof brand === 'string'
    && (Object.values(BrandVariations) as string[]).includes(brand);

// calling normalizeEmail on a userName will have no change
const userNameOrEmailOrPhone = (user) => normalizeEmail(user.userName?.trim() || user.userEmail?.trim() || user.email?.trim()?.replace(/\s/g, '') || '')
    || normalizePhoneNumber(
        user.userName?.trim()?.replace(/\s/g, '')
            || user.userEmail?.trim()?.replace(/\s/g, '')
            || user.phoneNumber?.trim()?.replace(/\s/g, '') || '',
    );

// Used to disguise customer info, but be consistent for same input string
const basicHash = (input: string) => {
    let hash = 0;
    let i;
    let chr;
    if (input.length === 0) return hash;
    for (i = 0; i < input.length; i += 1) {
        chr = input.charCodeAt(i);
        // eslint-disable-next-line no-bitwise
        hash = ((hash << 5) - hash) + chr;
        // eslint-disable-next-line no-bitwise
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

// Authenticate user
const login: RequestHandler = (req: any, res: any) => {
    const {
        authorization: authHeader,
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
        platform,
    } = parseHeaders(req.headers);

    // const { paymentSessionId } = req.body;
    // TODO: Use paymentSessionId to fetch subscription details and add accessLevels to user

    // TODO: Mitigate user with multiple accounts attached to the same phone number.
    // Logging in by phone number should attach to all accounts with that phone number and allow them to pick one
    let userNameEmailPhone = userNameOrEmailOrPhone(req.body);
    let userEmail = normalizeEmail(req.body.userName?.trim() || req.body.userEmail?.trim() || req.body.email?.trim()?.replace(/\s/g, '') || '');
    let userPhone = normalizePhoneNumber(
        req.body.userName?.trim()?.replace(/\s/g, '')
            || req.body.userEmail?.trim()?.replace(/\s/g, '')
            || req.body.email?.trim()?.replace(/\s/g, '')
            || req.body.phoneNumber?.trim()?.replace(/\s/g, '') || '',
    );

    let userHash = userNameEmailPhone ? basicHash(userNameEmailPhone) : undefined;
    let getUsersPromise;

    /**
     * This ensures that already authenticated users associate any oauth2 integrations with their already logged in account.
     * It also prevents creating a new account if the oauth2 user's email does not match the logged in user's email
     */
    if (userId && authHeader) {
        // TODO: Test security concerns like a DDOS attack
        // We should verify the auth bearer token first
        // Consider making this an optionally authed endpoint in API gateway
        getUsersPromise = Store.users.getUserByConditions({ id: userId });
    } else {
        getUsersPromise = userNameEmailPhone
            ? Store.users
                .getUserByConditions(
                    { userName: userNameEmailPhone },
                    { email: userNameEmailPhone },
                    { phoneNumber: userNameEmailPhone },
                )
            : Promise.resolve([]);
    }

    return getUsersPromise
        .then((userSearchResults) => {
            if (userSearchResults.length) {
                /**
                 * This is simply an event trigger. It could be triggered by a user logging in, or any other common event.
                 * We will probably want to move this to a scheduler to run at a set interval.
                 *
                 * Uses createdAt to target recently created users
                 * Deferred via setImmediate to avoid blocking login response
                 */
                setImmediate(() => {
                    TherrEventEmitter.runThoughtDistributorAlgorithm(req.headers, [userSearchResults[0].id], 'createdAt', 10);
                });

                if (req.body.isDashboard && !userSearchResults[0].isBusinessAccount) {
                    // TODO: Disallow login to dashboard for non-business users
                }
            }

            if (!userSearchResults.length && !req.body.isSSO) {
                logSpan({
                    level: 'warn',
                    messageOrigin: 'API_SERVER',
                    messages: ['user auth failed: user not found'],
                    traceArgs: {
                        'user.hash': userHash,
                    },
                });
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.auth.noUserFound'),
                    statusCode: 404,
                });
            }

            if (!req.body.isSSO
                && !(userSearchResults[0]?.accessLevels?.includes(AccessLevels.EMAIL_VERIFIED)
                    || userSearchResults[0]?.accessLevels?.includes(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES))) {
                logSpan({
                    level: 'warn',
                    messageOrigin: 'API_SERVER',
                    messages: ['user auth failed: user not verified'],
                    traceArgs: {
                        'user.hash': userHash,
                    },
                });
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.auth.accountNotVerified'),
                    statusCode: 401,
                });
            }

            return validateCredentials(req.headers, userSearchResults, {
                locale,
                reqBody: {
                    isSSO: req.body.isSSO,
                    isDashboard: req.body.isDashboard,
                    ssoProvider: req.body.ssoProvider,
                    ssoPlatform: req.body.ssoPlatform,
                    nonce: req.body.nonce,
                    idToken: req.body.idToken,
                    password: req.body.password,
                    userPhoneNumber: req.body.userPhoneNumber,
                    userEmail: req.body.userEmail,
                    userFirstName: req.body.userFirstName,
                    userLastName: req.body.userLastName,
                },
            }, res).then(async ([isValid, userDetails, oauthResponseData]) => {
                if (isValid) {
                    const user = {
                        ...userDetails,
                        isSSO: !!req.body.isSSO,
                        integrations: {
                            ...decryptIntegrationsAccess(userDetails?.integrationsAccess),
                        },
                    };
                    if (oauthResponseData?.access_token) {
                        // TODO: Store access_tokens encrypted in DB (integrationsAccess) for fetching
                        // TODO: Fetch stored access_tokens and return in integrations object
                        const DEFAULT_60_DAYS_AS_SECONDS = 60 * 60 * 24 * 60; // 60 days
                        user.integrations[OAuthIntegrationProviders.FACEBOOK] = {
                            user_access_token: oauthResponseData.access_token,
                            user_access_token_expires_at: Date.now() + ((oauthResponseData?.expires_in || DEFAULT_60_DAYS_AS_SECONDS) * 1000),
                        };
                    }
                    userNameEmailPhone = userNameOrEmailOrPhone(userDetails);

                    userEmail = userDetails.email?.trim() || ''; // DB response values should already be normalized
                    userPhone = userDetails.phoneNumber?.trim()?.replace(/\s/g, ''); // DB response values should already be normalized
                    const userOrgs = await Store.userOrganizations.get({
                        userId: user.id,
                    }).catch((err) => {
                        logSpan({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: [err?.message, 'Failed to fetch user organizations for idToken'],
                            traceArgs: {
                                issue: '',
                                port: process.env.USERS_SERVICE_API_PORT,
                                'process.id': process.pid,
                            },
                        });
                        return [];
                    });

                    const idToken = createUserToken(user, userOrgs, req.body.rememberMe, brandVariation);
                    const refreshTokenData = createRefreshToken(user.id, req.body.rememberMe, brandVariation);
                    userHash = basicHash(userNameEmailPhone);

                    logSpan({
                        level: 'info',
                        messageOrigin: 'API_SERVER',
                        messages: ['user login success'],
                        traceArgs: {
                            'user.isSSO': req.body.isSSO,
                            'user.loginCount': !userSearchResults?.length ? 1 : userSearchResults[0].loginCount,
                            'user.hash': userHash,
                            'user.id': userDetails.id,
                        },
                    });

                    // Fire and forget
                    // Reward inviting user for first time login
                    if (!userSearchResults?.length || userSearchResults[0].loginCount < 2) {
                        let invitesPromise: any;
                        if (userPhone) {
                            invitesPromise = Store.invites.getInvitesForPhoneNumber({
                                phoneNumber: userPhone,
                                isAccepted: false,
                            });
                        } else if (userEmail) {
                            invitesPromise = Store.invites.getInvitesForEmail({ email: normalizeEmail(userEmail.trim()), isAccepted: false });
                        } else {
                            invitesPromise = Promise.resolve([]);
                        }

                        invitesPromise.then((invites) => {
                            if (invites.length) {
                                // TODO: Log response
                                return Store.invites.updateInvite({ id: invites[0].id }, { isAccepted: true });
                            }

                            return Promise.resolve();
                        }).then((response) => {
                            if (response?.length) {
                                return Store.users.updateUser({
                                    settingsTherrCoinTotal: CurrentSocialValuations.invite,
                                }, {
                                    id: response[0]?.requestingUserId,
                                });
                            }

                            return Promise.resolve();
                        }).catch((err) => {
                            logSpan({
                                level: 'error',
                                messageOrigin: 'API_SERVER',
                                messages: [err?.message],
                                traceArgs: {
                                    issue: '',
                                    port: process.env.USERS_SERVICE_API_PORT,
                                    'process.id': process.pid,
                                },
                            });
                        });
                    }

                    const updateArgs: any = {
                        accessLevels: JSON.stringify([...new Set(user.accessLevels)]),
                        loginCount: user.loginCount + 1,
                        integrationsAccess: user.integrations,
                    };

                    if (req.body.billingEmail) {
                        if (req.body.billingEmail !== user.email) {
                            // TODO: Improve security so users cannot claim the same billing email as another user
                            // Send verification e-mail before updating param
                        }
                        updateArgs.billingEmail = req.body.billingEmail;
                    }

                    return Store.users.updateUser(updateArgs, {
                        id: user.id,
                    }).then((userResponse) => {
                        const finalUser = userResponse[0];
                        // Remove credentials from object
                        redactUserCreds(finalUser);
                        // Track which apps a user actually uses. Fire-and-forget: a failure here
                        // must not block the login response, but we want to log it for observability.
                        // Skip DASHBOARD_THERR for non-business accounts so dashboard sign-ins don't
                        // pollute consumer brand membership records.
                        // Only track brands we recognize. Without this guard a malicious client could
                        // submit `x-brand-variation: <anything>` to pollute the user's brandVariations
                        // array (no SQL injection — it's parameterized — but it would let an attacker
                        // grow the JSONB array unboundedly via repeated logins under different bogus
                        // values, an integrity / DoS angle).
                        const shouldTrackBrand = isKnownBrand(brandVariation)
                            && !(brandVariation === BrandVariations.DASHBOARD_THERR && !finalUser?.isBusinessAccount);
                        if (shouldTrackBrand) {
                            Store.users.upsertBrandVariation(user.id, brandVariation).catch((err) => {
                                logSpan({
                                    level: 'error',
                                    messageOrigin: 'API_SERVER',
                                    messages: [err?.message, 'Failed to upsert brandVariations on login'],
                                    traceArgs: {
                                        'user.id': user.id,
                                        'brand.variation': brandVariation,
                                    },
                                });
                            });
                        }
                        // TODO: Save, Encrypt, and return stored user integrations
                        // const storedIntegrations = encryptIntegrationsAccess(access);
                        return res.status(201).send({
                            ...finalUser,
                            idToken,
                            refreshToken: refreshTokenData.token,
                            integrations: user.integrations || {},
                            rememberMe: req.body.rememberMe,
                            userOrganizations: userOrgs,
                        });
                    });
                }

                logSpan({
                    level: 'warn',
                    messageOrigin: 'API_SERVER',
                    messages: ['user auth failed: incorrect password'],
                    traceArgs: {
                        'user.hash': userHash,
                    },
                });

                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.auth.incorrectUserPass'),
                    statusCode: 401,
                });
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:AUTH_ROUTES:ERROR' }));
};

// Logout user
const logout: RequestHandler = (req: any, res: any) => Store.users.getUserByConditions({ userName: req.body.userName })
    .then((results) => {
        if (!results.length) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
            });
        }
        res.status(204).send(req.request);
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:AUTH_ROUTES:ERROR' }));

// Refresh access token using a refresh token
const refreshToken: RequestHandler = async (req: any, res: any) => {
    const { refreshToken: reqRefreshToken, rememberMe } = req.body;

    if (!reqRefreshToken) {
        return handleHttpError({
            res,
            message: 'Refresh token is required',
            statusCode: 400,
        });
    }

    try {
        const decoded = jwt.verify(reqRefreshToken, process.env.JWT_SECRET || '') as any;

        if (decoded.type !== 'refresh') {
            return handleHttpError({
                res,
                message: 'Invalid token type',
                statusCode: 403,
            });
        }

        const userResults = await Store.users.getUsers({ id: decoded.id });
        if (!userResults.length) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
            });
        }

        const user = userResults[0];

        if (user.isBlocked) {
            return handleHttpError({
                res,
                message: 'User is blocked',
                statusCode: 403,
            });
        }

        // Ensure user still has a verified email (consistent with login check)
        if (!(user.accessLevels?.includes(AccessLevels.EMAIL_VERIFIED)
            || user.accessLevels?.includes(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES))) {
            return handleHttpError({
                res,
                message: 'Account is not verified',
                statusCode: 401,
            });
        }

        const userOrgs = await Store.userOrganizations.get({
            userId: user.id,
        }).catch(() => []);

        const userWithIntegrations = {
            ...user,
            isSSO: false,
            integrations: {
                ...decryptIntegrationsAccess(user?.integrationsAccess),
            },
        };

        // Brand stickiness on refresh: the refresh token represents a session for the brand it
        // was originally issued under. We re-stamp the new id+refresh tokens with that same brand.
        // For pre-multi-app refresh tokens that have no `brand` claim, opportunistically upgrade
        // using the current request's brand-variation header.
        const { brandVariation: refreshHeaderBrand } = parseHeaders(req.headers);
        const stickyBrand = decoded.brand || refreshHeaderBrand;

        const newIdToken = createUserToken(userWithIntegrations, userOrgs, rememberMe, stickyBrand);
        const newRefreshTokenData = createRefreshToken(user.id, rememberMe, stickyBrand);

        redactUserCreds(userWithIntegrations);

        return res.status(200).send({
            ...userWithIntegrations,
            idToken: newIdToken,
            refreshToken: newRefreshTokenData.token,
            userOrganizations: userOrgs,
        });
    } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
            return handleHttpError({
                res,
                err,
                message: 'Refresh token has expired',
                statusCode: 401,
            });
        }

        return handleHttpError({
            res,
            err,
            message: 'Invalid refresh token',
            statusCode: 403,
        });
    }
};

const verifyToken: RequestHandler = (req: any, res: any) => {
    try {
        const decodedToken = jwt.verify(req.body.idToken, process.env.JWT_SECRET || '');
        return res.status(200).send(decodedToken);
    } catch (err: any) {
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
};

// Pre-computed dummy bcrypt hash. Used to keep precheck timing constant when no user exists,
// so the response time itself doesn't reveal whether the email is registered. The salt is fixed
// (precomputed once at module load) so we don't pay a fresh hash cost on every cold start.
const PRECHECK_DUMMY_HASH = bcrypt.hashSync('precheck-timing-equalizer', 12);

// Email pre-check: tells the client to render the universal "continue" UI (password field +
// SSO buttons + magic-link option, all visible). Deliberately returns a single neutral hint
// regardless of account state so the response cannot be used to enumerate registered emails.
// We still do the DB lookup and a bcrypt compare to keep timing constant with future variants
// that might attach state to the result.
const emailPrecheck: RequestHandler = async (req: any, res: any) => {
    const { locale } = parseHeaders(req.headers);
    const rawEmail = (req.body?.email || '').toString();
    const email = normalizeEmail(rawEmail.trim());

    try {
        const userResults = email
            ? await Store.users.getUserByConditions({ email })
            : [];
        const user = userResults?.[0];

        // Always run bcrypt against the user hash if present, otherwise the dummy hash. Equalizes
        // wall-clock time so an attacker cannot infer existence from the response latency.
        await bcrypt.compare('precheck-timing-equalizer', user?.password || PRECHECK_DUMMY_HASH);
    } catch (err: any) {
        // Lookup or bcrypt failure must NOT alter the response — falling through gives the same
        // shape an attacker would see for any input. Log so we can spot a regression internally.
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [err?.message, 'email-precheck DB/bcrypt failure (response unchanged)'],
            traceArgs: {},
        });
    }

    // Single neutral hint for everyone. The client renders the full continuation UI and lets the
    // user pick how to proceed; the actual /auth call decides what works. This is the only
    // enumeration-resistant shape — any per-account branching here leaks existence.
    return res.status(200).send({
        status: 'continue',
        hint: 'continue',
        message: translate(locale, 'authMessages.emailPrecheckGeneric'),
    });
};

// Cross-app handoff. The source app (where the user is signed in) mints a single-use code bound
// to a target brand. The target app, opened via universal link, redeems that code for fresh
// tokens stamped with the target brand. This is the first-party analog of OAuth's authorization
// code flow — but without the consent screen ceremony, since both apps are owned by us and the
// user has already authenticated to the source app.

const mintHandoff: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const rawSourceBrand = (req.headers['x-brand-variation'] as string) || '';
    const targetBrand = (req.body?.targetBrand || '').toString();
    const deviceFingerprint = req.body?.deviceFingerprint
        ? String(req.body.deviceFingerprint).slice(0, 256)
        : undefined;

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }
    if (!isKnownBrand(targetBrand)) {
        return handleHttpError({ res, message: 'Invalid targetBrand', statusCode: 400 });
    }
    // Source brand is informational (it's stored on the Redis entry; redemption only enforces
    // targetBrand), but accepting arbitrary strings would let a caller embed garbage into the
    // record — we'd surface that on logs and analytics. Drop unknown values.
    const sourceBrand = isKnownBrand(rawSourceBrand) ? rawSourceBrand : '';
    if (sourceBrand && sourceBrand === targetBrand) {
        return handleHttpError({ res, message: 'Source and target brand cannot match', statusCode: 400 });
    }

    // 128 bits of entropy → 22 url-safe chars. Big enough that brute-force is hopeless within the
    // 60s TTL even at the per-IP rate limit. Never log the code itself.
    const code = randomBytes(16).toString('base64url');

    try {
        await mintHandoffCode(code, {
            userId,
            sourceBrand,
            targetBrand,
            deviceFingerprint,
            issuedAt: Date.now(),
        });
    } catch (err: any) {
        return handleHttpError({
            res, err, message: 'Failed to mint handoff code', statusCode: 500,
        });
    }

    return res.status(200).send({ code, expiresInSeconds: 60, targetBrand });
};

const redeemHandoff: RequestHandler = async (req: any, res: any) => {
    const { locale } = parseHeaders(req.headers);
    const code = (req.body?.code || '').toString();
    const requestedBrand = (req.body?.brand || '').toString();
    const headerBrand = (req.headers['x-brand-variation'] as string) || '';

    if (!code || !requestedBrand) {
        return handleHttpError({ res, message: 'code and brand are required', statusCode: 400 });
    }
    // Reject when the request brand isn't a recognized variant. Without this guard, the body
    // alone could carry an arbitrary string into downstream code paths.
    if (!isKnownBrand(requestedBrand)) {
        return handleHttpError({ res, message: 'Invalid brand', statusCode: 400 });
    }
    // Require the x-brand-variation header AND require it to match the body. Legitimate niche
    // apps always set the header via their axios interceptor — its absence indicates a forged
    // or misconfigured caller. Without this check, an attacker stripping the header could pass
    // a body-only `brand` value the redeeming environment doesn't actually represent.
    if (!headerBrand || headerBrand !== requestedBrand) {
        return handleHttpError({ res, message: 'Brand mismatch', statusCode: 403 });
    }

    let entry;
    try {
        entry = await redeemHandoffCode(code);
    } catch (err: any) {
        return handleHttpError({
            res, err, message: 'Failed to redeem handoff code', statusCode: 500,
        });
    }

    if (!entry) {
        // Either expired, never issued, or already redeemed. Same response either way to avoid
        // leaking which case it is.
        return handleHttpError({ res, message: 'Invalid or expired code', statusCode: 410 });
    }

    if (entry.targetBrand !== requestedBrand) {
        return handleHttpError({ res, message: 'Code is not valid for this brand', statusCode: 403 });
    }

    try {
        const userResults = await Store.users.getUserByConditions({ id: entry.userId });
        if (!userResults?.length) {
            return handleHttpError({ res, message: 'User not found', statusCode: 404 });
        }
        const dbUser = userResults[0];
        if (dbUser.isBlocked) {
            return handleHttpError({ res, message: 'User is blocked', statusCode: 403 });
        }

        const userOrgs = await Store.userOrganizations.get({ userId: dbUser.id }).catch(() => []);

        const userWithIntegrations = {
            ...dbUser,
            isSSO: false,
            integrations: {
                ...decryptIntegrationsAccess(dbUser?.integrationsAccess),
            },
        };

        const idToken = createUserToken(userWithIntegrations, userOrgs, false, requestedBrand);
        const refreshTokenData = createRefreshToken(dbUser.id, false, requestedBrand);

        // Track that this user is now active in the target brand. Fire-and-forget.
        Store.users.upsertBrandVariation(dbUser.id, requestedBrand).catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [err?.message, 'Failed to upsert brandVariations on handoff redeem'],
                traceArgs: { 'user.id': dbUser.id, 'brand.variation': requestedBrand },
            });
        });

        redactUserCreds(userWithIntegrations);

        return res.status(200).send({
            ...userWithIntegrations,
            idToken,
            refreshToken: refreshTokenData.token,
            integrations: userWithIntegrations.integrations || {},
            userOrganizations: userOrgs,
        });
    } catch (err: any) {
        return handleHttpError({
            res, err, message: translate(locale, 'errorMessages.auth.incorrectUserPass'), statusCode: 500,
        });
    }
};

const cancelHandoff: RequestHandler = async (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const code = (req.body?.code || '').toString();

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }
    if (!code) {
        return handleHttpError({ res, message: 'code is required', statusCode: 400 });
    }

    try {
        await cancelHandoffCode(code);
        return res.status(200).send({ status: 'cancelled' });
    } catch (err: any) {
        return handleHttpError({
            res, err, message: 'Failed to cancel handoff code', statusCode: 500,
        });
    }
};

export {
    login,
    logout,
    refreshToken,
    verifyToken,
    emailPrecheck,
    mintHandoff,
    redeemHandoff,
    cancelHandoff,
};
