import { RequestHandler } from 'express';
import {
    AccessLevels, COIN_PACKAGE_IDS, ErrorCodes, MetricNames, PushNotifications, ReferralRewards, UserConnectionTypes,
} from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { getBrandContext, parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import translate from '../utilities/translator';
import { updatePassword } from '../utilities/passwordUtils';
import syncDeviceTokenForBrand from '../utilities/syncDeviceTokenForBrand';
import sendEmailAndOrPushNotification, { resolveDeviceTokenForBrand } from '../utilities/sendEmailAndOrPushNotification';
import sendUserDeletedEmail from '../api/email/admin/sendUserDeletedEmail';
import sendSpaceClaimRequestEmail from '../api/email/admin/sendSpaceClaimRequestEmail';
import {
    createUserHelper, getUserHelper, isUserProfileIncomplete, computeAccessLevelsAfterProfileUpdate, redactUserCreds,
} from './helpers/user';
import { isClaimCodePreVerified, isMatchingInvitee } from './helpers/pactRedemption';
import { ensureCompletedUserConnection } from './helpers/inviteAcceptance';
import recordFunnelMetric from '../utilities/recordFunnelMetric';
import requestToDeleteUserData from './helpers/requestToDeleteUserData';
import { checkIsMediaSafeForWork } from './helpers';
import { createOrUpdateAchievement } from './helpers/achievements';
import { getAccessForCodeType } from '../store/InviteCodesStore';
import sendAdminUrgentErrorEmail from '../api/email/admin/sendAdminUrgentErrorEmail';
import sendClaimPendingReviewEmail from '../api/email/for-business/sendClaimPendingReviewEmail';
import sendClaimApprovedEmail from '../api/email/for-business/sendClaimApprovedEmail';
import {
    createOneTimePassword,
    verifyUserAccount,
    resendVerification,
} from './userVerification';

// CREATE
const createUser: RequestHandler = (req: any, res: any) => {
    const {
        locale,
        whiteLabelOrigin,
        brandVariation,
        platform,
    } = parseHeaders(req.headers);

    const {
        activationCode,
        paymentSessionId,
    } = req.body;

    // This is a honeypot hidden field to prevent spam
    if (req.body.website) {
        return handleHttpError({
            res,
            message: 'Invalid Registration',
            statusCode: 400,
            err: new Error(`Attempted spam registration with email ${req.body.email}`),
        });
    }

    const {
        inviteCode,
    } = req.body;

    return Store.users.findUser(req.body)
        .then((findResults) => {
            if (findResults.length) {
                return handleHttpError({
                    res,
                    message: 'Username, e-mail, and phone number must be unique. A user already exists.',
                    statusCode: 400,
                    errorCode: ErrorCodes.USER_EXISTS,
                });
            }

            let getSubsAccessLvlsPromise: Promise<AccessLevels[]> = Promise.resolve([]);

            if (activationCode) {
                getSubsAccessLvlsPromise = Promise.all([
                    Store.inviteCodes.getInviteCodes({
                        code: activationCode,
                        isRedeemed: false,
                    }),
                    Store.inviteCodes.getInviteCodes({
                        userEmail: req.body.email,
                        isRedeemed: true,
                    }),
                ]).then(([validCodes, invalidCodes]) => {
                    if (invalidCodes.length) {
                        sendAdminUrgentErrorEmail({
                            subject: '[Urgent Error] Bad Activation Code',
                            toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                            agencyDomainName: whiteLabelOrigin,
                            brandVariation,
                        }, {
                            errorMessage: 'Activation Code already used',
                        }, {
                            userEmail: req.body.email,
                            activationCode,
                        });
                        return [];
                    }

                    if (validCodes.length) {
                        // TODO: Better error logging
                        Store.inviteCodes.updateInviteCode({
                            id: validCodes[0].id,
                        }, {
                            isRedeemed: true,
                            userEmail: req.body.email,
                        }).catch((err) => {
                            sendAdminUrgentErrorEmail({
                                subject: '[Urgent Error] Activation Code Error',
                                toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                                agencyDomainName: whiteLabelOrigin,
                                brandVariation,
                            }, {
                                errorMessage: `Failed to update activation code: ${err?.message}`,
                            }, {
                                userEmail: req.body.email,
                                activationCode,
                            });
                        });
                        return getAccessForCodeType(validCodes[0].redemptionType);
                    }

                    sendAdminUrgentErrorEmail({
                        subject: '[Urgent Error] Bad Activation Code',
                        toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                        agencyDomainName: whiteLabelOrigin,
                        brandVariation,
                    }, {
                        errorMessage: 'Activation code not found',
                    }, {
                        userEmail: req.body.email,
                        activationCode,
                    });

                    return [];
                }).catch((err) => {
                    sendAdminUrgentErrorEmail({
                        subject: '[Urgent Error] Bad Activation Code',
                        toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                        agencyDomainName: whiteLabelOrigin,
                        brandVariation,
                    }, {
                        errorMessage: `Error fetching activation codes: ${err?.message}`,
                    }, {
                        userEmail: req.body.email,
                        activationCode,
                    });
                    return [];
                });
            } else if (paymentSessionId) {
                // TODO: Use paymentSessionId to fetch subscription details and add accessLevels to user
            }

            // PACT-XXXX codes are pact-invite claims, not username referrals.
            // Pass the trimmed/uppercased code through so the post-create hook
            // can resolve it to a pending pact_members row.
            const pactClaimCode: string | null = (typeof inviteCode === 'string' && /^PACT-[A-Z0-9]{4}$/i.test(inviteCode))
                ? inviteCode.toUpperCase()
                : null;

            if (inviteCode && !pactClaimCode) {
                Store.users.findUser({
                    userName: inviteCode,
                }).then((inviter) => {
                    if (inviter.length) {
                        // TODO: Send confirmation e-mail to inviter
                        createOrUpdateAchievement({
                            'x-userid': inviter[0].id,
                            ...req.headers,
                        }, {
                            achievementClass: 'communityLeader',
                            achievementTier: '1_1',
                            progressCount: 1,
                        }).catch((err) => {
                            logSpan({
                                level: 'error',
                                messageOrigin: 'API_SERVER',
                                messages: ['Error while updating inviter achievement'],
                                traceArgs: {
                                    'error.message': err?.message,
                                },
                            });
                        });

                        // Award the inviter coins for the successful referral
                        Store.users.updateUser({
                            settingsTherrCoinTotal: ReferralRewards.inviterCoins,
                        }, {
                            id: inviter[0].id,
                        }).catch((err) => {
                            logSpan({
                                level: 'error',
                                messageOrigin: 'API_SERVER',
                                messages: ['Error while awarding inviter referral coins'],
                                traceArgs: {
                                    'error.message': err?.message,
                                },
                            });
                        });
                    }
                }).catch((err) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: [`failed to reward invite code user, ${inviteCode}`],
                        traceArgs: {
                            'error.message': err?.message,
                            'error.response': err?.response?.data,
                        },
                    });
                });
            }

            return getSubsAccessLvlsPromise.then(async (levels) => {
                // A registration carrying a valid PACT-XXXX claim whose
                // contact info matches the original invitee has already proven
                // channel ownership — grant verified access up-front and skip
                // the verification-email wall (the biggest drop-off point
                // between an invitee and their friend's pact).
                const isPreVerifiedByPactClaim = await isClaimCodePreVerified(pactClaimCode, {
                    email: req.body.email,
                    phoneNumber: req.body.phoneNumber,
                });

                return createUserHelper(
                    req.headers,
                    {
                        email: req.body.email,
                        password: req.body.password,
                        firstName: req.body.firstName,
                        isBusinessAccount: req.body.isBusinessAccount,
                        isCreatorAccount: req.body.isCreatorAccount,
                        isDashboardRegistration: req.body.isDashboardRegistration,
                        settingsEmailMarketing: req.body.settingsEmailMarketing,
                        settingsEmailBusMarketing: req.body.settingsEmailBusMarketing,
                        settingsLocale: req.body.settingsLocale || locale,
                        lastName: req.body.lastName,
                        phoneNumber: req.body.phoneNumber,
                        userName: req.body.userName,
                        accessLevels: levels,
                    },
                    false,
                    undefined,
                    !!inviteCode,
                    req.body.inviteToken,
                    isPreVerifiedByPactClaim,
                );
            }).then(async (user) => {
                let registrationSource = 'organic';
                if (pactClaimCode) {
                    registrationSource = 'pact-claim';
                } else if (inviteCode) {
                    registrationSource = 'referral-code';
                }
                recordFunnelMetric(MetricNames.FUNNEL_USER_REGISTERED, user?.id, {
                    brandVariation: brandVariation || '',
                    platform: platform || '',
                    source: registrationSource,
                });

                // Username-referral path (share link / "invite code" field):
                // the registrant explicitly entered the inviter's code, so
                // connect them immediately. Fire-and-forget — registration
                // must succeed even if the referral linkage fails.
                if (inviteCode && !pactClaimCode && user?.id) {
                    Store.users.findUser({ userName: inviteCode })
                        .then((inviterRows) => {
                            if (inviterRows?.length) {
                                return ensureCompletedUserConnection(inviterRows[0].id, user.id);
                            }
                            return null;
                        })
                        .catch((err) => {
                            logSpan({
                                level: 'error',
                                messageOrigin: 'API_SERVER',
                                messages: ['Failed to connect referral inviter to new user'],
                                traceArgs: { 'error.message': err?.message, 'user.id': user.id },
                            });
                        });
                }

                if (pactClaimCode && user?.id) {
                    // Best-effort: link the new user to the pending pact_members
                    // row keyed by claimCode and activate it. Done out-of-band
                    // so a redemption failure can't break the registration
                    // response.
                    try {
                        const member = await Store.pactMembers.findByClaim({ code: pactClaimCode });
                        const memberIsRedeemable = !!member
                            && member.status === 'pending'
                            && (!member.claimTokenExpiresAt
                                || new Date(member.claimTokenExpiresAt).getTime() >= Date.now());

                        // Identity check: the PACT-XXXX code only redeems for
                        // the address the invite was sent to. Without this a
                        // leaked code would let a stranger claim the original
                        // invitee's slot in the pact.
                        let identityMatches = false;
                        if (memberIsRedeemable) {
                            if (member.userId === user.id) {
                                identityMatches = true;
                            } else {
                                const originalInviteeRows = await Store.users.findUser(
                                    { id: member.userId },
                                    ['email', 'phoneNumber'],
                                );
                                const originalInvitee = originalInviteeRows?.[0];
                                identityMatches = !!originalInvitee && isMatchingInvitee(
                                    { email: req.body.email, phoneNumber: req.body.phoneNumber },
                                    {
                                        email: originalInvitee.email,
                                        phoneNumber: originalInvitee.phoneNumber,
                                    },
                                );
                            }
                        }

                        if (memberIsRedeemable && identityMatches) {
                            if (member.userId !== user.id) {
                                await Store.pactMembers.rebindUserId(member.id, user.id);
                            }
                            const pact = await Store.pacts.getById(member.pactId);
                            // Only flip pact → active on the first acceptance.
                            // For an already-active group pact this would reset
                            // startDate/endDate; for completed/abandoned pacts
                            // it would resurrect them.
                            if (pact && pact.status === 'pending') {
                                await Store.pacts.activate(member.pactId);
                                await Store.pactMembers.activate(member.pactId, pact.creatorUserId);
                            }
                            if (pact && (pact.status === 'pending' || pact.status === 'active')) {
                                await Store.pactMembers.activate(member.pactId, user.id);

                                recordFunnelMetric(MetricNames.FUNNEL_PACT_INVITE_ACCEPTED, user.id, {
                                    brandVariation: brandVariation || '',
                                    via: 'signup-claim',
                                });

                                // Mirror acceptPact's post-activation effects — without
                                // these, a signup-time redemption left the pact with no
                                // streak rows (check-ins would start from a broken state)
                                // and the inviter never learned their invitee joined.
                                const streakPromises: Promise<any>[] = [
                                    Store.streaks.getOrCreate(user.id, pact.habitGoalId, member.pactId),
                                ];
                                if (pact.status === 'pending') {
                                    streakPromises.push(Store.streaks.getOrCreate(pact.creatorUserId, pact.habitGoalId, member.pactId));
                                }
                                await Promise.all(streakPromises);

                                // Invited-user-is-connected-to-inviter contract: the
                                // pact creator and the newly registered invitee become
                                // connections immediately.
                                ensureCompletedUserConnection(pact.creatorUserId, user.id).catch((connErr) => {
                                    logSpan({
                                        level: 'error',
                                        messageOrigin: 'API_SERVER',
                                        messages: ['Failed to connect pact creator and claimed invitee on signup'],
                                        traceArgs: { 'error.message': connErr?.message, pactId: member.pactId },
                                    });
                                });

                                // Re-engage the inviter: their friend just joined and
                                // the pact is live. Fire-and-forget.
                                sendEmailAndOrPushNotification(Store.users.findUser, req.headers, {
                                    authorization: req.headers?.authorization,
                                    fromUser: { id: user.id, userName: user.userName || user.firstName || '' },
                                    locale,
                                    toUserId: pact.creatorUserId,
                                    type: PushNotifications.Types.pactAccepted,
                                    whiteLabelOrigin,
                                    brandVariation,
                                }).catch((notifyErr) => {
                                    logSpan({
                                        level: 'error',
                                        messageOrigin: 'API_SERVER',
                                        messages: ['Failed to notify pact creator of signup-time claim'],
                                        traceArgs: { 'error.message': notifyErr?.message, pactId: member.pactId },
                                    });
                                });
                            }
                        } else if (memberIsRedeemable && !identityMatches) {
                            logSpan({
                                level: 'warn',
                                messageOrigin: 'API_SERVER',
                                messages: ['Refused pact claim redemption: registrant does not match invitee'],
                                traceArgs: { pactClaimCode, newUserId: user.id },
                            });
                        }
                    } catch (err: any) {
                        logSpan({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: ['Error redeeming pact claim code on signup'],
                            traceArgs: { 'error.message': err?.message, pactClaimCode },
                        });
                    }
                }
                return res.status(201).send(user);
            });
        })
        .catch((err) => {
            if (err?.message === 'invalid-password') {
                return handleHttpError({
                    err,
                    res,
                    message: translate(locale, 'errorMessages.auth.invalidPassword'),
                    statusCode: 400,
                });
            }

            return handleHttpError({
                err,
                res,
                message: 'SQL:USER_ROUTES:ERROR',
            });
        });
};

