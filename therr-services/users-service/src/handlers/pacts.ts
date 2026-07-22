import { RequestHandler } from 'express';
import {
    AccessLevels,
    BrandVariations,
    HABITS_FREE_PACT_LIMIT,
    MetricNames,
    PushNotifications,
} from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import sendEmailAndOrPushNotification from '../utilities/sendEmailAndOrPushNotification';
import { dispatchPactInvitation } from '../utilities/dispatchPactInvitation';
import recordFunnelMetric from '../utilities/recordFunnelMetric';
import {
    validatePactParams,
    isUserInPact,
    isCreator,
} from '../utilities/pactHelpers';
import {
    awardPactPioneerCreatedAchievement,
    awardPactPioneerInvitesAchievement,
    awardAccountabilitySelfAchievement,
    awardAccountabilityWingAchievement,
    awardSocialiteInviteAchievement,
    awardTreasurePactCompletionAchievement,
    awardResilienceWithinPactAchievement,
} from './helpers/awardHabitAchievements';

const MAX_BULK_INVITEES = 5;

const dedupeUserIds = (ids: string[]): string[] => Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0)));

/**
 * Decides whether a pact-create request is exempt from the HABITS free-tier
 * pact cap. Premium subscribers (HABITS_PREMIUM access level) bypass it.
 * Non-HABITS brands also bypass it — the cap is a HABITS monetization
 * mechanic, not a platform-wide policy.
 *
 * The actual free-tier limit is HABITS_FREE_PACT_LIMIT (configurable via env
 * var; default 5). Lower it to 1 once the payment workflow ships and users
 * can actually upgrade — see docs/niche-sub-apps/habits/HABITS_PAYMENT_WORKFLOW.md.
 */
const isPactCapExempt = (
    brandVariation: string | undefined,
    accessLevels: string[] | undefined,
): boolean => {
    if (brandVariation !== BrandVariations.HABITS) {
        return true;
    }
    if (Array.isArray(accessLevels) && accessLevels.includes(AccessLevels.HABITS_PREMIUM)) {
        return true;
    }
    if (Array.isArray(accessLevels) && accessLevels.includes(AccessLevels.SUPER_ADMIN)) {
        return true;
    }
    return false;
};

