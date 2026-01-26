import { RequestHandler } from 'express';
import { parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import {
    getTodayDateString,
    getStreakRiskLevel,
    getMilestoneProgress,
    formatStreakDisplay,
    getStreakEmoji,
} from '../utilities/streakHelpers';

// READ
const getStreak: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { id } = req.params;

    return Store.streaks.getById(id)
        .then((streak) => {
            if (!streak) {
                return handleHttpError({
                    res,
                    message: `Streak not found with id ${id}`,
                    statusCode: 404,
                });
            }

            // Verify ownership
            if (streak.userId !== userId) {
                return handleHttpError({
                    res,
                    message: 'Not authorized to view this streak',
                    statusCode: 403,
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
                // Return empty streak data if none exists
                return res.status(200).send({
                    currentStreak: 0,
                    longestStreak: 0,
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
    const { userId } = parseHeaders(req.headers);
    const { pactId } = req.params;

    // Verify user is participant in pact
    const pact = await Store.pacts.getById(pactId);
    if (!pact) {
        return handleHttpError({
            res,
            message: 'Pact not found',
            statusCode: 404,
        });
    }

    if (pact.creatorUserId !== userId && pact.partnerUserId !== userId) {
        return handleHttpError({
            res,
            message: 'You are not a participant in this pact',
            statusCode: 403,
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
    const { userId } = parseHeaders(req.headers);
    const { id } = req.params;
    const { limit } = req.query;

    // Verify ownership
    const streak = await Store.streaks.getById(id);
    if (!streak) {
        return handleHttpError({
            res,
            message: `Streak not found with id ${id}`,
            statusCode: 404,
        });
    }

    if (streak.userId !== userId) {
        return handleHttpError({
            res,
            message: 'Not authorized to view this streak history',
            statusCode: 403,
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
            message: `Streak not found with id ${id}`,
            statusCode: 404,
        });
    }

    if (streak.userId !== userId) {
        return handleHttpError({
            res,
            message: 'Not authorized to modify this streak',
            statusCode: 403,
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

    return Store.streaks.useGraceDay(id)
        .then(async (updatedStreak) => {
            // Record the grace day usage
            await Store.streaks.recordGraceUsed(
                id,
                userId,
                getTodayDateString(),
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