// READ
const getMe = (req, res) => {
    const userId = req.headers['x-userid'];
    const { brandVariation } = getBrandContext(req.headers);

    return Store.users.getUserByConditions({ id: userId, settingsIsAccountSoftDeleted: false })
        .then(async (results) => {
            if (!results.length) {
                return handleHttpError({
                    res,
                    message: `No user found with the provided params: ${JSON.stringify({ id: userId })}`,
                    statusCode: 404,
                });
            }

            const userResult = results[0];
            // Remove credentials from object
            redactUserCreds(userResult);

            // Multi-app isolation (Phase 2): the legacy users.deviceMobileFirebaseToken column
            // is overwritten whenever a second branded app (e.g. Habits) registers on the same
            // device, so it can point at another brand's app install. Consumers that read this
            // endpoint for push routing — notably background-location processing in
            // push-notifications-service, whose BackgroundGeolocation requests never carry the
            // x-user-device-token header — would then deliver this brand's notification to the
            // wrong app. Override with the brand-scoped token from main.userDeviceTokens (keyed
            // on the request's x-brand-variation), falling back to the legacy column when the
            // device hasn't re-registered against the new table yet.
            userResult.deviceMobileFirebaseToken = await resolveDeviceTokenForBrand(
                brandVariation,
                userId,
                userResult.deviceMobileFirebaseToken,
            );

            return res.status(200).send(userResult);
        })
        .catch((err) => handleHttpError({
            err,
            res,
            message: 'SQL:USER_ROUTES:ERROR',
        }));
};