// CREATE
const createPact: RequestHandler = async (req: any, res: any) => {
    const {
        locale,
        userId,
        userName,
        authorization,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    const {
        partnerUserId,
        habitGoalId,
        pactType,
        durationDays,
        consequenceType,
        consequenceDetails,
    } = req.body;

    if (!habitGoalId) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.habitGoalRequired'),
            statusCode: 400,
        });
    }

    // Validate pact parameters
    const validation = validatePactParams({ durationDays, consequenceType, consequenceDetails });
    if (!validation.valid) {
        return handleHttpError({
            res,
            message: validation.error || 'Invalid pact parameters',
            statusCode: 400,
        });
    }

    // Verify habit goal exists
    const habitGoal = await Store.habitGoals.getById(habitGoalId);
    if (!habitGoal) {
        return handleHttpError({
            res,
            message: 'Habit goal not found',
            statusCode: 404,
        });
    }

    // HABITS free-tier cap. Counts pacts the user *created* (pending or active)
    // — pacts they were invited to don't consume their cap. Premium users and
    // non-HABITS brands bypass entirely. Returns 402 with paywall metadata so
    // the client can route to the upgrade flow rather than swallow as a
    // generic error.
    const requesterUser = await Store.users.findUser({ id: userId }, ['accessLevels']);
    const requesterAccessLevels: string[] = (requesterUser?.[0]?.accessLevels as string[]) || [];
    if (!isPactCapExempt(brandVariation, requesterAccessLevels)) {
        const openPactCount = await Store.pacts.countOpenByCreator(userId).catch((err) => {
            logSpan({
                level: 'warn',
                messageOrigin: 'API_SERVER',
                messages: ['Failed to count open pacts; allowing creation'],
                traceArgs: { 'error.message': err?.message },
            });
            // Fail-open: better to let a legitimate user create a pact than to
            // hard-block on a transient query error. The cap is a soft limit
            // (no hard data integrity issue at stake).
            return 0;
        });
        if (openPactCount >= HABITS_FREE_PACT_LIMIT) {
            return res.status(402).send({
                error: 'pact-limit-reached',
                message: translate(locale, 'errorMessages.pacts.freeTierLimitReached', {
                    limit: HABITS_FREE_PACT_LIMIT,
                }) || `Free tier is limited to ${HABITS_FREE_PACT_LIMIT} active pact(s). Upgrade to premium for unlimited pacts.`,
                limit: HABITS_FREE_PACT_LIMIT,
                openPactCount,
                upgradeRequired: true,
            });
        }
    }

    // Create the pact
    return Store.pacts.create({
        creatorUserId: userId,
        partnerUserId,
        habitGoalId,
        pactType,
        durationDays,
        consequenceType,
        consequenceDetails,
    })
        .then(async (pact) => {
            // Create pact member entry for creator
            await Store.pactMembers.create({
                pactId: pact.id,
                userId,
                role: 'creator',
                status: 'active',
            });

            recordFunnelMetric(MetricNames.FUNNEL_PACT_CREATED, userId, {
                brandVariation: brandVariation || '',
            });
            if (partnerUserId) {
                recordFunnelMetric(MetricNames.FUNNEL_PACT_INVITE_SENT, userId, {
                    brandVariation: brandVariation || '',
                });
            }

            // Award creator achievements for creating a pact (HABITS brand only — allow-list filters)
            awardPactPioneerCreatedAchievement(req.headers, 1);
            awardAccountabilitySelfAchievement(req.headers, 1);

            // If partner is specified, create their member entry and send notification
            if (partnerUserId) {
                const partnerMember = await Store.pactMembers.create({
                    pactId: pact.id,
                    userId: partnerUserId,
                    role: 'partner',
                    status: 'pending',
                });

                // Cross-app routing: if the partner has not used Habits, send
                // an email/SMS install + claim invite instead of the brand-
                // scoped push (which would otherwise misroute via Therr FCM).
                const dispatchResult = await dispatchPactInvitation({
                    pactMemberId: partnerMember.id,
                    partnerUserId,
                    fromUserName: userName,
                    habitName: habitGoal.name,
                    brandVariation,
                    whiteLabelOrigin,
                    locale,
                }).catch((err) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Error dispatching pact invitation'],
                        traceArgs: { 'error.message': err?.message },
                    });
                    return { isOnBrand: true };
                });

                if (dispatchResult.isOnBrand) {
                    sendEmailAndOrPushNotification(Store.users.findUser, req.headers, {
                        authorization,
                        fromUser: { id: userId, userName },
                        locale,
                        toUserId: partnerUserId,
                        type: PushNotifications.Types.pactInvitation,
                        whiteLabelOrigin,
                        brandVariation,
                    }).catch((err) => {
                        logSpan({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: ['Error sending pact invitation notification'],
                            traceArgs: { 'error.message': err?.message },
                        });
                    });
                }

                // Each invite to a (potentially new) partner counts as a unique invitation tier-2 hit and a socialite invite
                awardPactPioneerInvitesAchievement(req.headers, 1);
                awardSocialiteInviteAchievement(req.headers, 1);

                // Increment habit goal usage count (fire and forget)
                Store.habitGoals.incrementUsageCount(habitGoalId).catch((e) => e);
            }

            return res.status(201).send(pact);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' }));
};

