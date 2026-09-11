import { RequestHandler } from 'express';
import {
    ErrorCodes, HabitGoalType, MetricNames, PushNotifications,
} from 'therr-js-utilities/constants';
import { getBrandContext, parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import sendEmailAndOrPushNotification from '../utilities/sendEmailAndOrPushNotification';
import enqueueNotification from '../utilities/enqueueNotification';
import { resolveUserDisplayName } from '../utilities/notificationNames';
import {
    getTodayDateString,
    checkMilestoneReached,
    countMissedDaysForStreak,
    isComebackStart,
    isPhoenixMoment,
    normalizeDateString,
    MAX_GRACE_PERIOD_DAYS,
} from '../utilities/streakHelpers';
import { isUserInPact } from '../utilities/pactHelpers';
import { computeNextPactStreak, hasReachedMajority } from '../utilities/pactStreak';
import { canReadProofs, serializeProofs } from '../utilities/checkinProofs';
import moderateProofs from '../utilities/moderateProofs';
import { copyProofToPublicBucket, deleteSharedCheckinPublicObject } from '../utilities/shareCheckinMedia';
import { createReactions } from '../api/reactions';
import { checkIsMediaSafeForWork } from './helpers';
import recordFunnelMetric from '../utilities/recordFunnelMetric';
import { resolvePactPartnerIds } from './helpers/pactPartners';
import {
    awardStreakAchievement,
    awardConsistencyAchievement,
    awardResilienceComebackAchievement,
    awardAccountabilityWingAchievement,
    scanMultiHabitConsistency,
    headersForOtherUser,
} from './helpers/awardHabitAchievements';
import { awardLeaderboardPoints } from './helpers/leaderboards';
import { LeaderboardXpValues } from '../utilities/leaderboardHelpers';

// CREATE
const createCheckin: RequestHandler = async (req: any, res: any) => {
    const {
        locale,
        userId,
        userName,
        authorization,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    const {
        pactId,
        habitGoalId,
        scheduledDate,
        status,
        notes,
        selfRating,
        difficultyRating,
        proofMedias,
    } = req.body;

    const hasProof = Array.isArray(proofMedias) && proofMedias.length > 0;

    if (!habitGoalId) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habitCheckins.habitGoalRequired'),
            statusCode: 400,
        });
    }

    const checkinDate = scheduledDate || getTodayDateString();

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

    // Resolve which pacts this check-in counts toward.
    //
    // Clients log a check-in against a habit goal, never a pact — the pact is
    // a property of the goal — so an explicit `pactId` is the exception. Until
    // this resolution existed nothing downstream of it ever ran: check-in rows
    // were written with a null pactId (leaving GET /pacts/:pactId/checkins
    // permanently empty), partners were never told their accountability
    // partner checked in, and mid-pact Wing Person credit never landed.
    let pacts: any[] = [];
    if (pactId) {
        const requestedPact = await Store.pacts.getById(pactId);
        if (!requestedPact) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.notFound'),
                statusCode: 404,
                errorCode: ErrorCodes.NOT_FOUND,
            });
        }

        // Authorize via pact_members as well: a group pact has no
        // partnerUserId, so its invitees would otherwise be refused a check-in
        // on their own pact.
        const membership = await Store.pactMembers.getByPactAndUser(pactId, userId);
        const isParticipant = isUserInPact(userId, requestedPact.creatorUserId, requestedPact.partnerUserId)
            || membership?.status === 'active';
        if (!isParticipant) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.notParticipant'),
                statusCode: 403,
                errorCode: ErrorCodes.NOT_PERMITTED,
            });
        }

        pacts = [requestedPact];
    } else {
        pacts = await Store.pacts.getActiveByUserAndHabitGoal(userId, habitGoalId);
    }

    // `habit_checkins.pactId` is singular. When a goal backs several active
    // pacts the row is attributed to the earliest-started one (the store
    // orders by startDate); every pact is still credited below.
    const attributedPactId = pactId || pacts[0]?.id;

    // Make sure the habit is registered as tracked. Every deliberate entry
    // point already does this, so in practice the row exists — but a check-in
    // is proof the user is tracking the habit, and a habit that is being
    // checked into while missing from `user_habits` would be invisible on the
    // dashboard and uncounted by the free-tier cap. getOrCreate will not
    // resurrect a row the user archived.
    await Store.userHabits.getOrCreate(userId, habitGoalId);

    // Create or update the checkin
    return Store.habitCheckins.createOrUpdate({
        userId,
        pactId: attributedPactId,
        habitGoalId,
        scheduledDate: checkinDate,
        status: status || 'completed',
        completedAt: status === 'completed' ? new Date() : undefined,
        notes,
        selfRating,
        difficultyRating,
        hasProof,
    })
        .then(async (checkin) => {
            // Persist any attached proofs
            if (hasProof) {
                await Store.proofs.deleteByCheckinId(checkin.id);
                const createdProofs = await Store.proofs.createMany(
                    proofMedias
                        .filter((m: any) => m && m.path)
                        .map((m: any) => ({
                            userId,
                            checkinId: checkin.id,
                            habitGoalId,
                            pactId: attributedPactId,
                            mediaType: m.type === 'video' ? 'video' : 'image',
                            mediaPath: m.path,
                            thumbnailPath: m.thumbnailPath,
                            fileSizeBytes: m.fileSizeBytes,
                            durationSeconds: m.durationSeconds,
                        })),
                );

                // Fire-and-forget: the check-in commits on the first tap and must not
                // wait on a third-party content check, nor fail when it is down. See
                // `utilities/moderateProofs` for why this is not awaited.
                moderateProofs(createdProofs).catch((err) => logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['proof moderation dispatch failed'],
                    traceArgs: {
                        'error.message': err?.message,
                        'checkin.id': checkin.id,
                    },
                }));
            }

            // Freeze accounting for this request. Reported back on the 201 so
            // the client can confirm in-app rather than leaving the user to
            // infer from an unchanged streak number that something caught them.
            let graceDaysConsumed = 0;
            let streakSavedByFreeze = 0;

            // If completed, update streak
            if (checkin.status === 'completed') {
                let streak = await Store.streaks.getOrCreate(userId, habitGoalId, attributedPactId);
                const lastCompletedStr = streak.lastCompletedDate
                    ? normalizeDateString(streak.lastCompletedDate)
                    : null;

                // Same-day duplicate submission (createOrUpdate updated the
                // existing checkin row): the streak was already credited for
                // this date — incrementing again would double-count it, and
                // history/achievements/partner pushes already fired. Proofs
                // and notes were still updated above.
                if (lastCompletedStr === checkinDate) {
                    return res.status(201).send(checkin);
                }

                // First completion for this habit+date: the upsert only returns
                // contributedToStreak=false before this block has ever run for the row, so
                // re-submitted check-ins (edits, added proofs) never double-award XP.
                const isFirstCompletionForDate = !checkin.contributedToStreak;
                if (isFirstCompletionForDate) {
                    // Direct XP hook — base XP for every completed check-in, independent of the
                    // achievement ladder. Streak/consistency achievements below add their own
                    // XP on top when they progress (bonus stacking is intentional, and their
                    // milestone-rung gating means they don't fire on every check-in).
                    awardLeaderboardPoints(req.headers, LeaderboardXpValues.habitCheckin, 'habit-checkin');
                }

                // Gap handling — streak freezes. When required days were
                // missed since the last completion, consume available grace
                // days ("streak freezes") to preserve the streak; otherwise
                // record the miss and reset before crediting today.
                if (lastCompletedStr && streak.currentStreak > 0) {
                    const missedDays = countMissedDaysForStreak(
                        lastCompletedStr,
                        checkinDate,
                        habitGoal.frequencyType || 'daily',
                        habitGoal.targetDaysOfWeek,
                    );

                    // Majority-day protection: a day the user's pact carried (a majority of its
                    // active members checked in) is not held against the user's personal streak.
                    // The group won that day; the rules should not reset a member for a day they
                    // were covered on. Only days strictly inside the gap count — the endpoints are
                    // the user's own last completion and today's check-in. Freezes are spent only
                    // on days that remain missed after this forgiveness.
                    const coveredDays = pacts.length
                        ? await Store.pactStreakDays.countCoveredDatesForPacts(
                            pacts.map((p: any) => p.id),
                            lastCompletedStr,
                            checkinDate,
                        )
                        : 0;
                    const effectiveMissed = Math.max(0, missedDays - coveredDays);

                    if (effectiveMissed > 0) {
                        const graceAvailable = (streak.gracePeriodDays || 0) - (streak.graceDaysUsed || 0);
                        if (effectiveMissed <= graceAvailable) {
                            // eslint-disable-next-line no-plusplus
                            for (let i = 0; i < effectiveMissed; i++) {
                                // eslint-disable-next-line no-await-in-loop
                                await Store.streaks.useGraceDay(streak.id);
                            }
                            await Store.streaks.recordGraceUsed(streak.id, userId, checkinDate, streak.currentStreak);
                            graceDaysConsumed = effectiveMissed;
                            streakSavedByFreeze = streak.currentStreak;
                        } else {
                            await Store.streaks.recordMissed(streak.id, userId, checkinDate, streak.currentStreak);
                            await Store.streaks.resetStreak(streak.id);
                        }
                        streak = await Store.streaks.getById(streak.id);
                    }
                }

                // Announce the freeze at the moment it is spent.
                //
                // The mechanic has always worked silently, which makes it
                // worthless as a rule: "build in the miss" only changes
                // behaviour if the user learns the first bad day happened
                // inside the rules rather than ending them. Both channels are
                // deliberate — the toast reaches the user who is holding the
                // phone right now (they just tapped check in), the push reaches
                // the same user later on a device that was backgrounded.
                if (graceDaysConsumed > 0) {
                    sendEmailAndOrPushNotification(Store.users.findUser, req.headers, {
                        authorization,
                        fromUser: { id: userId, userName },
                        locale,
                        toUserId: userId,
                        type: PushNotifications.Types.streakFreezeUsed,
                        streakCount: streakSavedByFreeze,
                        habitId: habitGoalId,
                        habitName: habitGoal.name,
                        freezeDaysUsed: graceDaysConsumed,
                        freezesRemaining: Math.max(
                            0,
                            (streak.gracePeriodDays || 0) - (streak.graceDaysUsed || 0),
                        ),
                        whiteLabelOrigin,
                        brandVariation,
                    }).catch((err) => {
                        logSpan({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: ['Error sending streak freeze used notification'],
                            traceArgs: { 'error.message': err?.message, habitGoalId },
                        });
                    });
                }

                const streakBefore = streak.currentStreak;
                const longestBefore = streak.longestStreak;
                await Store.streaks.incrementStreak(streak.id, checkinDate);
                const updatedStreak = await Store.streaks.getById(streak.id);

                recordFunnelMetric(MetricNames.FUNNEL_HABIT_CHECKIN, userId, {
                    brandVariation: brandVariation || '',
                    streak: String(updatedStreak.currentStreak),
                });

                // Record history and check for milestone
                await Store.streaks.recordCompletion(
                    streak.id,
                    userId,
                    checkin.id,
                    checkinDate,
                    streakBefore,
                    updatedStreak.currentStreak,
                );

                // Award achievements (HABITS only; brand allow-list filters non-HABITS calls)
                const goalType: HabitGoalType = (habitGoal.goalType as HabitGoalType) || 'build_good';
                awardStreakAchievement(req.headers, {
                    goalType,
                    currentStreak: updatedStreak.currentStreak,
                });
                awardConsistencyAchievement(req.headers, updatedStreak.currentStreak);
                // Multi-habit consistency (Two At Once / Triple Threat / All Things at Once).
                // No-op if the user has fewer than 2 active habits or no perfect 7-day window.
                scanMultiHabitConsistency(req.headers, userId, checkinDate);
                if (isComebackStart(streakBefore, updatedStreak.currentStreak, longestBefore)) {
                    awardResilienceComebackAchievement(req.headers, 1);
                }
                if (isPhoenixMoment(updatedStreak.currentStreak, longestBefore)) {
                    awardResilienceComebackAchievement(req.headers, 1);
                }

                const milestone = checkMilestoneReached(updatedStreak.currentStreak);
                if (milestone) {
                    if (isFirstCompletionForDate) {
                        awardLeaderboardPoints(
                            req.headers,
                            milestone * LeaderboardXpValues.streakMilestoneMultiplier,
                            `streak-milestone:${milestone}`,
                        );
                    }

                    // Earn a streak freeze at every 7+ day milestone (capped).
                    // This is the Duolingo-style loss-aversion loop: freezes
                    // are earned by consistency and spent automatically when
                    // a day slips, softening the all-or-nothing cliff.
                    if (milestone >= 7 && (updatedStreak.gracePeriodDays || 0) < MAX_GRACE_PERIOD_DAYS) {
                        await Store.streaks.update(streak.id, {
                            gracePeriodDays: (updatedStreak.gracePeriodDays || 0) + 1,
                        }).catch((err) => {
                            logSpan({
                                level: 'error',
                                messageOrigin: 'API_SERVER',
                                messages: ['Failed to award streak freeze at milestone'],
                                traceArgs: { 'error.message': err?.message, streakId: streak.id },
                            });
                        });
                    }

                    await Store.streaks.recordMilestone(
                        streak.id,
                        userId,
                        checkin.id,
                        checkinDate,
                        streakBefore,
                        milestone,
                    );

                    // Send milestone notification.
                    //
                    // The copy is "{streakCount} days strong on {habitName}" and
                    // this call used to pass neither, so it rendered as
                    // " days strong on " — `translate` only substitutes the
                    // params it is handed.
                    sendEmailAndOrPushNotification(Store.users.findUser, req.headers, {
                        authorization,
                        fromUser: { id: userId, userName },
                        locale,
                        toUserId: userId,
                        type: PushNotifications.Types.streakMilestone,
                        whiteLabelOrigin,
                        brandVariation,
                        habitName: habitGoal.name,
                        habitGoalId,
                        streakCount: updatedStreak.currentStreak,
                    }).catch((err) => {
                        logSpan({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: ['Error sending streak milestone notification'],
                            traceArgs: { 'error.message': err?.message },
                        });
                    });

                    // Partner credit (Wing Person ladder) when the milestone is
                    // also a new longest streak. The completePact handler awards
                    // wing-person credit when the partner *finishes* the pact at
                    // ≥80% — this fills the gap mid-pact: every time the
                    // pact-mate sets a new personal best, the partner is part of
                    // why. Skip when there's no pact (solo habits only credit
                    // the user's own ladder).
                    const isNewLongestStreak = updatedStreak.longestStreak > longestBefore;
                    if (isNewLongestStreak && pacts.length) {
                        (await resolvePactPartnerIds(pacts, userId)).forEach((partnerForMilestoneId) => {
                            awardAccountabilityWingAchievement(
                                headersForOtherUser(req.headers, partnerForMilestoneId),
                                1,
                            );
                        });
                    }
                }

                // Credit every pact this habit goal backs.
                //
                // The pact endpoints derive member progress from check-ins and
                // streaks rather than reading these columns (see
                // utilities/pactMemberStats), so the counters are no longer
                // load-bearing for display — but completePact freezes the
                // derived values over them, and keeping them warm means the
                // stored row isn't wildly stale in the meantime.
                if (pacts.length) {
                    const ownMemberships = await Promise.all(
                        pacts.map((p: any) => Store.pactMembers.getByPactAndUser(p.id, userId)),
                    );
                    await Promise.all(ownMemberships
                        .filter((member: any) => member)
                        .map(async (member: any) => {
                            await Store.pactMembers.incrementCheckinStats(
                                member.id,
                                true,
                                updatedStreak.currentStreak,
                            );
                            return Store.pactMembers.updateCompletionRate(member.id);
                        }));

                    // Shared pact streak. This check-in may be the one that pushes a pact's
                    // active members to a majority for today — if so, credit the day once and
                    // advance the group's streak. Evaluated on every qualifying check-in (not
                    // just the majority-crossing one) because whichever member's check-in
                    // crosses the threshold cannot be known in advance; the ledger's UNIQUE
                    // (pactId, streakDate) makes the credit idempotent, so only the first one
                    // through advances the streak and the rest no-op.
                    await Promise.all(pacts.map(async (p: any) => {
                        const [activeMemberCount, completedTodayCount] = await Promise.all([
                            Store.pactMembers.countActiveByPactId(p.id),
                            Store.habitCheckins.countCompletedActiveMembersForPact(p.id, habitGoalId, checkinDate),
                        ]);

                        if (!hasReachedMajority(completedTodayCount, activeMemberCount)) {
                            return;
                        }

                        const credited = await Store.pactStreakDays.create({
                            pactId: p.id,
                            streakDate: checkinDate,
                            activeMemberCount,
                            completedCount: completedTodayCount,
                        });
                        // Someone else already won the day for this pact — nothing to advance.
                        if (!credited) {
                            return;
                        }

                        const nextPactStreak = computeNextPactStreak({
                            lastPactStreakDate: p.lastPactStreakDate,
                            currentPactStreak: p.currentPactStreak || 0,
                            streakDate: checkinDate,
                            frequencyType: habitGoal.frequencyType,
                            targetDaysOfWeek: habitGoal.targetDaysOfWeek,
                        });
                        await Store.pacts.updatePactStreak(p.id, {
                            currentPactStreak: nextPactStreak,
                            longestPactStreak: Math.max(nextPactStreak, Number(p.longestPactStreak) || 0),
                            lastPactStreakDate: checkinDate,
                        });
                    })).catch((err) => {
                        // Best-effort: the personal check-in has already committed and been
                        // credited. A failure computing the shared streak must not fail the
                        // check-in — the next qualifying check-in re-evaluates the same day.
                        logSpan({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: ['Error evaluating shared pact streak'],
                            traceArgs: { 'error.message': err?.message, habitGoalId },
                        });
                    });

                    // Notify partners. Someone in two pacts on this same habit
                    // is told once, not once per pact.
                    //
                    // Queued rather than sent inline. This is the one habits
                    // notification whose volume is driven by *other people* —
                    // every partner check-in on every shared habit produces one
                    // — so it is the type most able to arrive as a burst, and
                    // inline sending has neither dedup nor the per-user daily
                    // cap. The worker drains within a tick (30s), so it stays
                    // effectively immediate while gaining both, plus the
                    // minimum spacing in notificationQueueWorker.
                    //
                    // The dedupe key names the checker and the habit, not the
                    // recipient — the recipient is already in the UNIQUE
                    // (brandVariation, userId, dedupeKey) constraint. Two
                    // partners checking in on the same habit today are two
                    // notifications; the same partner checking in twice is one.
                    const partnerIds = await resolvePactPartnerIds(pacts, userId, {
                        onlyCelebrating: true,
                    });
                    if (partnerIds.length) {
                        const checkerDisplayName = await resolveUserDisplayName(userId);
                        await Promise.all(partnerIds.map((partnerId) => enqueueNotification({
                            brandVariation,
                            toUserId: partnerId,
                            type: PushNotifications.Types.partnerCheckedIn,
                            dedupeKey: `partner-checked-in:${habitGoalId}:${userId}:${checkinDate}`,
                            payload: {
                                // The worker rebuilds the send from this payload
                                // alone — this request's headers are gone by the
                                // time it drains.
                                locale,
                                whiteLabelOrigin,
                                fromUserId: userId,
                                partnerName: checkerDisplayName,
                                habitName: habitGoal.name,
                                habitGoalId,
                                pactId: pacts[0]?.id,
                                streakCount: updatedStreak.currentStreak,
                                // One habit, so a "Check In" button on this
                                // notification has something unambiguous to do —
                                // which is the point: "don't let them lap you"
                                // should be answerable from the tray.
                                habitCount: 1,
                            },
                        }).catch((err) => {
                            logSpan({
                                level: 'error',
                                messageOrigin: 'API_SERVER',
                                messages: ['Error queueing partner checkin notification'],
                                traceArgs: { 'error.message': err?.message, partnerId },
                            });
                            return 'failed' as const;
                        })));
                    }
                }

                // Mark checkin as contributing to streak
                await Store.habitCheckins.update(checkin.id, { contributedToStreak: true });
            }

            return res.status(201).send({
                ...checkin,
                graceDaysConsumed,
                streakSavedByFreeze,
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

// SHARE — turn a check-in with a proof photo into a public post (main.thoughts).
//
// This is the opt-in step past pact visibility (§ 2.6.2): a check-in's proof is owner-only in
// the private bucket, so making one public is not a flag flip but a copy. The proof image is
// copied into the public bucket, moderated *on that public copy* (fail-closed — a share can
// wait on a content check in a way the check-in tap deliberately cannot), and only then does a
// public `main.thoughts` row get created carrying the copy. The check-in's `sharedThoughtId`
// records the link so a repeat share is a no-op and the calendar day can deep-link to the post.
//
// brandVariation flows from the request headers onto the thought, so a HABITS share is a HABITS
// thought — which BRAND_THOUGHTS_VISIBILITY already surfaces in the Therr feed too, and keeps
// out of other niche feeds. No visibility change is needed here for cross-brand reach.
//
// It is read with getBrandContext, NOT parseHeaders, and the difference is not cosmetic:
// parseHeaders returns '' for a missing x-brand-variation header, and ThoughtsStore.create
// does not extend BrandScopedStore, so nothing asserts the value — withBrandOnInsert would
// write brandVariation = '' straight into main.thoughts. The share would return 201, the
// check-in would be stamped `sharedThoughtId` (making a retry a permanent no-op), and the
// post would be invisible in every feed forever, since every read filters on a known brand.
// getBrandContext defaults to THERR, which is what handlers/thoughts.ts does for the same call.
// Pins an author's own share to the top of their stream. Distributor scores are hot scores
// (`(replies + 1) / (ageHours + offset)^gravity`, times a boost of a few ×), so anything in
// the thousands is already unreachable; a million leaves room without approaching float limits.
// A later distributor run that re-selects the post overwrites this with a real score, which is
// the intended hand-off into the ranked stream.
const OWN_SHARE_RELEVANCE_SCORE = 1_000_000;

const shareCheckin: RequestHandler = async (req: any, res: any) => {
    const {
        locale,
        userId,
    } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);
    const { id } = req.params;
    const { message } = req.body;

    let checkin;
    try {
        checkin = await Store.habitCheckins.getById(id);
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' });
    }

    // Ownership is the whole access story for a proof image (see checkinProofs.canReadProofs):
    // only the check-in's owner may promote it to a public post.
    const { allowed, error } = canReadProofs(checkin, userId);
    if (!allowed) {
        return error === 'notFound'
            ? handleHttpError({
                res,
                message: translate(locale, 'errorMessages.habitCheckins.notFound'),
                statusCode: 404,
                errorCode: ErrorCodes.NOT_FOUND,
            })
            : handleHttpError({
                res,
                message: translate(locale, 'errorMessages.habitCheckins.notAuthorizedToView'),
                statusCode: 403,
                errorCode: ErrorCodes.NOT_PERMITTED,
            });
    }

    // Already shared: return the existing link rather than minting a second post. This is what
    // makes a double-tap or a retry safe.
    if (checkin.sharedThoughtId) {
        return res.status(200).send({ sharedThoughtId: checkin.sharedThoughtId, alreadyShared: true });
    }

    // A public post needs an image. The proof is what keeps the feed on-topic (a check-in with a
    // photo), so a check-in with no image proof cannot be shared.
    let proofs: any[] = [];
    try {
        proofs = checkin.hasProof ? await Store.proofs.getByCheckinId(id) : [];
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' });
    }
    const imageProof = (proofs || []).find((p) => p && p.mediaPath && p.mediaType !== 'video');
    if (!imageProof) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habitCheckins.shareRequiresImage'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    const habitGoal = await Store.habitGoals.getById(checkin.habitGoalId).catch(() => null);
    const altText = habitGoal?.name ? String(habitGoal.name).substring(0, 255) : '';
    // Lead-in text: prefer what the client sent, then the check-in note, then the habit name.
    // The thought column truncates to 255 itself; this just avoids sending an empty post.
    const leadIn = (message || checkin.notes || habitGoal?.name || '').toString();

    let publicMedia: { path: string; type: string };
    try {
        publicMedia = await copyProofToPublicBucket(userId, checkin.id, imageProof.mediaPath);
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' });
    }

    // Moderate the PUBLIC copy before it can be seen. `checkIsMediaSafeForWork` fails closed
    // (returns false on any signing / Sightengine error), which is the right asymmetry for a
    // share gate: refuse rather than risk exposing unmoderated content.
    const isSafeForWork = await checkIsMediaSafeForWork([publicMedia]).catch(() => false);
    if (!isSafeForWork) {
        await deleteSharedCheckinPublicObject(publicMedia.path);
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habitCheckins.shareModerationFailed'),
            statusCode: 422,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    let thought;
    try {
        [thought] = await Store.thoughts.create(brandVariation, {
            fromUserId: userId as any,
            locale,
            isPublic: true,
            message: leadIn,
            medias: [{ path: publicMedia.path, type: publicMedia.type, altText }],
        });
    } catch (err: any) {
        // The public copy is already written; leave it for the bucket lifecycle rule rather than
        // deleting it, since a transient thought-write failure is retryable and the next attempt
        // overwrites the same deterministic path.
        return handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' });
    }

    // ThoughtsStore.create does not honour `isPublic: true` unconditionally — it runs the lead-in
    // text through `isTextUnsafe` and forces `isPublic: false` / `isMatureContent: true` when that
    // trips. A private thought is not a share: nothing renders it in any feed. Left unchecked the
    // handler would still stamp `sharedThoughtId` and answer 201, so the user is told the check-in
    // was shared, sees it nowhere, and can never retry — the repeat-share short-circuit below makes
    // the failure permanent. Treat it as the moderation rejection it is: roll the post back, drop
    // the public copy, and reuse the same 422 the image check returns.
    if (thought && thought.isPublic === false) {
        await Store.thoughts.deleteThoughts({ fromUserId: userId, ids: [thought.id] })
            .catch((rollbackErr: any) => logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Failed to roll back a non-public shared check-in post'],
                traceArgs: {
                    'error.message': rollbackErr?.message,
                    'checkin.id': checkin.id,
                    'thought.id': thought.id,
                    'user.id': userId,
                },
            }));
        await deleteSharedCheckinPublicObject(publicMedia.path);

        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habitCheckins.shareModerationFailed'),
            statusCode: 422,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    // Writing `sharedThoughtId` is the whole dedupe mechanism — it is what makes the repeat-share
    // short-circuit above work. If the post is created and this write fails, the post is live and
    // public but unreferenced, so the user's next share mints a SECOND post and nothing anywhere
    // records why. Roll the post back so a retry is clean; if even the rollback fails, log the id
    // so the orphan is findable instead of silent.
    try {
        await Store.habitCheckins.update(checkin.id, { sharedThoughtId: thought.id });
    } catch (err: any) {
        await Store.thoughts.deleteThoughts({ fromUserId: userId, ids: [thought.id] })
            .catch((rollbackErr: any) => logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Orphaned shared check-in post: link write failed and rollback failed'],
                traceArgs: {
                    'error.message': rollbackErr?.message,
                    'checkin.id': checkin.id,
                    'thought.id': thought.id,
                    'user.id': userId,
                },
            }));

        return handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' });
    }

    // The post exists, but the feed only renders thoughts the viewer has an activated
    // reaction row for, and those rows are written by the distributor — at login, or on a
    // 15-minute-gated ping — and only when the post wins a slot on hot score. So without this
    // the author's own share is invisible to them for anywhere from minutes to forever.
    //
    // Two things happen together, mirroring what createThought already does for a composed post:
    //  - activate the post for the author, with a relevance score that pins it above anything
    //    the distributor scores (hot scores are single digits: `(replies + 1) / age^gravity`,
    //    and the stream orders `relevanceScore DESC NULLS LAST`, so an unscored row would sink
    //    to the bottom and a later refresh would drop it off page one again);
    //  - re-read the post through the same `find` the feed uses, so the response carries the
    //    author fields (`fromUserName`, `fromUserMedia`, ...) the card renders from, and the
    //    client can insert it into its persisted stream as-is.
    //
    // Both are best-effort: the share has already committed and is idempotent, so a failure
    // here must not surface as a failed share. The fallback is the raw row, which the client
    // can still render (the author is the viewer, so their own name and avatar are local).
    const [feedThought, activation] = await Promise.all([
        Store.thoughts.find(brandVariation, [thought.id], { limit: 1 }, { withUser: true, withReplies: true })
            .then((result) => result?.thoughts?.[0] || thought)
            .catch(() => thought),
        createReactions([thought.id], req.headers, { [thought.id]: OWN_SHARE_RELEVANCE_SCORE })
            .catch((err: any) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['Failed to activate a shared check-in post for its author'],
                    traceArgs: {
                        'error.message': err?.message,
                        'checkin.id': checkin.id,
                        'thought.id': thought.id,
                        'user.id': userId,
                    },
                });
                return undefined;
            }),
    ]);
    const activated: any = activation && !('error' in activation) ? activation : undefined;
    const reaction = activated?.created?.[0] || activated?.updated?.[0] || { userHasActivated: true };

    return res.status(201).send({
        thought: {
            ...feedThought,
            reaction,
            likeCount: 0,
            replies: feedThought.replies || [],
        },
        sharedThoughtId: thought.id,
    });
};