// READ
/**
 * Deliberately NOT brand-scoped. This is a profile-by-id lookup, which is reached from a
 * shared link rather than from discovery, so a Habits user opening a link to a Therr
 * profile should still see it. Brand scoping belongs on discovery and contact-matching
 * paths (searchUsers, searchUserPairings, findUsersByContactInfo), not here.
 */
const getUser = (req, res) => {
    const authHeader = req.headers.authorization; // undefined if user is not logged in
    const userId = req.headers['x-userid'];

    if (!!authHeader && !!userId && userId !== req.params.id) {
        Store.userConnections.incrementUserConnection(userId, req.params.id, 1)
            .catch((err) => console.log(err));
    }

    return getUserHelper({
        isAuthorized: !!authHeader,
        requestingUserId: userId,
        targetUserParams: {
            id: req.params.id,
        },
        res,
    });
};

// READ
/**
 * IMPORTANT - This should not return sensitive information. It is used exclusively to check for the existence
 * of a user by phone number.
 */
const getUserByPhoneNumber = (req, res) => {
    const userId = req.headers['x-userid'];
    const { phoneNumber } = req.params;

    return Store.users.getUserById(userId, ['email', 'phoneNumber', 'isBusinessAccount', 'isCreatorAccount']).then((userSearchResults) => {
        if (!userSearchResults.length) {
            return handleHttpError({
                res,
                message: `No user found with id, ${userId}. User is required to verify phone number.`,
                statusCode: 400,
            });
        }

        return Store.users.getByPhoneNumber(phoneNumber).then((results) => {
            const requestingUser = userSearchResults[0];
            if (!results.length) {
                // 1st account with this phone number
                return res.status(200).send({
                    isSecondAccount: false,
                    isThirdAccount: false,
                    existingUsers: results,
                });
            }
            if (results.length === 1 && (
                results[0].isBusinessAccount !== requestingUser.isBusinessAccount
                || results[0].isCreatorAccount !== requestingUser.isCreatorAccount)
            ) {
                // 2nd account with this phone number
                return res.status(200).send({
                    isSecondAccount: true,
                    isThirdAccount: false,
                    existingUsers: results,
                });
            }
            // TODO: Unit test
            if (results.length > 1) {
                const hasExistingBusAccount = results.find((result) => result.isBusinessAccount);
                const hasExistingCreatorAccount = results.find((result) => result.isCreatorAccount);
                if ((requestingUser.isBusinessAccount && !hasExistingBusAccount)
                    || (requestingUser.isCreatorAccount && !hasExistingCreatorAccount)) {
                    // 3rd account with this phone number
                    return res.status(200).send({
                        isSecondAccount: false,
                        isThirdAccount: true,
                        existingUsers: results,
                    });
                }
            }

            return res.status(400).send({
                existingUsers: results,
                errorCode: ErrorCodes.TOO_MANY_ACCOUNTS,
                statusCode: 400,
            });
        });
    });
};