// CREATE (bulk) — one pact, N pending member invites. For group pacts, the
// pact's `partnerUserId` is left null; membership is tracked entirely via
// pact_members. Any invitee who accepts joins as an active member.
const bulkInvitePact: RequestHandler = async (req: any, res: any) => {
    const {
        locale,
        userId,
        userName,
        authorization,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    const {
        habitGoalId,
        partnerUserIds,
        pactType,
        durationDays,
        consequenceType,
        consequenceDetails,
    } = req.body;

    if (!habitGoalId) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.habitGoalRequired'),
            statusCode: 400,
        });
    }

    if (!Array.isArray(partnerUserIds) || partnerUserIds.length === 0) {
        return handleHttpError({
            res,
            message: 'partnerUserIds must be a non-empty array',
            statusCode: 400,
        });
    }

    const invitees = dedupeUserIds(partnerUserIds).filter((id) => id !== userId);
    if (invitees.length === 0) {
        return handleHttpError({
            res,
            message: 'At least one valid invitee is required',
            statusCode: 400,
        });
    }
    if (invitees.length > MAX_BULK_INVITEES) {
        return handleHttpError({
            res,
            message: `Cannot invite more than ${MAX_BULK_INVITEES} partners at once`,
            statusCode: 400,
        });
    }

    const validation = validatePactParams({ durationDays, consequenceType, consequenceDetails });
    if (!validation.valid) {
        return handleHttpError({
            res,
            message: validation.error || 'Invalid pact parameters',
            statusCode: 400,
        });
    }

    const habitGoal = await Store.habitGoals.getById(habitGoalId);
    if (!habitGoal) {
        return handleHttpError({
            res,
            message: 'Habit goal not found',
            statusCode: 404,
        });
    }

    return Store.pacts.create({
        creatorUserId: userId,
        habitGoalId,
        pactType,
        durationDays,
        consequenceType,
        consequenceDetails,
    })
        .then(async (pact) => {
            await Store.pactMembers.create({
                pactId: pact.id,
                userId,
                role: 'creator',
                status: 'active',
            });

            const partnerMembers = await Store.pactMembers.createBulk(invitees.map((partnerId) => ({
                pactId: pact.id,
                userId: partnerId,
                role: 'partner' as const,
                status: 'pending',
            })));

            recordFunnelMetric(MetricNames.FUNNEL_PACT_CREATED, userId, {
                brandVariation: brandVariation || '',
            });
            recordFunnelMetric(MetricNames.FUNNEL_PACT_INVITE_SENT, userId, {
                brandVariation: brandVariation || '',
            }, String(invitees.length));

            partnerMembers.forEach((member: any) => {
                const toUserId = member.userId;
                // Mirror createPact's recovery: a dispatch error must still
                // try the on-brand push, otherwise a transient DB error in
                // partner lookup silently drops the notification for a Habits
                // invitee. Default to isOnBrand=true on failure.
                dispatchPactInvitation({
                    pactMemberId: member.id,
                    partnerUserId: toUserId,
                    fromUserName: userName,
                    habitName: habitGoal.name,
                    brandVariation,
                    whiteLabelOrigin,
                    locale,
                }).catch((err) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Error dispatching pact invitation'],
                        traceArgs: { 'error.message': err?.message, toUserId },
                    });
                    return { isOnBrand: true };
                }).then((dispatchResult) => {
                    if (!dispatchResult.isOnBrand) {
                        return undefined;
                    }
                    return sendEmailAndOrPushNotification(Store.users.findUser, req.headers, {
                        authorization,
                        fromUser: { id: userId, userName },
                        locale,
                        toUserId,
                        type: PushNotifications.Types.pactInvitation,
                        whiteLabelOrigin,
                        brandVariation,
                    });
                }).catch((err) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Error sending pact invitation notification'],
                        traceArgs: { 'error.message': err?.message, toUserId },
                    });
                });
            });

            Store.habitGoals.incrementUsageCount(habitGoalId).catch((e) => e);

            const members = await Store.pactMembers.getByPactId(pact.id);
            return res.status(201).send({ ...pact, members });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' }));
};

