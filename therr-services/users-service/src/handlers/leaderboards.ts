import { RequestHandler } from 'express';
import { ErrorCodes } from 'therr-js-utilities/constants';
import { getBrandContext, parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import { getLeaderboardPeriodStart, getLeaderboardPeriodEnd, withCompetitionRanks } from '../utilities/leaderboardHelpers';
import { isDateString } from '../utilities/dailyStreak';

const DEFAULT_PAGE_SIZE = 25;

/**
 * GET /users/leaderboards?scope=global|connections&period=week|allTime&limit=N
 *
 * Ranked XP board for the requesting user's brand. Weekly boards cover the current
 * Monday-anchored UTC week; all-time sums every period. The `connections` scope
 * restricts the pool to the requester's accepted connections (plus themself).
 * `currentUser` always reflects the requester — including their rank when they fall
 * outside the returned page — so clients can render a sticky "you" row. Entry ranks use
 * competition ranking so they agree with the requester's own rank on a tie.
 */
const getLeaderboard: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);

    if (!userId) {
        return handleHttpError({
            res,
            message: 'Unauthorized',
            statusCode: 401,
        });
    }

    const scope = req.query.scope === 'connections' ? 'connections' : 'global';
    const period = req.query.period === 'allTime' ? 'allTime' : 'week';
    const limit = parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE;
    const periodStart = period === 'week' ? getLeaderboardPeriodStart() : undefined;

    try {
        let userIds: string[] | undefined;
        if (scope === 'connections') {
            const connectionIds = await Store.userConnections.getAcceptedConnectionUserIds(userId);
            userIds = [...connectionIds, userId];
        }

        const [entries, currentUserPoints] = await Promise.all([
            Store.userLeaderboardScores.getTopScores(brandVariation, { periodStart, limit, userIds }),
            Store.userLeaderboardScores.getUserScore(brandVariation, userId, periodStart),
        ]);
        const currentUserRank = await Store.userLeaderboardScores
            .getRankForScore(brandVariation, currentUserPoints, { periodStart, userIds });

        // The 🔥 chip: each row's app-level daily streak, in one query for the whole page.
        // Absent from the map means no streak row yet, which the client renders as no chip.
        // Best-effort — the board is the point, the chip is decoration.
        const dailyStreaksByUserId = await Store.userDailyStreaks
            .getCurrentStreaksForUsers([...new Set([...entries.map((entry) => entry.userId), userId])])
            .catch(() => ({} as Record<string, number>));

        return res.status(200).send({
            entries: withCompetitionRanks(entries).map((entry) => ({
                ...entry,
                isRequestingUser: entry.userId === userId,
                dailyStreak: dailyStreaksByUserId[entry.userId] || 0,
            })),
            currentUser: {
                userId,
                points: currentUserPoints,
                rank: currentUserRank,
                dailyStreak: dailyStreaksByUserId[userId] || 0,
            },
            scope,
            period,
            periodStart: periodStart || null,
            periodEnd: periodStart ? getLeaderboardPeriodEnd(periodStart) : null,
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:LEADERBOARDS_ROUTES:ERROR' });
    }
};

/**
 * POST /users/leaderboards/periods/:periodStart/acknowledge
 *
 * The user has seen their placement for a closed period — the full-screen celebration for a
 * podium finish, or the inline card on the leaderboard for anything below it. Idempotent: a
 * second call (a double-tap, a retry, "See leaderboard" then "Done") is a no-op, and an
 * already-acknowledged or unknown period answers 200 with `acknowledged: false` rather than an
 * error, since there is nothing for the client to do about either.
 *
 * The period id is its Monday-anchored UTC `periodStart` — see leaderboardHelpers.
 */
const acknowledgeLeaderboardPeriod: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);
    const { periodStart } = req.params;

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }
    if (!isDateString(periodStart)) {
        return handleHttpError({
            res,
            message: 'periodStart (YYYY-MM-DD) is required',
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    try {
        const acknowledged = await Store.leaderboardPeriodResults.acknowledge(brandVariation, userId, periodStart);
        return res.status(200).send({
            periodId: periodStart,
            acknowledged: !!acknowledged,
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:LEADERBOARDS_ROUTES:ERROR' });
    }
};

export {
    getLeaderboard,
    acknowledgeLeaderboardPeriod,
};