// READ
/**
 * IMPORTANT - This is a public endpoint without optional authorization
 * Consider any and all implications of data that is returned
 *
 * Deliberately NOT brand-scoped, for the same reason as getUser above: this backs public,
 * SEO-indexed profile pages reached by direct link. Scoping it would 404 valid cross-brand
 * profile links. See getUser for where brand scoping does belong.
 */
const getUserByUserName = (req, res) => {
    const authHeader = req.headers.authorization; // undefined if user is not logged in
    const userId = req.headers['x-userid']; // undefined if user is not logged in
    const { userName } = req.params;
    // NOTE: authorization may be removed in future since these services are in a secure subnet
    const isAuthorized = authHeader || userId;

    return getUserHelper({
        isAuthorized,
        requestingUserId: userId,
        targetUserParams: {
            userName,
        },
        res,
    });
};

const getUsers: RequestHandler = (req: any, res: any) => Store.users.getUsers()
    .then((results) => {
        res.status(200).send(results.map((user) => {
            // Remove credentials from object
            redactUserCreds(user);
            return user;
        }));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

const findUsers: RequestHandler = (req: any, res: any) => Store.users.findUsers({ ids: req.body.ids })
    .then((results) => {
        res.status(200).send(results.map((user) => {
            // Remove credentials from object
            redactUserCreds(user);
            return user;
        }));
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));

const searchUsers: RequestHandler = (req: any, res: any) => {
    const userId = req.headers['x-userid']; // undefined if user is not logged in
    // Discovery is brand-scoped: identity-shared main.users has no brand column, so we
    // filter on brandVariations enrollment. getBrandContext defaults to THERR for legacy
    // tokens with no x-brand-variation header, matching the column's default membership.
    const { brandVariation } = getBrandContext(req.headers);

    const {
        ids,
        query,
        queryColumnName,
        limit,
        offset,
    } = req.body;

    const actualLimit = limit || 21;
    const actualOffset = offset || 0;

    const mightKnowPromise = !query
        ? Store.userConnections.getMightKnowUserConnections(userId)
            .then((connections) => Store.users.findUsers({
                ids: connections
                    .map((con) => (con.requestingUserId === userId ? con.acceptingUserId : con.requestingUserId)),
                // Brand-scope People-You-May-Know too. Without this, the mightKnow list leaks
                // cross-brand accounts (contact-matched Therr users showing inside Habits) even
                // though the primary searchUsers results are already brand-scoped.
                brandVariation,
            }))
        : Promise.resolve([]);

    // Run mightKnow and searchUsers in parallel for better latency
    const searchPromise = Store.users.searchUsers(userId, {
        ids,
        query,
        queryColumnName,
        limit: actualLimit,
        offset: actualOffset,
        brandVariation,
    }, true, true);

    return Promise.all([mightKnowPromise, searchPromise])
        .then(([mightKnowResults, results]) => {
            res.status(200).send({
                results: results.map((user) => {
                    // Remove credentials from object
                    redactUserCreds(user);
                    return user;
                }),
                mightKnowResults: mightKnowResults.map((user) => ({
                    ...user,
                    isConnected: false,
                })),
                pagination: {
                    itemsPerPage: (actualLimit),
                    pageNumber: actualOffset + 1,
                },
            });
        }).catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));
};