// READ
const getPact: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { id } = req.params;

    return Store.pacts.getByIdWithDetails(id)
        .then(async (pact) => {
            if (!pact) {
                return handleHttpError({
                    res,
                    message: `Pact not found with id ${id}`,
                    statusCode: 404,
                });
            }

            // Get members
            const members = await Store.pactMembers.getByPactId(id);

            // Verify user is a participant — for 1:1 pacts the partnerUserId
            // column is authoritative; for group pacts membership is tracked
            // entirely via pact_members.
            const isParticipant = isUserInPact(userId, pact.creatorUserId, pact.partnerUserId)
                || members.some((m: any) => m.userId === userId);
            if (!isParticipant) {
                return handleHttpError({
                    res,
                    message: 'You are not a participant in this pact',
                    statusCode: 403,
                });
            }

            return res.status(200).send({ ...pact, members });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' }));
};

const getUserPacts: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { status, limit, offset } = req.query;

    return Store.pacts.getByUserId(
        userId,
        status,
        limit ? parseInt(limit, 10) : undefined,
        offset ? parseInt(offset, 10) : undefined,
    )
        .then((pacts) => res.status(200).send(pacts))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' }));
};

const getActivePacts: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);

    return Store.pacts.getActivePactsByUserId(userId)
        .then((pacts) => res.status(200).send(pacts))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' }));
};

const getPendingInvites: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);

    return Store.pacts.getPendingInvitesForUser(userId)
        .then((invites) => res.status(200).send(invites))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' }));
};

// UPDATE
const acceptPact: RequestHandler = async (req: any, res: any) => {
    const {
        locale,
        userId,
        userName,
        authorization,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    const { id } = req.params;

    const pact = await Store.pacts.getById(id);
    if (!pact) {
        return handleHttpError({
            res,
            message: `Pact not found with id ${id}`,
            statusCode: 404,
        });
    }

    // Authorize via pact_members so group invitees (where partnerUserId is
    // null) can accept too. Falls back to the partnerUserId field for
    // 1:1 pacts that pre-date pact_members.
    const member = await Store.pactMembers.getByPactAndUser(id, userId);
    const isInvitedPartner = pact.partnerUserId === userId
        || (member && member.role === 'partner' && member.status === 'pending');
    if (!isInvitedPartner) {
        return handleHttpError({
            res,
            message: 'You are not the invited partner for this pact',
            statusCode: 403,
        });
    }

    // For 1:1 pacts the pact itself must be pending; for group pacts a
    // prior acceptance may have already activated the pact, but this
    // member's invite must still be pending.
    const memberInvitePending = !member || member.status === 'pending';
    if (pact.status !== 'pending' && !memberInvitePending) {
        return handleHttpError({
            res,
            message: 'Pact is not pending',
            statusCode: 400,
        });
    }
    if (pact.status === 'completed' || pact.status === 'abandoned' || pact.status === 'expired') {
        return handleHttpError({
            res,
            message: 'Pact is no longer accepting members',
            statusCode: 400,
        });
    }

    // Activate the pact only on the first acceptance (status=pending);
    // subsequent group acceptances just join an already-active pact.
    const activationPromise = pact.status === 'pending'
        ? Store.pacts.activate(id)
        : Promise.resolve(pact);

    return activationPromise
        .then(async (updatedPact) => {
            // Activate creator member only on first acceptance — getOrCreate
            // semantics aren't available here, but activate() is a no-op
            // idempotent UPDATE so calling it on an already-active member is
            // safe and cheap.
            const memberActivations: Promise<any>[] = [Store.pactMembers.activate(id, userId)];
            if (pact.status === 'pending') {
                memberActivations.push(Store.pactMembers.activate(id, pact.creatorUserId));
            }
            await Promise.all(memberActivations);

            // Streaks: always create for the accepting user; for the creator
            // create only on first acceptance (when transitioning the pact
            // from pending → active). getOrCreate makes this idempotent.
            const streakPromises: Promise<any>[] = [
                Store.streaks.getOrCreate(userId, pact.habitGoalId, id),
            ];
            if (pact.status === 'pending') {
                streakPromises.push(Store.streaks.getOrCreate(pact.creatorUserId, pact.habitGoalId, id));
            }
            await Promise.all(streakPromises);

            recordFunnelMetric(MetricNames.FUNNEL_PACT_INVITE_ACCEPTED, userId, {
                brandVariation: brandVariation || '',
                via: 'in-app',
            });

            // Award accepting partner for joining their first pact
            awardAccountabilitySelfAchievement(req.headers, 1);

            // Notify creator
            sendEmailAndOrPushNotification(Store.users.findUser, req.headers, {
                authorization,
                fromUser: { id: userId, userName },
                locale,
                toUserId: pact.creatorUserId,
                type: PushNotifications.Types.pactAccepted,
                whiteLabelOrigin,
                brandVariation,
            }).catch((err) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['Error sending pact accepted notification'],
                    traceArgs: { 'error.message': err?.message },
                });
            });

            return res.status(200).send(updatedPact);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' }));
};

