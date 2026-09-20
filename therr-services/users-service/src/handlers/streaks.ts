import { RequestHandler } from 'express';
import { ErrorCodes } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import {
    getStreakRiskLevel,
    getMilestoneProgress,
    formatStreakDisplay,
    getStreakEmoji,
    DEFAULT_STARTING_GRACE_PERIOD_DAYS,
} from '../utilities/streakHelpers';
import { getLocalDate, resolveCheckinTimeZone } from '../utilities/dailyStreak';

// READ
const getStreak: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;

    return Store.streaks.getById(id)
        .then((streak) => {
            if (!streak) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.streaks.notFound'),
                    statusCode: 404,
                    errorCode: ErrorCodes.NOT_FOUND,
                });
            }

            // Verify ownership
            if (streak.userId !== userId) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.streaks.notAuthorizedToView'),
                    statusCode: 403,
                    errorCode: ErrorCodes.NOT_PERMITTED,
                });
            }

            // Add computed fields
            const riskLevel = getStreakRiskLevel(streak.lastCompletedDate, 'daily');
            const milestoneProgress = getMilestoneProgress(streak.currentStreak);

            return res.status(200).send({
                ...streak,
                riskLevel,
                milestoneProgress,
                displayText: formatStreakDisplay(streak.currentStreak),
                emoji: getStreakEmoji(streak.currentStreak),
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:STREAKS_ROUTES:ERROR' }));
};

const getUserStreaks: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { isActive } = req.query;

    let activeFilter: boolean | undefined;
    if (isActive === 'true') {
        activeFilter = true;
    } else if (isActive === 'false') {
        activeFilter = false;
    }

    return Store.streaks.getByUserId(userId, activeFilter)
        .then((streaks) => {
            // Add computed fields to each streak
            const enrichedStreaks = streaks.map((streak) => ({
                ...streak,
                riskLevel: getStreakRiskLevel(streak.lastCompletedDate, 'daily'),
                milestoneProgress: getMilestoneProgress(streak.currentStreak),
                displayText: formatStreakDisplay(streak.currentStreak),
                emoji: getStreakEmoji(streak.currentStreak),
            }));

            return res.status(200).send(enrichedStreaks);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:STREAKS_ROUTES:ERROR' }));
};

const getActiveStreaks: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);

    return Store.streaks.getActiveStreaksByUserId(userId)
        .then((streaks) => {
            const enrichedStreaks = streaks.map((streak) => ({
                ...streak,
                riskLevel: getStreakRiskLevel(streak.lastCompletedDate, 'daily'),
                milestoneProgress: getMilestoneProgress(streak.currentStreak),
                displayText: formatStreakDisplay(streak.currentStreak),
                emoji: getStreakEmoji(streak.currentStreak),
            }));

            return res.status(200).send(enrichedStreaks);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:STREAKS_ROUTES:ERROR' }));
};

const getStreakByHabit: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { habitGoalId } = req.params;

    return Store.streaks.getByUserAndHabit(userId, habitGoalId)
        .then((streak) => {
            if (!streak) {
                // No streak row yet — the ladder is created on the first check-in
                // (or on pact acceptance), so every habit looks like this between
                // being created and being done once.
                //
                // The placeholder has to carry the *same shape* a real row does,
                // not just the fields this handler happens to compute. It used to
                // omit the two grace columns, and the mobile habit detail screen
                // renders `gracePeriodDays - graceDaysUsed` into its "Streak
                // Freezes Left" tile — `undefined - undefined` is NaN, so a
                // brand-new solo habit told the user "NaN" until they checked in.
                //
                // The values are the ones `StreaksStore.create` is about to write,
                // which also makes them true rather than merely non-NaN: a habit
                // with no check-ins does start with one freeze.
                return res.status(200).send({
                    userId,
                    habitGoalId,
                    currentStreak: 0,
                    longestStreak: 0,
                    gracePeriodDays: DEFAULT_STARTING_GRACE_PERIOD_DAYS,
                    graceDaysUsed: 0,
                    lastCompletedDate: null,
                    isActive: false,
                    riskLevel: 'safe',
                    milestoneProgress: getMilestoneProgress(0),
                    displayText: formatStreakDisplay(0),
                    emoji: getStreakEmoji(0),
                });
            }

            return res.status(200).send({
                ...streak,
                riskLevel: getStreakRiskLevel(streak.lastCompletedDate, 'daily'),
                milestoneProgress: getMilestoneProgress(streak.currentStreak),
                displayText: formatStreakDisplay(streak.currentStreak),
                emoji: getStreakEmoji(streak.currentStreak),
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:STREAKS_ROUTES:ERROR' }));
};

const getPactStreaks: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { pactId } = req.params;

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

    return Store.streaks.getByPactId(pactId)
        .then((streaks) => {
            const enrichedStreaks = streaks.map((streak) => ({
                ...streak,
                riskLevel: getStreakRiskLevel(streak.lastCompletedDate, 'daily'),
                milestoneProgress: getMilestoneProgress(streak.currentStreak),
                displayText: formatStreakDisplay(streak.currentStreak),
                emoji: getStreakEmoji(streak.currentStreak),
            }));

            return res.status(200).send(enrichedStreaks);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:STREAKS_ROUTES:ERROR' }));
};

const getStreakHistory: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;
    const { limit } = req.query;

    // Verify ownership
    const streak = await Store.streaks.getById(id);
    if (!streak) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.streaks.notFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    if (streak.userId !== userId) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.streaks.notAuthorizedToViewHistory'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    return Store.streaks.getHistoryByStreakId(id, limit ? parseInt(limit, 10) : undefined)
        .then((history) => res.status(200).send(history))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:STREAKS_ROUTES:ERROR' }));
};

const getMilestones: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);

    return Store.streaks.getMilestoneHistory(userId)
        .then((milestones) => res.status(200).send(milestones))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:STREAKS_ROUTES:ERROR' }));
};

const getTopStreaks: RequestHandler = async (req: any, res: any) => {
    const { limit } = req.query;

    return Store.streaks.getTopStreaks(limit ? parseInt(limit, 10) : 10)
        .then((streaks) => {
            const enrichedStreaks = streaks.map((streak) => ({
                ...streak,
                displayText: formatStreakDisplay(streak.currentStreak),
                emoji: getStreakEmoji(streak.currentStreak),
            }));

            return res.status(200).send(enrichedStreaks);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:STREAKS_ROUTES:ERROR' }));
};

// UPDATE
const useGraceDay: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;

    // Verify ownership
    const streak = await Store.streaks.getById(id);
    if (!streak) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.streaks.notFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
        });
    }

    if (streak.userId !== userId) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.streaks.notAuthorizedToModify'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
    }

    // Check if grace period available
    if (streak.gracePeriodDays <= 0 || streak.graceDaysUsed >= streak.gracePeriodDays) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.streaks.noGraceDaysAvailable'),
            statusCode: 400,
        });
    }

    // The history row is dated in the user's own zone, matching the habit day the check-in
    // path stamps — a freeze spent at 19:00 on the 15th has to file under the 15th, or it
    // covers a day the streak logic never looks at.
    const [graceUser] = await Store.users.getUserById(userId, ['id', 'settingsTimezone']).catch(() => [] as any[]);
    const today = getLocalDate(resolveCheckinTimeZone(graceUser?.settingsTimezone, req.query?.timeZone));

    return Store.streaks.useGraceDay(id)
        .then(async (updatedStreak) => {
            // Record the grace day usage
            await Store.streaks.recordGraceUsed(
                id,
                userId,
                today,
                updatedStreak.currentStreak,
            );

            return res.status(200).send({
                ...updatedStreak,
                riskLevel: getStreakRiskLevel(updatedStreak.lastCompletedDate, 'daily'),
                milestoneProgress: getMilestoneProgress(updatedStreak.currentStreak),
                displayText: formatStreakDisplay(updatedStreak.currentStreak),
                emoji: getStreakEmoji(updatedStreak.currentStreak),
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:STREAKS_ROUTES:ERROR' }));
};

export {
    getStreak,
    getUserStreaks,
    getActiveStreaks,
    getStreakByHabit,
    getPactStreaks,
    getStreakHistory,
    getMilestones,
    getTopStreaks,
    useGraceDay,
};