/**
 * Fetches users that may be a good influencer match for the requesting user
 */
const searchUserPairings: RequestHandler = (req: any, res: any) => {
    const userId = req.headers['x-userid']; // undefined if user is not logged in
    // Brand-scoped for the same reason as its sibling searchUsers above: this is a
    // discovery surface, so without the filter a niche dashboard pairs its users with
    // accounts from another brand. getBrandContext defaults to THERR for legacy tokens.
    const { brandVariation } = getBrandContext(req.headers);

    // TODO: Implement prediction algorithm to find users relevant to the requesting user

    const {
        ids,
        query,
        queryColumnName,
        limit,
        offset,
    } = req.body;

    const actualLimit = limit || 21;
    const actualOffset = offset || 0;

    return Store.users.searchUserSocials(userId, {
        ids,
        query,
        queryColumnName,
        limit: actualLimit,
        offset: actualOffset,
        brandVariation,
    })
        .then((results) => {
            res.status(200).send({
                results: results.map((user) => {
                    // Remove credentials from object
                    redactUserCreds(user);
                    return user;
                }),
                pagination: {
                    itemsPerPage: (actualLimit),
                    pageNumber: actualOffset + 1,
                },
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));
};

// UPDATE
const updateUser = (req, res) => {
    const {
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    return Store.users.getUserById(userId)
        .then((userSearchResults) => {
            const {
                email,
                password,
                oldPassword,
                userName,
                organization,
            } = req.body;

            if (!userSearchResults.length) {
                return handleHttpError({
                    res,
                    message: `No user found with id, ${userId}.`,
                    statusCode: 404,
                });
            }

            // TODO: If password, validate and update password
            let passwordPromise: Promise<any> = Promise.resolve();

            let mediaPromise: Promise<boolean> = Promise.resolve(true);

            // Prevent unsafe media
            if (req.body.media?.profilePicture) {
                mediaPromise = checkIsMediaSafeForWork([req.body.media?.profilePicture]);
            }

            if (password && oldPassword) {
                passwordPromise = updatePassword({
                    hashedPassword: userSearchResults[0].password,
                    inputPassword: oldPassword,
                    locale,
                    oneTimePassword: userSearchResults[0].oneTimePassword,
                    res,
                    emailArgs: {
                        email,
                        userName,
                    },
                    newPassword: password,
                    userId,
                    whiteLabelOrigin,
                    brandVariation,
                }).catch((e) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['bad password update'],
                        traceArgs: {
                            'error.message': e?.message,
                            'error.response': e?.response?.data,
                        },
                    });
                    throw new Error('bad-password');
                });
            }

            let orgsPromise: Promise<any[]> = Promise.resolve([]);

            // TODO: Add organization to x-organizations header?
            if (organization) {
                if (organization.id) {
                    orgsPromise = Store.organizations.update(organization.id, {
                        creatorId: userId,
                        name: organization.name,
                        description: organization.description,
                        settingsGeneralBusinessType: organization.settingsGeneralBusinessType,
                    });
                } else {
                    orgsPromise = Store.organizations.count(userId).then((response) => {
                        if (response[0].count >= 5) {
                            return Promise.reject(new Error('max-organizations'));
                        }

                        return Store.organizations.create([{
                            creatorId: userId,
                            name: organization.name,
                            description: organization.description,
                            settingsGeneralBusinessType: organization.settingsGeneralBusinessType,
                        }]).then((orgsResult) => Store.userOrganizations.create([{
                            userId,
                            organizationId: orgsResult[0].id,
                            inviteStatus: 'accepted',
                            accessLevels: [AccessLevels.ORGANIZATIONS_ADMIN],
                        }]).then(() => orgsResult));
                    });
                }
            }

            const rawAutoRechargePackageId = req.body.autoRechargePackageId;
            if (rawAutoRechargePackageId !== undefined
                && rawAutoRechargePackageId !== null
                && !(typeof rawAutoRechargePackageId === 'string' && (COIN_PACKAGE_IDS as string[]).includes(rawAutoRechargePackageId))) {
                return handleHttpError({
                    res,
                    message: 'Invalid autoRechargePackageId',
                    statusCode: 400,
                });
            }
            const rawAutoRechargeThreshold = req.body.autoRechargeThresholdCoins;
            if (rawAutoRechargeThreshold !== undefined
                && rawAutoRechargeThreshold !== null
                && !(Number.isInteger(rawAutoRechargeThreshold) && rawAutoRechargeThreshold >= 0)) {
                return handleHttpError({
                    res,
                    message: 'Invalid autoRechargeThresholdCoins',
                    statusCode: 400,
                });
            }
            const rawAutoRechargeEnabled = req.body.autoRechargeEnabled;
            if (rawAutoRechargeEnabled !== undefined
                && rawAutoRechargeEnabled !== null
                && typeof rawAutoRechargeEnabled !== 'boolean') {
                return handleHttpError({
                    res,
                    message: 'Invalid autoRechargeEnabled',
                    statusCode: 400,
                });
            }

            // TODO: Don't allow updating phone number unless user phone number is already verified
            const updateArgs: any = {
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                media: req.body.media,
                phoneNumber: req.body.phoneNumber,
                hasAgreedToTerms: req.body.hasAgreedToTerms,
                isBusinessAccount: req.body.isBusinessAccount,
                isCreatorAccount: req.body.isCreatorAccount,
                userName: req.body.userName,
                deviceMobileFirebaseToken: req.body.deviceMobileFirebaseToken,
                settingsBio: req.body.settingsBio,
                settingsEmailMarketing: req.body.settingsEmailMarketing,
                settingsEmailBusMarketing: req.body.settingsEmailBusMarketing,
                settingsEmailLikes: req.body.settingsEmailLikes,
                settingsEmailInvites: req.body.settingsEmailInvites,
                settingsEmailMentions: req.body.settingsEmailMentions,
                settingsEmailMessages: req.body.settingsEmailMessages,
                settingsEmailReminders: req.body.settingsEmailReminders,
                settingsEmailBackground: req.body.settingsEmailBackground,
                settingsThemeName: req.body.settingsThemeName,
                settingsIsProfilePublic: req.body.settingsIsProfilePublic,
                settingsIsLeaderboardEnabled: req.body.settingsIsLeaderboardEnabled,
                settingsPushMarketing: req.body.settingsPushMarketing,
                settingsPushBackground: req.body.settingsPushBackground,
                settingsLocale: req.body.settingsLocale,
                settingsIsAccountSoftDeleted: req.body.settingsIsAccountSoftDeleted,
                shouldHideMatureContent: req.body.shouldHideMatureContent,
                autoRechargeEnabled: rawAutoRechargeEnabled,
                autoRechargeThresholdCoins: rawAutoRechargeThreshold,
                autoRechargePackageId: rawAutoRechargePackageId,
            };

            const isMissingUserProps = isUserProfileIncomplete(updateArgs, userSearchResults[0]);
            const nextAccessLevels = computeAccessLevelsAfterProfileUpdate(
                userSearchResults[0].accessLevels,
                isMissingUserProps,
            );
            if (nextAccessLevels) {
                updateArgs.accessLevels = nextAccessLevels;
            }

            return Promise.all([passwordPromise, orgsPromise, mediaPromise])
                .then(([passwordResult, orgsResult, isMediaSafeForWork]) => {
                    if (!isMediaSafeForWork) {
                        return handleHttpError({
                            res,
                            message: translate(locale, 'errorMessages.privacy.restrictedMedia'),
                            statusCode: 400,
                        });
                    }
                    return Store.users
                        .updateUser(updateArgs, {
                            id: userId,
                        })
                        .then(async (results) => {
                            const user = results[0];
                            // Remove credentials from object
                            redactUserCreds(user);

                            // Phase 2 dual-write to brand-scoped token table. Fire-and-forget; legacy column above stays authoritative until cutover.
                            syncDeviceTokenForBrand(req.headers, user.id, req.body.deviceMobileFirebaseToken);

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

                            // TODO: Investigate security issue
                            // Lockdown updateUser
                            return res.status(202).send({
                                ...user,
                                id: userId,
                                organizations: orgsResult,
                                userOrganizations: userOrgs,
                            }); // Precaution, always return correct request userID to prevent pollution
                        });
                });
        })
        .catch((err) => {
            if (err?.message?.includes('users_username_unique')) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.user.uniqueUserName'),
                    statusCode: 400,
                });
            }
            if (err?.message === 'bad-password') {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.user.invalidUserNamePassword'),
                    statusCode: 400,
                });
            }
            if (err?.message === 'max-organizations') {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.user.maxOrgs'),
                    statusCode: 400,
                });
            }

            return handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' });
        });
};