// READ
const getCheckin: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;

    return Store.habitCheckins.getById(id)
        .then((checkin) => {
            if (!checkin) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.habitCheckins.notFound'),
                    statusCode: 404,
                    errorCode: ErrorCodes.NOT_FOUND,
                });
            }

            // Verify ownership
            if (checkin.userId !== userId) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.habitCheckins.notAuthorizedToView'),
                    statusCode: 403,
                    errorCode: ErrorCodes.NOT_PERMITTED,
                });
            }

            return res.status(200).send(checkin);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

/**
 * The proof images attached to one check-in.
 *
 * Split out of `getCheckin` rather than folded into it, and deliberately not
 * attached to `GET /range`: the month grid only needs `hasProof`, which the
 * check-in row already carries, so the calendar stays at one query per month
 * and the paths are fetched only for a day the user actually opens.
 */
const getCheckinProofs: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;

    // `id` is a uuid column, so a malformed path segment makes Postgres throw
    // rather than return no rows. Express 4 does not catch a rejected handler
    // promise and this service registers no async wrapper, so a bare `await`
    // here answers nothing at all -- the request hangs to timeout and surfaces
    // as an unhandled rejection. Every sibling handler routes its failure
    // through `handleHttpError`; this one has to do it explicitly.
    let checkin;
    try {
        checkin = await Store.habitCheckins.getById(id);
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' });
    }

    const { allowed, error } = canReadProofs(checkin, userId);

    if (!allowed) {
        return error === 'notFound'
            ? handleHttpError({
                res,
                message: translate(locale, 'errorMessages.habitCheckins.notFound'),
                statusCode: 404,
                errorCode: ErrorCodes.NOT_FOUND,
            })
            : handleHttpError({
                res,
                message: translate(locale, 'errorMessages.habitCheckins.notAuthorizedToView'),
                statusCode: 403,
                errorCode: ErrorCodes.NOT_PERMITTED,
            });
    }

    // `hasProof` is maintained by the write path, so an absent flag means there
    // is nothing to fetch — skip the query rather than round-tripping for an
    // empty set on every dayless tap.
    if (!checkin.hasProof) {
        return res.status(200).send({ proofs: [] });
    }

    return Store.proofs.getByCheckinId(id)
        .then((proofs) => res.status(200).send({ proofs: serializeProofs(proofs) }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

const getTodayCheckins: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { habitGoalId } = req.query;

    const today = getTodayDateString();

    return Store.habitCheckins.getByUserAndDate(userId, today, habitGoalId)
        .then((checkins) => res.status(200).send(checkins))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

const getCheckinsByDateRange: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { startDate, endDate, habitGoalId } = req.query;

    if (!startDate || !endDate) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habitCheckins.dateRangeRequired'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    return Store.habitCheckins.getByUserAndDateRange(
        userId,
        startDate,
        endDate,
        habitGoalId,
    )
        .then((checkins) => res.status(200).send(checkins))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

const getPactCheckins: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { pactId } = req.params;
    const { limit, offset } = req.query;

    // Verify user is participant in pact
    const pact = await Store.pacts.getById(pactId);
    if (!pact) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.notFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    if (pact.creatorUserId !== userId && pact.partnerUserId !== userId) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.notParticipant'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    return Store.habitCheckins.getByPactId(
        pactId,
        limit ? parseInt(limit, 10) : undefined,
        offset ? parseInt(offset, 10) : undefined,
    )
        .then((checkins) => res.status(200).send(checkins))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