// Redeem a cross-app pact invitation that was delivered via email/SMS as a
// long claimToken (deep link) or short claimCode (manual entry on Register).
// We trust pact_members.userId — it was written at invite time from the
// inviter's connection list. This endpoint simply maps the claim back to
// the pending pact and runs the same activation flow as acceptPact.
const claimPactInvite: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { token, code } = req.body || {};

    if (!token && !code) {
        return handleHttpError({
            res,
            message: 'A claim token or code is required',
            statusCode: 400,
        });
    }

    const member = await Store.pactMembers.findByClaim({ token, code });
    if (!member) {
        return handleHttpError({
            res,
            message: 'Invitation not found',
            statusCode: 404,
        });
    }

    if (member.userId !== userId) {
        return handleHttpError({
            res,
            message: 'This invitation belongs to another user',
            statusCode: 403,
        });
    }

    if (member.claimTokenExpiresAt && new Date(member.claimTokenExpiresAt).getTime() < Date.now()) {
        return handleHttpError({
            res,
            message: 'Invitation has expired',
            statusCode: 410,
        });
    }

    if (member.status === 'active') {
        // Idempotent — already accepted.
        const pact = await Store.pacts.getByIdWithDetails(member.pactId);
        return res.status(200).send(pact);
    }

    if (member.status !== 'pending') {
        return handleHttpError({
            res,
            message: 'Invitation is no longer redeemable',
            statusCode: 400,
        });
    }

    const delegatedReq = Object.assign(Object.create(Object.getPrototypeOf(req)), req, {
        params: { ...(req.params || {}), id: member.pactId },
    });
    return acceptPact(delegatedReq, res, () => undefined);
};