const updateLastKnownLocation = (req, res) => {
    const {
        locale,
        userId,
    } = parseHeaders(req.headers);
    const {
        latitude,
        longitude,
    } = req.body;

    if (userId !== req.params.id) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.user.misMatchUserIDs'),
            statusCode: 400,
        });
    }

    return Store.users
        .updateUser({
            lastKnownLatitude: latitude,
            lastKnownLongitude: longitude,
        }, {
            id: userId,
        }).then(() => res.status(200).send({
            latitude,
            longitude,
        })).catch((e) => handleHttpError({
            res,
            message: e.message,
            statusCode: 500,
        }));
};

const updatePhoneVerification = (req, res) => Store.users.findUser({ id: req.params.id })
    .then((userSearchResults) => {
        const userId = req.headers['x-userid'];

        if (!userSearchResults.length) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
            });
        }

        const userAccessLevels = new Set(userSearchResults[0].accessLevels || []);
        userAccessLevels.add(AccessLevels.MOBILE_VERIFIED);

        return Store.users
            .updateUser({
                // remove duplicates using Set()
                accessLevels: JSON.stringify([...userAccessLevels]),
                phoneNumber: req.body.phoneNumber,
            }, {
                id: userId,
            }).then((results) => {
                const user = results[0];
                // Remove credentials from object
                redactUserCreds(user);
                res.status(200).send({ ...user, id: userId });
            });
    }).catch((e) => handleHttpError({
        res,
        message: e.message,
        statusCode: 400,
    }));