// UPDATE
const updateCheckin: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;

    const {
        status,
        notes,
        selfRating,
        difficultyRating,
    } = req.body;

    // Verify ownership
    const existingCheckin = await Store.habitCheckins.getById(id);
    if (!existingCheckin) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habitCheckins.notFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    if (existingCheckin.userId !== userId) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habitCheckins.notAuthorizedToUpdate'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    return Store.habitCheckins.update(id, {
        status,
        notes,
        selfRating,
        difficultyRating,
        completedAt: status === 'completed' && !existingCheckin.completedAt ? new Date() : undefined,
    })
        .then((checkin) => res.status(200).send(checkin))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

const skipCheckin: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;
    const { notes } = req.body;

    // Verify ownership
    const existingCheckin = await Store.habitCheckins.getById(id);
    if (!existingCheckin) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habitCheckins.notFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    if (existingCheckin.userId !== userId) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habitCheckins.notAuthorizedToUpdate'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    return Store.habitCheckins.skip(id, notes)
        .then((checkin) => res.status(200).send(checkin))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

// DELETE
const deleteCheckin: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;

    return Store.habitCheckins.delete(id, userId)
        .then((deleted) => {
            if (!deleted) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.habitCheckins.notFoundOrNotAuthorizedToDelete'),
                    statusCode: 404,
                    errorCode: ErrorCodes.NOT_FOUND,
                });
            }
            return res.status(200).send({ deleted: true });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' }));
};

export {
    createCheckin,
    shareCheckin,
    getCheckin,
    getCheckinProofs,
    getTodayCheckins,
    getCheckinsByDateRange,
    getPactCheckins,
    updateCheckin,
    skipCheckin,
    deleteCheckin,
};