const declinePact: RequestHandler = async (req: any, res: any) => {
    const {
        locale,
        userId,
        userName,
        authorization,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    const { id } = req.params;

    const pact = await Store.pacts.getById(id);
    if (!pact) {
        return handleHttpError({
            res,
            message: `Pact not found with id ${id}`,
            statusCode: 404,
        });
    }

    // For group pacts, decline marks just this member as 'left' without
    // ending the pact for everyone else. For 1:1 pacts, the pact itself
    // is abandoned (existing behavior).
    const member = await Store.pactMembers.getByPactAndUser(id, userId);
    const isInvitedPartner = pact.partnerUserId === userId
        || (member && member.role === 'partner' && member.status === 'pending');
    if (!isInvitedPartner) {
        return handleHttpError({
            res,
            message: 'You are not the invited partner for this pact',
            statusCode: 403,
        });
    }

    const memberInvitePending = !member || member.status === 'pending';
    if (pact.status !== 'pending' && !memberInvitePending) {
        return handleHttpError({
            res,
            message: 'Pact is not pending',
            statusCode: 400,
        });
    }

    // Group pact decline (pact already active because someone else
    // accepted): only mark this member as left, leave the pact running.
    if (pact.status !== 'pending' && member) {
        await Store.pactMembers.leave(id, userId);
        sendEmailAndOrPushNotification(Store.users.findUser, req.headers, {
            authorization,
            fromUser: { id: userId, userName },
            locale,
            toUserId: pact.creatorUserId,
            type: PushNotifications.Types.pactDeclined,
            whiteLabelOrigin,
            brandVariation,
        }).catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Error sending pact declined notification'],
                traceArgs: { 'error.message': err?.message },
            });
        });
        return res.status(200).send(pact);
    }

    return Store.pacts.update(id, { status: 'abandoned', endReason: 'abandoned_partner' })
        .then((updatedPact) => {
            // Notify creator
            sendEmailAndOrPushNotification(Store.users.findUser, req.headers, {
                authorization,
                fromUser: { id: userId, userName },
                locale,
                toUserId: pact.creatorUserId,
                type: PushNotifications.Types.pactDeclined,
                whiteLabelOrigin,
                brandVariation,
            }).catch((err) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['Error sending pact declined notification'],
                    traceArgs: { 'error.message': err?.message },
                });
            });

            return res.status(200).send(updatedPact);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' }));
};

const abandonPact: RequestHandler = async (req: any, res: any) => {
    const {
        locale,
        userId,
        userName,
        authorization,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    const { id } = req.params;

    const pact = await Store.pacts.getById(id);
    if (!pact) {
        return handleHttpError({
            res,
            message: `Pact not found with id ${id}`,
            statusCode: 404,
        });
    }

    if (!isUserInPact(userId, pact.creatorUserId, pact.partnerUserId)) {
        return handleHttpError({
            res,
            message: 'You are not a participant in this pact',
            statusCode: 403,
        });
    }

    if (pact.status !== 'active') {
        return handleHttpError({
            res,
            message: 'Pact is not active',
            statusCode: 400,
        });
    }

    const userIsCreator = isCreator(userId, pact.creatorUserId);
    const partnerId = userIsCreator ? pact.partnerUserId : pact.creatorUserId;

    return Store.pacts.abandon(id, userId, userIsCreator)
        .then(async (updatedPact) => {
            // Mark members as left
            await Store.pactMembers.leave(id, userId);

            // Deactivate streaks
            const streaks = await Store.streaks.getByPactId(id);
            await Promise.all(streaks.map((s) => Store.streaks.deactivate(s.id)));

            // Notify partner
            if (partnerId) {
                sendEmailAndOrPushNotification(Store.users.findUser, req.headers, {
                    authorization,
                    fromUser: { id: userId, userName },
                    locale,
                    toUserId: partnerId,
                    type: PushNotifications.Types.pactDeclined, // Reuse declined type for abandoned
                    whiteLabelOrigin,
                    brandVariation,
                }).catch((err) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Error sending pact abandoned notification'],
                        traceArgs: { 'error.message': err?.message },
                    });
                });
            }

            return res.status(200).send(updatedPact);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' }));
};