const updateUserCoins = (req, res) => {
    const {
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    return Store.users.getUserById(userId)
        .then((userSearchResults) => {
            const {
                email,
                password,
                oldPassword,
                userName,
            } = req.body;

            if (!userSearchResults.length) {
                return handleHttpError({
                    res,
                    message: `No user found with id, ${userId}.`,
                    statusCode: 404,
                });
            }

            // TODO: If password, validate and update password
            let passwordPromise: Promise<any> = Promise.resolve();

            if (password && oldPassword) {
                passwordPromise = updatePassword({
                    hashedPassword: userSearchResults[0].password,
                    inputPassword: oldPassword,
                    locale,
                    oneTimePassword: userSearchResults[0].oneTimePassword,
                    res,
                    emailArgs: {
                        email,
                        userName,
                    },
                    newPassword: password,
                    userId,
                    whiteLabelOrigin,
                    brandVariation,
                }).catch((e) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['bad password update'],
                        traceArgs: {
                            'error.message': e?.message,
                            'error.response': e?.response?.data,
                        },
                    });
                    throw new Error('bad-password');
                });
            }

            const updateArgs: any = {
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                media: req.body.media,
                phoneNumber: req.body.phoneNumber,
                hasAgreedToTerms: req.body.hasAgreedToTerms,
                userName: req.body.userName,
                deviceMobileFirebaseToken: req.body.deviceMobileFirebaseToken,
                shouldHideMatureContent: req.body.shouldHideMatureContent,
            };

            // IMPORTANT: Only reward users who opt-in to background push notifications
            // TODO: Weight reward based on settingsPushTopics opt-in (Each with its own valuation)
            // TODO: increment/decrement should be stored on block-chain for auditability
            if (req.body.settingsTherrCoinTotal && userSearchResults[0].settingsPushBackground) {
                // increment/decrement
                updateArgs.settingsTherrCoinTotal = userSearchResults[0] + req.body.settingsTherrCoinTotal;
            }

            const isMissingUserProps = isUserProfileIncomplete(updateArgs, userSearchResults[0]);
            const nextAccessLevels = computeAccessLevelsAfterProfileUpdate(
                userSearchResults[0].accessLevels,
                isMissingUserProps,
            );
            if (nextAccessLevels) {
                updateArgs.accessLevels = nextAccessLevels;
            }

            passwordPromise
                .then(() => Store.users
                    .updateUser(updateArgs, {
                        id: userId,
                    })
                    .then((results) => {
                        const user = results[0];
                        // Remove credentials from object
                        redactUserCreds(user);

                        // Phase 2 dual-write to brand-scoped token table.
                        syncDeviceTokenForBrand(req.headers, user.id, req.body.deviceMobileFirebaseToken);

                        // TODO: Investigate security issue
                        // Lockdown updateUser
                        return res.status(202).send({ ...user, id: userId }); // Precaution, always return correct request userID to prevent pollution
                    }))
                .catch((e) => handleHttpError({
                    res,
                    message: translate(locale, 'User/password combination is incorrect'),
                    statusCode: 400,
                }));
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));
};

const blockUser = (req, res) => Store.users.findUser({ id: req.params.id })
    .then((findResults) => {
        const userId = req.headers['x-userid'];

        if (!findResults.length) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
            });
        }

        return Store.users
            .updateUser({
                // TODO: Should this included the existing blocked users? (verify this update works)
                // remove duplicates using Set()
                blockedUsers: [...new Set([...findResults[0].blockedUsers, ...(req.body.blockedUsers || []), req.params.id])],
            }, {
                id: userId,
            }).then((response) => res.status(200).send({ blockedUsers: response[0].blockedUsers }));
    }).catch((e) => handleHttpError({
        res,
        message: e.message,
        statusCode: 400,
    }));

const reportUser = (req, res) => Store.users.findUser({ id: req.params.id })
    .then((findResults) => {
        const userId = req.headers['x-userid'];

        if (!findResults.length) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
            });
        }

        return Store.users
            .updateUser({
                // remove duplicates using Set()
                wasReportedBy: [...new Set([...findResults[0].wasReportedBy, userId])],
            }, {
                id: req.params.id,
            }).then(() => res.status(200).send());
    }).catch((e) => handleHttpError({
        res,
        message: e.message,
        statusCode: 400,
    }));

