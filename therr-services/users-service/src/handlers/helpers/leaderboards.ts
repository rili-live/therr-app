import { getBrandContext } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import Store from '../../store';
import { getLeaderboardPeriodStart } from '../../utilities/leaderboardHelpers';
import { detectAndCelebrateRankMilestones } from './leaderboardRankMilestones';

/**
 * Fire-and-forget XP award into the current weekly leaderboard period. Never throws —
 * leaderboard writes must not fail the user-facing action that earned the XP. Callers
 * are responsible for idempotency (award only on genuinely new activity).
 *
 * After a successful increment, rank-milestone detection runs on the before/after
 * points (push + weeklyChampion achievement when the user climbs into the top 10/3/1).
 */
const awardLeaderboardPoints = (
    headers: InternalConfigHeaders,
    points: number,
    label: string,
): Promise<any> => {
    const userId = headers['x-userid'];
    if (!userId || !points || points <= 0) {
        return Promise.resolve(null);
    }
    const { brandVariation } = getBrandContext(headers as Record<string, any>);

    return Store.userLeaderboardScores
        .incrementPoints(brandVariation, userId, getLeaderboardPeriodStart(), points)
        .then((rows) => {
            const newPoints = Number(rows?.[0]?.points);
            if (Number.isFinite(newPoints) && newPoints > 0) {
                detectAndCelebrateRankMilestones(headers, {
                    prevPoints: newPoints - Math.round(points),
                    newPoints,
                }).catch(() => null); // detector logs internally; never propagate
            }
            return rows;
        })
        .catch((err) => {
            logSpan({
                level: 'warn',
                messageOrigin: 'API_SERVER',
                messages: [`Leaderboard XP award failed: ${label}`],
                traceArgs: {
                    'error.message': err?.message,
                    'user.id': userId,
                    'leaderboard.points': points,
                },
            });
            return null;
        });
};

export {
    awardLeaderboardPoints,
};