// COMPLETE — finalize an active pact, compute completion rates, award achievements
const completePact: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { id } = req.params;

    const pact = await Store.pacts.getById(id);
    if (!pact) {
        return handleHttpError({
            res,
            message: `Pact not found with id ${id}`,
            statusCode: 404,
        });
    }

    if (!isUserInPact(userId, pact.creatorUserId, pact.partnerUserId)) {
        return handleHttpError({
            res,
            message: 'You are not a participant in this pact',
            statusCode: 403,
        });
    }

    if (pact.status !== 'active') {
        return handleHttpError({
            res,
            message: 'Pact is not active',
            statusCode: 400,
        });
    }

    // Recompute completion rates for both members before persisting status=completed
    const members = await Store.pactMembers.getByPactId(id);
    await Promise.all(members.map((m: any) => Store.pactMembers.updateCompletionRate(m.id)));
    const refreshedMembers = await Store.pactMembers.getByPactId(id);

    const creatorMember = refreshedMembers.find((m: any) => m.role === 'creator');
    const partnerMember = refreshedMembers.find((m: any) => m.role === 'partner');
    const creatorCompletionRate = creatorMember ? Number(creatorMember.completionRate) || 0 : 0;
    const partnerCompletionRate = partnerMember ? Number(partnerMember.completionRate) || 0 : 0;

    let winnerId: string | undefined;
    if (creatorCompletionRate > partnerCompletionRate) {
        winnerId = pact.creatorUserId;
    } else if (partnerCompletionRate > creatorCompletionRate) {
        winnerId = pact.partnerUserId;
    }

    return Store.pacts.complete(id, winnerId, creatorCompletionRate, partnerCompletionRate)
        .then(async (updatedPact) => {
            // Inspect goalType to know whether to award treasureBuilder tier-2
            const habitGoal = await Store.habitGoals.getById(pact.habitGoalId);
            const goalType = habitGoal?.goalType || 'build_good';

            const isCreatorRequester = pact.creatorUserId === userId;
            const requesterCompletionRate = isCreatorRequester ? creatorCompletionRate : partnerCompletionRate;
            const otherCompletionRate = isCreatorRequester ? partnerCompletionRate : creatorCompletionRate;

            // Tier 1_1 — self pact completion at >=80%
            if (requesterCompletionRate >= 80) {
                awardAccountabilitySelfAchievement(req.headers, 1);
            }
            // Tier 1_2 — wing-person credit if the OTHER member completed at >=80%
            if (otherCompletionRate >= 80) {
                awardAccountabilityWingAchievement(req.headers, 1);
            }
            // Savings pact completion → treasureBuilder 1_2
            if (goalType === 'savings_goal' && requesterCompletionRate >= 80) {
                awardTreasurePactCompletionAchievement(req.headers, 1);
            }
            // Within-pact resilience: detect at least one streak reset event during the pact window
            try {
                const streaks = await Store.streaks.getByPactId(id);
                const requesterStreak = streaks.find((s: any) => s.userId === userId);
                if (requesterStreak && requesterCompletionRate >= 80) {
                    const history = await Store.streaks.getHistoryByStreakId(requesterStreak.id);
                    const hadReset = history.some((h: any) => h.eventType === 'missed' || (h.streakBefore > 0 && h.streakAfter === 0));
                    if (hadReset) {
                        awardResilienceWithinPactAchievement(req.headers, 1);
                    }
                }
            } catch (err) {
                logSpan({
                    level: 'warn',
                    messageOrigin: 'API_SERVER',
                    messages: ['Failed to evaluate within-pact resilience'],
                    traceArgs: { 'error.message': (err as Error)?.message },
                });
            }

            return res.status(200).send(updatedPact);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' }));
};

// DELETE
const deletePact: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;

    return Store.pacts.delete(id, userId)
        .then((deleted) => {
            if (!deleted) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.pacts.cannotDelete'),
                    statusCode: 403,
                });
            }
            return res.status(200).send({ deleted: true });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' }));
};