// UPDATE PASSWORD
const updateUserPassword = (req, res) => Store.users.findUser({ id: req.headers['x-userid'] })
    .then((findResults) => {
        const {
            locale,
            userId,
            whiteLabelOrigin,
            brandVariation,
        } = parseHeaders(req.headers);
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
            whiteLabelOrigin,
            brandVariation,
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
const deleteUser = (req, res) => {
    const {
        userName,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    // User should only be able to delete self
    if (userId !== req.params.id) {
        return handleHttpError({
            res,
            message: `Unable to delete user, ${req.params.id}. Does not match requester ID`,
            statusCode: 400,
        });
    }

    return Store.users.deleteUsers({ id: req.params.id })
        .then(([deletedUser]) => {
            // TODO: Delete notifications in users service
            // TODO: Delete messages in messages service
            // TODO: Delete forums, forumMessages in messages service
            requestToDeleteUserData(req.headers);

            // TODO: Delete user session from redis in websocket-service
            // TODO: Delete user media data from cloud storage
            sendUserDeletedEmail({
                subject: '😞 User Account Deleted',
                toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                agencyDomainName: whiteLabelOrigin,
                brandVariation,
            }, {
                userDetails: {
                    id: userId,
                    userName,
                    ...deletedUser,
                },
            });

            return res.status(200).send({
                message: `User with id, ${req.params.id}, was successfully deleted`,
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));
};

const requestSpace: RequestHandler = (req: any, res: any) => {
    const {
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    // TODO: Supply user agent to determine if web or mobile
    const {
        address,
        longitude,
        latitude,
        title,
        notificationMsg,
        description,
    } = req.body;

    return Store.users.getUserById(userId)
        .then((users) => {
            if (!users.length) {
                return handleHttpError({
                    res,
                    message: 'User not found',
                    statusCode: 404,
                });
            }

            redactUserCreds(users[0]);

            const user = users[0];

            // Fire-and-forget the claim-request notification emails. These are
            // best-effort admin/business notifications and must NOT gate the HTTP
            // response. Previously they were awaited via Promise.all before the
            // 200 was sent, so any AWS SES latency (slow/unreachable endpoint, SDK
            // retry backoff) blocked the response. With no client-side request
            // timeout on mobile, that surfaced as the "request a space" submit
            // hanging indefinitely. Respond immediately; log email failures.
            Promise.all([
                sendClaimPendingReviewEmail({
                    subject: 'Business Space Request in Review',
                    locale,
                    toAddresses: [user.email],
                    agencyDomainName: whiteLabelOrigin,
                    brandVariation,
                    recipientIdentifiers: {
                        id: user.id,
                        accountEmail: user.email,
                    },
                }, {
                    spaceName: title || notificationMsg,
                }),
                sendSpaceClaimRequestEmail({
                    subject: '[Urgent Request] User Claimed a Space',
                    toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                    agencyDomainName: whiteLabelOrigin,
                    brandVariation,
                }, {
                    address,
                    longitude,
                    latitude,
                    title: title || notificationMsg,
                    description,
                    userId,
                }),
            ]).catch((err) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['Failed to send space claim request emails'],
                    traceArgs: {
                        'error.message': err?.message,
                        'user.id': userId,
                    },
                });
            });

            return res.status(200).send({
                message: 'Request sent to admin',
                user: {
                    accessLevels: user.accessLevels,
                    isBusinessAccount: user.isBusinessAccount,
                    email: user.email,
                },
            });
        })
        .catch((err) => handleHttpError({
            err,
            res,
            message: 'SQL:USER_ROUTES:ERROR',
        }));
};

const approveSpaceRequest: RequestHandler = (req: any, res: any) => {
    const {
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    // TODO: Supply user agent to determine if web or mobile
    const {
        address,
        longitude,
        latitude,
        title,
        notificationMsg,
        description,
        id: spaceId,
        fromUserId,
        requestedByUserId,
    } = req.body;

    return Store.users.getUserById(requestedByUserId || fromUserId)
        .then((users) => {
            if (!users.length) {
                return handleHttpError({
                    res,
                    message: 'User not found',
                    statusCode: 404,
                });
            }

            redactUserCreds(users[0]);

            return sendClaimApprovedEmail({
                subject: 'Approved: Business Space Request',
                locale,
                toAddresses: [users[0].email],
                agencyDomainName: whiteLabelOrigin,
                brandVariation,
                recipientIdentifiers: {
                    id: users[0].id,
                    accountEmail: users[0].email,
                },
            }, {
                spaceName: title || notificationMsg,
                spaceId,
            }).then(() => users[0]);
        })
        .then((user) => res.status(200).send({
            message: 'Request approved by admin',
            user: {
                id: user.id,
            },
        }))
        .catch((err) => handleHttpError({
            err,
            res,
            message: 'SQL:USER_ROUTES:ERROR',
        }));
};

// Internal (service-to-service): clears a user's stored FCM device token when
// the push-notifications-service confirms it's no longer registered with FCM.
// Matches on (userId, token) so we don't clobber a freshly rotated token.
const clearUserDeviceToken: RequestHandler = (req, res) => {
    const { userId, deviceToken } = req.body || {};
    if (!userId || !deviceToken) {
        return handleHttpError({
            res,
            message: 'userId and deviceToken are required',
            statusCode: 400,
        });
    }
    return Store.users.clearDeviceToken(userId, deviceToken)
        .then((rows: any[]) => {
            // Phase 2: also clean up the brand-scoped token table. Token strings are globally
            // unique to a device install regardless of brand, so deletion by token alone is safe.
            // Fire-and-forget — failure here must not break legacy cleanup.
            Store.userDeviceTokens.deleteByToken(deviceToken).catch(() => undefined);
            logSpan({
                level: 'info',
                messageOrigin: 'API_SERVER',
                messages: ['Cleared invalid FCM device token'],
                traceArgs: {
                    'user.id': userId,
                    'pushNotification.tokenCleared': rows?.length > 0,
                },
            });
            return res.status(200).send({ cleared: rows?.length > 0 });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ROUTES:ERROR' }));
};

export {
    createUser,
    getMe,
    getUser,
    getUserByPhoneNumber,
    getUserByUserName,
    getUsers,
    findUsers,
    searchUsers,
    searchUserPairings,
    updateUser,
    updateLastKnownLocation,
    updatePhoneVerification,
    updateUserCoins,
    blockUser,
    reportUser,
    updateUserPassword,
    deleteUser,
    createOneTimePassword,
    verifyUserAccount,
    resendVerification,
    requestSpace,
    approveSpaceRequest,
    clearUserDeviceToken,
};
