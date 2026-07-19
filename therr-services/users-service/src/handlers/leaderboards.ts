import { RequestHandler } from 'express';
import { getBrandContext, parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import { getLeaderboardPeriodStart, getLeaderboardPeriodEnd } from '../utilities/leaderboardHelpers';

const DEFAULT_PAGE_SIZE = 25;

/**
 * GET /users/leaderboards?scope=global|connections&period=week|allTime&limit=N
 *
 * Ranked XP board for the requesting user's brand. Weekly boards cover the current
 * Monday-anchored UTC week; all-time sums every period. The `connections` scope
 * restricts the pool to the requester's accepted connections (plus themself).
 * `currentUser` always reflects the requester — including their rank when they fall
 * outside the returned page — so clients can render a sticky "you" row.
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

        return res.status(200).send({
            entries: entries.map((entry, index) => ({
                ...entry,
                rank: index + 1,
                isRequestingUser: entry.userId === userId,
            })),
            currentUser: {
                userId,
                points: currentUserPoints,
                rank: currentUserRank,
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

export {
    getLeaderboard,
};
