import { RequestHandler } from 'express';
import { PushNotifications } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import sendEmailAndOrPushNotification from '../utilities/sendEmailAndOrPushNotification';
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

            // Award creator achievements for creating a pact (HABITS brand only — allow-list filters)
            awardPactPioneerCreatedAchievement(req.headers, 1);
            awardAccountabilitySelfAchievement(req.headers, 1);

            // If partner is specified, create their member entry and send notification
            if (partnerUserId) {
                await Store.pactMembers.create({
                    pactId: pact.id,
                    userId: partnerUserId,
                    role: 'partner',
                    status: 'pending',
                });

                // Send push notification to partner
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

            // Verify user is participant
            if (!isUserInPact(userId, pact.creatorUserId, pact.partnerUserId)) {
                return handleHttpError({
                    res,
                    message: 'You are not a participant in this pact',
                    statusCode: 403,
                });
            }

            // Get members
            const members = await Store.pactMembers.getByPactId(id);

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

    if (pact.partnerUserId !== userId) {
        return handleHttpError({
            res,
            message: 'You are not the invited partner for this pact',
            statusCode: 403,
        });
    }

    if (pact.status !== 'pending') {
        return handleHttpError({
            res,
            message: 'Pact is not pending',
            statusCode: 400,
        });
    }

    // Activate the pact
    return Store.pacts.activate(id)
        .then(async (updatedPact) => {
            // Activate both members
            await Promise.all([
                Store.pactMembers.activate(id, pact.creatorUserId),
                Store.pactMembers.activate(id, userId),
            ]);

            // Create streaks for both users
            await Promise.all([
                Store.streaks.create({
                    userId: pact.creatorUserId,
                    habitGoalId: pact.habitGoalId,
                    pactId: id,
                }),
                Store.streaks.create({
                    userId,
                    habitGoalId: pact.habitGoalId,
                    pactId: id,
                }),
            ]);

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

    if (pact.partnerUserId !== userId) {
        return handleHttpError({
            res,
            message: 'You are not the invited partner for this pact',
            statusCode: 403,
        });
    }

    if (pact.status !== 'pending') {
        return handleHttpError({
            res,
            message: 'Pact is not pending',
            statusCode: 400,
        });
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

export {
    createPact,
    getPact,
    getUserPacts,
    getActivePacts,
    getPendingInvites,
    acceptPact,
    declinePact,
    abandonPact,
    completePact,
    deletePact,
};