// NUDGE — resend the invite notification to partners who haven't responded to
// a pending pact. Only the creator can nudge, and each partner is rate-limited
// to one nudge per NUDGE_COOLDOWN_MS (7 days). The response includes a
// per-partner `nudgeResults` list so the client can surface which partners were
// re-nudged and which are still in cooldown (with `nextNudgeAvailableAt`).
const nudgePact: RequestHandler = async (req: any, res: any) => {
    const {
        locale,
        userId,
        userName,
        authorization,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    const { id } = req.params;

    const pact = await Store.pacts.getById(id);
    if (!pact) {
        return handleHttpError({
            res,
            message: `Pact not found with id ${id}`,
            statusCode: 404,
        });
    }

    if (pact.creatorUserId !== userId) {
        return handleHttpError({
            res,
            message: 'Only the pact creator can send a nudge',
            statusCode: 403,
        });
    }

    if (pact.status !== 'pending') {
        return handleHttpError({
            res,
            message: 'Nudge is only available for pending pacts',
            statusCode: 400,
        });
    }

    // Find pending partner members to nudge
    const members = await Store.pactMembers.getByPactId(id);
    const pendingPartners = members.filter(
        (m: any) => m.role === 'partner' && m.status === 'pending',
    );

    if (pendingPartners.length === 0) {
        return handleHttpError({
            res,
            message: 'No pending partners to nudge',
            statusCode: 400,
        });
    }

    const NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days between nudges to the same partner
    const habitGoal = await Store.habitGoals.getById(pact.habitGoalId);
    const habitName = habitGoal?.name || 'your habit';

    const settledOutcomes = await Promise.allSettled(
        pendingPartners.map(async (partner: any) => {
            if (partner.nudgedAt) {
                const nudgedMs = new Date(partner.nudgedAt).getTime();
                if (Date.now() - nudgedMs < NUDGE_COOLDOWN_MS) {
                    return {
                        partnerId: partner.userId,
                        nudged: false,
                        reason: 'cooldown',
                        nextNudgeAvailableAt: new Date(nudgedMs + NUDGE_COOLDOWN_MS).toISOString(),
                    };
                }
            }

            // Re-dispatch invitation via the same channel as the original invite
            const dispatchResult = await dispatchPactInvitation({
                pactMemberId: partner.id,
                partnerUserId: partner.userId,
                fromUserName: userName,
                habitName,
                brandVariation,
                whiteLabelOrigin,
                locale,
            }).catch((err) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['Error dispatching pact nudge'],
                    traceArgs: { 'error.message': err?.message },
                });
                return { isOnBrand: true };
            });

            if (dispatchResult.isOnBrand) {
                // Partner is on Habits — send brand-scoped push
                sendEmailAndOrPushNotification(Store.users.findUser, req.headers, {
                    authorization,
                    locale,
                    toUserId: partner.userId,
                    type: PushNotifications.Types.pactNudge,
                    whiteLabelOrigin,
                    brandVariation,
                    partnerName: userName,
                    pactId: pact.id,
                    habitName,
                }).catch((err) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Error sending pact nudge push notification'],
                        traceArgs: { 'error.message': err?.message },
                    });
                });
            }

            await Store.pactMembers.markNudged(id, partner.userId);
            return { partnerId: partner.userId, nudged: true };
        }),
    );

    // Flatten settled results into a clean per-partner outcome list. A rejected
    // entry means the dispatch/markNudged chain threw for that partner.
    const nudgeResults = settledOutcomes.map((outcome, idx) => (
        outcome.status === 'fulfilled'
            ? outcome.value
            : { partnerId: pendingPartners[idx].userId, nudged: false, reason: 'error' }
    ));

    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Pact nudge dispatched'],
        traceArgs: { pactId: id, results: JSON.stringify(nudgeResults) },
    });

    // Return the updated pact (with habit-goal detail fields, matching the
    // get-details / accept response shape) plus refreshed members and the
    // per-partner nudge outcomes.
    const [updatedPact, updatedMembers] = await Promise.all([
        Store.pacts.getByIdWithDetails(id),
        Store.pactMembers.getByPactId(id),
    ]);
    return res.status(200).send({ ...updatedPact, members: updatedMembers, nudgeResults });
};

export {
    createPact,
    bulkInvitePact,
    getPact,
    getUserPacts,
    getActivePacts,
    getPendingInvites,
    nudgePact,
    acceptPact,
    claimPactInvite,
    declinePact,
    abandonPact,
    completePact,
    deletePact,
};
