import { RequestHandler } from 'express';
import {
    ErrorCodes,
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
import {
    INudgeOutcome,
    classifyDispatchResult,
    flattenNudgeOutcomes,
    getCooldownOutcome,
} from '../utilities/pactNudgeOutcome';
import recordFunnelMetric from '../utilities/recordFunnelMetric';
import { checkHabitCapacity } from './helpers/habitCapacity';
import { ensureCompletedUserConnection } from './helpers/inviteAcceptance';
import { attachMemberStatsToPact, attachPactMemberStats } from './helpers/pactMemberStats';
import {
    validatePactParams,
    isUserInPact,
    isCreator,
    isPactRenewable,
    selectRenewalInvitees,
    shouldExpirePact,
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
            message: translate(locale, validation.errorKey || 'errorMessages.pacts.invalidParams', validation.errorParams),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    // Verify habit goal exists
    const habitGoal = await Store.habitGoals.getById(habitGoalId);
    if (!habitGoal) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habits.habitGoalNotFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    // HABITS free-tier cap — on habits tracked, not pacts created. Checked
    // before anything is written, because the tracking row this creates would
    // otherwise be counted against its own limit. Returns 402 with paywall
    // metadata so the client can route to the upgrade flow rather than swallow
    // it as a generic error.
    const capacityDenial = await checkHabitCapacity({ userId, brandVariation, locale });
    if (capacityDenial) {
        return res.status(402).send(capacityDenial);
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

            // Register the habit against the creator. Creating a pact is one of
            // the ways a habit starts being tracked, so it has to produce a
            // tracking row or the cap would only ever count solo habits and the
            // dashboard would miss the habit entirely.
            await Store.userHabits.getOrCreate(userId, habitGoalId);

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
            message: translate(locale, 'errorMessages.pacts.inviteesRequired'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    const invitees = dedupeUserIds(partnerUserIds).filter((id) => id !== userId);
    if (invitees.length === 0) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.inviteesNoneValid'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }
    if (invitees.length > MAX_BULK_INVITEES) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.inviteesTooMany', { limit: MAX_BULK_INVITEES }),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    const validation = validatePactParams({ durationDays, consequenceType, consequenceDetails });
    if (!validation.valid) {
        return handleHttpError({
            res,
            message: translate(locale, validation.errorKey || 'errorMessages.pacts.invalidParams', validation.errorParams),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    const habitGoal = await Store.habitGoals.getById(habitGoalId);
    if (!habitGoal) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habits.habitGoalNotFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    // Same free-tier habit cap as createPact. Checked before the write so the
    // tracking row created below is not counted against its own limit.
    const capacityDenial = await checkHabitCapacity({ userId, brandVariation, locale });
    if (capacityDenial) {
        return res.status(402).send(capacityDenial);
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

            // Register the habit against the creator — see createPact. Invitees
            // get their own tracking row when they accept, not now: a pending
            // invite must not consume the invitee's habit slot.
            await Store.userHabits.getOrCreate(userId, habitGoalId);

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
            return res.status(201).send(await attachMemberStatsToPact({ ...pact, members }));
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' }));
};

// READ
const getPact: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;

    return Store.pacts.getByIdWithDetails(id)
        .then(async (pact) => {
            if (!pact) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.pacts.notFound'),
                    statusCode: 404,
                    errorCode: ErrorCodes.NOT_FOUND,
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
                    message: translate(locale, 'errorMessages.pacts.notParticipant'),
                    statusCode: 403,
                    errorCode: ErrorCodes.NOT_PERMITTED,
                });
            }

            return res.status(200).send(await attachMemberStatsToPact({ ...pact, members }));
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' }));
};

/**
 * Attaches `members` to a list of pacts in a single query. Clients rely on it
 * to name the partner they're waiting on (or partnered with) without having to
 * fetch each pact's details individually.
 *
 * Members come back with derived progress stats — the pact list card renders a
 * streak and completion rate per member, and the stored columns are never
 * populated (see utilities/pactMemberStats).
 */
const withMembers = async (pacts: any[]) => {
    if (!pacts.length) {
        return pacts;
    }

    const members = await Store.pactMembers.getByPactIds(pacts.map((pact) => pact.id));
    const membersByPactId = members.reduce((acc: any, member: any) => {
        acc[member.pactId] = acc[member.pactId] || [];
        acc[member.pactId].push(member);
        return acc;
    }, {});

    return attachPactMemberStats(pacts.map((pact) => ({
        ...pact,
        members: membersByPactId[pact.id] || [],
    })));
};

/**
 * A user's pacts, newest first.
 *
 * Cycles that have been continued by a renewal are left out unless
 * `includeSuperseded=true` is asked for. A renewal is a new row on the same habit goal, so
 * without this the list grew by one row every time someone re-committed and the newest and
 * the finished cycle sat next to each other looking like duplicates. The predecessor stays
 * reachable through its successor's `renewedFromPactId`, which is what the "extended from"
 * link on the card follows.
 */
const getUserPacts: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const {
        status, limit, offset, includeSuperseded,
    } = req.query;

    return Store.pacts.getByUserId(
        userId,
        status,
        limit ? parseInt(limit, 10) : undefined,
        offset ? parseInt(offset, 10) : undefined,
        includeSuperseded === 'true' || includeSuperseded === true,
    )
        .then(withMembers)
        .then((pacts) => res.status(200).send(pacts))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' }));
};

const getActivePacts: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);

    return Store.pacts.getActivePactsByUserId(userId)
        .then(withMembers)
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
            message: translate(locale, 'errorMessages.pacts.notFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
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
            message: translate(locale, 'errorMessages.pacts.notInvitedPartner'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    // For 1:1 pacts the pact itself must be pending; for group pacts a
    // prior acceptance may have already activated the pact, but this
    // member's invite must still be pending.
    const memberInvitePending = !member || member.status === 'pending';
    if (pact.status !== 'pending' && !memberInvitePending) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.notPending'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }
    if (pact.status === 'completed' || pact.status === 'abandoned' || pact.status === 'expired') {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.notAcceptingMembers'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    // Accepting an invite starts tracking a habit, so it consumes a free-tier
    // slot like any other way of starting one. A user at their limit gets the
    // same 402 the create paths return, and the client offers archiving an
    // existing habit as the free way through — the alternative, an uncapped
    // accept path, would make the limit meaningless for anyone with friends.
    const capacityDenial = await checkHabitCapacity({ userId, brandVariation, locale });
    if (capacityDenial) {
        return res.status(402).send(capacityDenial);
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

            // Tracking rows, mirroring the streak logic above: always for the
            // accepter, and for the creator only on first acceptance (their row
            // already exists from createPact — getOrCreate makes the repeat a
            // no-op, and notably will not resurrect a row they have archived).
            const trackingPromises: Promise<any>[] = [
                Store.userHabits.getOrCreate(userId, pact.habitGoalId),
            ];
            if (pact.status === 'pending') {
                trackingPromises.push(Store.userHabits.getOrCreate(pact.creatorUserId, pact.habitGoalId));
            }
            await Promise.all(trackingPromises);

            recordFunnelMetric(MetricNames.FUNNEL_PACT_INVITE_ACCEPTED, userId, {
                brandVariation: brandVariation || '',
                via: 'in-app',
            });

            // Accountability partners are connections by definition — guarantee
            // the userConnection exists so each partner appears in the other's
            // connections list (invited-user-is-connected-to-inviter contract).
            // Fire-and-forget: a connection failure must not block acceptance.
            ensureCompletedUserConnection(pact.creatorUserId, userId).catch((err) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['Failed to ensure connection between pact partners on accept'],
                    traceArgs: { 'error.message': err?.message, pactId: id },
                });
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
    const { locale, userId } = parseHeaders(req.headers);
    const { token, code } = req.body || {};

    if (!token && !code) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.claimTokenRequired'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    const member = await Store.pactMembers.findByClaim({ token, code });
    if (!member) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.invitationNotFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    if (member.userId !== userId) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.invitationBelongsToAnother'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    if (member.claimTokenExpiresAt && new Date(member.claimTokenExpiresAt).getTime() < Date.now()) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.invitationExpired'),
            statusCode: 410,
            errorCode: ErrorCodes.BAD_REQUEST,
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
            message: translate(locale, 'errorMessages.pacts.invitationNotRedeemable'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
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
            message: translate(locale, 'errorMessages.pacts.notFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
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
            message: translate(locale, 'errorMessages.pacts.notInvitedPartner'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    const memberInvitePending = !member || member.status === 'pending';
    if (pact.status !== 'pending' && !memberInvitePending) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.notPending'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
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
            message: translate(locale, 'errorMessages.pacts.notFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    if (!isUserInPact(userId, pact.creatorUserId, pact.partnerUserId)) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.notParticipant'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    if (pact.status !== 'active') {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.notActive'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
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
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;

    const pact = await Store.pacts.getById(id);
    if (!pact) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.notFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    if (!isUserInPact(userId, pact.creatorUserId, pact.partnerUserId)) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.notParticipant'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    if (pact.status !== 'active') {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.notActive'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    // Derive final stats from check-ins/streaks and freeze them onto
    // pact_members before persisting status=completed. The stored columns are
    // the only record left once the pact is over — the derived window closes
    // with it — so this is the one place they must be written.
    const members = await Store.pactMembers.getByPactId(id);
    const { members: refreshedMembers } = await attachMemberStatsToPact({ ...pact, members });
    await Promise.all(refreshedMembers.map((m: any) => Store.pactMembers.update(m.id, {
        totalCheckins: m.totalCheckins,
        completedCheckins: m.completedCheckins,
        currentStreak: m.currentStreak,
        longestStreak: m.longestStreak,
        completionRate: m.completionRate,
    })));

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
// RENEW — the fixed-cycle restart (docs/WORK_IN_PROGRESS.md § 2.6.3).
//
// The gamification meta-analysis this is drawn from measured a Hedges' g of
// 0.42 on physical activity that decayed to 0.15 at 12-24 week follow-up: the
// effect is real and it fades, which is why the intervention has to be renewed
// on a cycle rather than run open-ended. Pacts already have the cycle
// (durationDays of 7/14/30/90); until now nothing closed it, so a pact reached
// its endDate and the app had nothing further to say.
//
// A renewal is a *new pact on the same habit goal*, not a mutation of the old
// one — the old pact keeps its own history, completion rates and dates. The
// streak is untouched by design: `habits.streaks` is keyed on
// (userId, habitGoalId), never on pactId, so it carries across the boundary on
// its own. Resetting it here would take the article's strongest mechanic away
// from the user on a day they did nothing wrong.
//
// The new row records which cycle it continues (`renewedFromPactId`) and how many
// cycles deep it is (`renewalCycleNumber`). Without that edge the list had no way
// to tell "two pacts" from "one pact, second cycle" and rendered both, so a
// re-commit read as the app duplicating the pact. It is also what makes a second
// tap idempotent: see the successor check below.
//
// Previously-active partners are re-invited as `pending`, not silently
// re-enrolled. A pact is a mutual commitment for a fixed number of days, and
// one member tapping "re-commit" must not sign the others up for another 30.
// That keeps the new pact on exactly the same pending -> activate-on-first-
// acceptance path every other pact follows.
const renewPact: RequestHandler = async (req: any, res: any) => {
    const {
        locale,
        userId,
        userName,
        authorization,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    const { id } = req.params;
    const { durationDays } = req.body || {};

    // Every read below can reject, and an async handler that rejects is an
    // unhandled rejection rather than a response — Express 4 does not catch
    // one, so the request hangs until the client gives up. The create chain
    // at the end has always had its own .catch; this extends the same
    // treatment to the reads and validation in front of it.
    try {
        const pact = await Store.pacts.getById(id);
        if (!pact) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.notFound'),
                statusCode: 404,
                errorCode: ErrorCodes.NOT_FOUND,
            });
        }

        const previousMembers = await Store.pactMembers.getByPactId(id);
        const membership = previousMembers.find((member: any) => member.userId === userId);
        const isParticipant = isUserInPact(userId, pact.creatorUserId, pact.partnerUserId) || !!membership;
        if (!isParticipant) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.notParticipant'),
                statusCode: 403,
                errorCode: ErrorCodes.NOT_PERMITTED,
            });
        }

        // Only a finished cycle can be renewed — see isPactRenewable for which
        // statuses qualify and why `abandoned` is not one of them.
        if (!isPactRenewable(pact)) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.notRenewable'),
                statusCode: 409,
                errorCode: ErrorCodes.BAD_REQUEST,
            });
        }

        // Re-commit is idempotent. If this cycle has already been continued, hand back
        // the cycle that continues it instead of starting another one.
        //
        // This is the fix for the reported "each tap adds a duplicate". A renewal that
        // has partners is created `pending` and only becomes `active` on the first
        // acceptance, so it was invisible to the live-cycle guard below — which reads
        // `status = 'active'` — and every further tap on the ended pact's still-visible
        // CTA created another parallel pending cycle. One tap, one apparent duplicate.
        //
        // 200 rather than a 409, because from the user's side the intent already
        // succeeded and a second tap is not an error to explain: they wanted another
        // cycle on this habit and there is one. The client puts the returned pact into
        // state exactly as it would a fresh renewal, which also self-heals a list that
        // had gone stale. 201-vs-200 is what tells the two apart.
        const existingRenewal = await Store.pacts.getLatestRenewalOf(pact.id);
        if (existingRenewal) {
            const existingMembers = await Store.pactMembers.getByPactId(existingRenewal.id);
            return res.status(200).send(await attachMemberStatsToPact({
                ...existingRenewal,
                members: existingMembers,
            }));
        }

        // One live cycle per habit at a time. Without this, two members each renewing
        // the same ended pact — or a renewal raced against a separately created pact on
        // the same goal — produces two parallel pacts on one goal, which the check-in
        // path would then credit twice over.
        //
        // `getUnfinishedByUserAndHabitGoal` counts `pending` as in-flight, which
        // `getActiveByUserAndHabitGoal` (the check-in credit path) deliberately does not
        // — an unanswered invite is a cycle in flight even though no check-in should be
        // credited to it. It already excludes anything past its endDate, so a
        // finished-but-unswept pact — including the very one being renewed — does not
        // come back here. The filter below is kept as a second line of defence rather
        // than as the fix: this guard is what stands between two members' simultaneous
        // taps and two parallel pacts crediting the same check-in twice, and it should
        // not silently depend on a predicate living in another file. A regression on
        // either side alone still leaves renewal correct.
        const livePacts = await Store.pacts.getUnfinishedByUserAndHabitGoal(userId, pact.habitGoalId);
        const blockingPacts = livePacts.filter((live: any) => live.id !== pact.id
            && (live.status === 'pending' || !shouldExpirePact(live.status, live.endDate ?? null)));
        if (blockingPacts.length) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.alreadyRenewed'),
                statusCode: 409,
                errorCode: ErrorCodes.BAD_REQUEST,
            });
        }

        const nextDurationDays = durationDays || pact.durationDays || 30;
        const validation = validatePactParams({
            durationDays: nextDurationDays,
            consequenceType: pact.consequenceType,
            consequenceDetails: pact.consequenceDetails,
        });
        if (!validation.valid) {
            return handleHttpError({
                res,
                message: translate(locale, validation.errorKey || 'errorMessages.pacts.invalidParams', validation.errorParams),
                statusCode: 400,
                errorCode: ErrorCodes.BAD_REQUEST,
            });
        }

        const habitGoal = await Store.habitGoals.getById(pact.habitGoalId);
        if (!habitGoal) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.habits.habitGoalNotFound'),
                statusCode: 404,
                errorCode: ErrorCodes.NOT_FOUND,
            });
        }

        // No free-tier capacity check. The cap counts *habits tracked*, and this
        // habit is already one of them — it had a pact. `getOrCreate` below will
        // not resurrect a row the user archived, so a renewal cannot smuggle an
        // extra habit past the limit either.

        const inviteeIds = selectRenewalInvitees(previousMembers, userId);

        // Keep the 1:1 shape where the last cycle had one: several read paths still
        // fall back to `partnerUserId` for pacts with no member rows. A group pact
        // leaves it null, exactly as bulkInvitePact does.
        const nextPartnerUserId = inviteeIds.length === 1 ? inviteeIds[0] : undefined;

        return Store.pacts.create({
            creatorUserId: userId,
            partnerUserId: nextPartnerUserId,
            habitGoalId: pact.habitGoalId,
            pactType: pact.pactType,
            durationDays: nextDurationDays,
            consequenceType: pact.consequenceType,
            consequenceDetails: pact.consequenceDetails,
            renewedFromPactId: pact.id,
            // Legacy rows carry no cycle number, and a pact with no recorded predecessor
            // is a first cycle as far as anything can know — so an unset value counts as 1
            // and its renewal becomes cycle 2.
            renewalCycleNumber: (pact.renewalCycleNumber || 1) + 1,
        })
            .then(async (renewed) => {
                await Store.pactMembers.create({
                    pactId: renewed.id,
                    userId,
                    role: 'creator',
                    status: 'active',
                });

                const partnerMembers = inviteeIds.length
                    ? await Store.pactMembers.createBulk(inviteeIds.map((partnerId) => ({
                        pactId: renewed.id,
                        userId: partnerId,
                        role: 'partner' as const,
                        status: 'pending',
                    })))
                    : [];

                await Store.userHabits.getOrCreate(userId, pact.habitGoalId);

                // Close out the pact being renewed if the sweep has not yet. Done
                // after the new pact exists so a failure here cannot leave the user
                // with neither an old cycle nor a new one.
                if (pact.status === 'active') {
                    await Store.pacts.expire(pact.id).catch((err) => {
                        logSpan({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: ['Failed to expire the pact being renewed'],
                            traceArgs: { 'error.message': err?.message, pactId: pact.id },
                        });
                    });
                }

                // A pact with nobody left to invite has no acceptance coming, so it
                // would sit `pending` forever. Every other pact activates on the
                // first partner acceptance, and this one keeps that rule.
                const activated = partnerMembers.length
                    ? renewed
                    : await Store.pacts.activate(renewed.id);

                recordFunnelMetric(MetricNames.FUNNEL_PACT_CREATED, userId, {
                    brandVariation: brandVariation || '',
                    isRenewal: 'true',
                });
                if (partnerMembers.length) {
                    recordFunnelMetric(MetricNames.FUNNEL_PACT_INVITE_SENT, userId, {
                        brandVariation: brandVariation || '',
                        isRenewal: 'true',
                    }, String(partnerMembers.length));
                }

                partnerMembers.forEach((member: any) => {
                    const toUserId = member.userId;
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
                            messages: ['Error dispatching pact renewal invitation'],
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
                            messages: ['Error sending pact renewal notification'],
                            traceArgs: { 'error.message': err?.message, toUserId },
                        });
                    });
                });

                Store.habitGoals.incrementUsageCount(pact.habitGoalId).catch((e) => e);

                const members = await Store.pactMembers.getByPactId(renewed.id);
                return res.status(201).send(await attachMemberStatsToPact({ ...activated, members }));
            })
            .catch((err) => handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' }));
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' });
    }
};

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
            message: translate(locale, 'errorMessages.pacts.notFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    if (pact.creatorUserId !== userId) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.nudgeCreatorOnly'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    if (pact.status !== 'pending') {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.nudgeNotPending'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
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
            message: translate(locale, 'errorMessages.pacts.nudgeNoPendingPartners'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    const habitGoal = await Store.habitGoals.getById(pact.habitGoalId);
    const habitName = habitGoal?.name || 'your habit';

    const settledOutcomes = await Promise.allSettled<INudgeOutcome>(
        pendingPartners.map(async (partner: any) => {
            const cooldownOutcome = getCooldownOutcome(partner.userId, partner.nudgedAt);
            if (cooldownOutcome) {
                return cooldownOutcome;
            }

            // Re-dispatch invitation via the same channel as the original invite.
            // A throw here used to be swallowed into `{ isOnBrand: true }`, which pushed the
            // partner down the on-brand path and then marked them nudged — reporting success
            // and burning the 7-day cooldown on a nudge that failed.
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
                return null;
            });

            const outcome = classifyDispatchResult(partner.userId, dispatchResult);

            if (!outcome.nudged) {
                // Nothing went out, so the cooldown must not start — otherwise a partner with no
                // reachable channel locks the creator out for a week for no benefit.
                return outcome;
            }

            if (dispatchResult?.isOnBrand) {
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
            return outcome;
        }),
    );

    // Flatten settled results into a clean per-partner outcome list. A rejected
    // entry means the dispatch/markNudged chain threw for that partner.
    const nudgeResults = flattenNudgeOutcomes(
        settledOutcomes,
        pendingPartners.map((partner: any) => partner.userId),
    );

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
    const hydratedPact = await attachMemberStatsToPact({ ...updatedPact, members: updatedMembers });
    return res.status(200).send({ ...hydratedPact, nudgeResults });
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
    renewPact,
    deletePact,
};
