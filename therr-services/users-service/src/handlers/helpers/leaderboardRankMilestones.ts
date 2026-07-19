import { PushNotifications } from 'therr-js-utilities/constants';
import { getBrandContext, parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import Store from '../../store';
import sendEmailAndOrPushNotification from '../../utilities/sendEmailAndOrPushNotification';
import {
    getCrossedRankMilestones,
    getLeaderboardPeriodStart,
    WEEKLY_CHAMPION_TIER_BY_MILESTONE,
} from '../../utilities/leaderboardHelpers';

/**
 * Celebrates weekly-rank milestones (top 10 / top 3 / #1) after an XP award moves a
 * user up the board: one push notification (best threshold crossed) plus weeklyChampion
 * achievement progress per crossed threshold.
 *
 * Fire-and-forget — never throws into the XP path. Crossing detection is edge-triggered
 * (was strictly outside the threshold before the award), so sitting inside the top N
 * never re-notifies; a user must fall out and climb back in to trigger again.
 *
 * Recursion note: the weeklyChampion achievement award earns XP itself, which re-enters
 * this detector. That cascade is intentional (a bonus can legitimately push the user
 * across the next threshold) and terminates because thresholds are finite and each can
 * only be crossed once per climb.
 */
const detectAndCelebrateRankMilestones = async (
    headers: InternalConfigHeaders,
    { prevPoints, newPoints }: { prevPoints: number, newPoints: number },
): Promise<any> => {
    const {
        userId,
        userName,
        locale,
        authorization,
        whiteLabelOrigin,
    } = parseHeaders(headers as Record<string, any>);
    const { brandVariation } = getBrandContext(headers as Record<string, any>);

    if (!userId || newPoints <= prevPoints) {
        return null;
    }

    try {
        const periodStart = getLeaderboardPeriodStart();
        const [prevRank, newRank] = await Promise.all([
            Store.userLeaderboardScores.getRankForScore(brandVariation, prevPoints, { periodStart }),
            Store.userLeaderboardScores.getRankForScore(brandVariation, newPoints, { periodStart }),
        ]);
        const crossedMilestones = getCrossedRankMilestones(prevRank, newRank);
        if (!crossedMilestones.length) {
            return null;
        }

        // Respect the leaderboard opt-out: a hidden user gets no rank celebrations.
        const [user] = await Store.users.getUserById(
            userId,
            ['id', 'userName', 'settingsIsLeaderboardEnabled', 'settingsIsAccountSoftDeleted'],
        );
        if (!user || user.settingsIsAccountSoftDeleted || !user.settingsIsLeaderboardEnabled) {
            return null;
        }

        // One push for the best (lowest) threshold crossed in this hop.
        sendEmailAndOrPushNotification(Store.users.findUser, headers, {
            authorization,
            fromUser: { id: userId, userName: userName || user.userName },
            locale,
            toUserId: userId,
            type: PushNotifications.Types.leaderboardRankMilestone,
            rank: newRank,
            whiteLabelOrigin,
            brandVariation,
        }, {
            shouldSendPushNotification: true,
            shouldSendEmail: false,
        }).catch((err) => logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to send leaderboard rank milestone notification'],
            traceArgs: { 'error.message': err?.message, 'user.id': userId },
        }));

        // weeklyChampion progress per crossed threshold. Lazily required to break the
        // module cycle: achievements.ts → leaderboards.ts → (this file) → achievements.ts.
        // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
        const { createOrUpdateAchievement } = require('./achievements');
        return Promise.all(crossedMilestones.map((milestone) => createOrUpdateAchievement(headers, {
            achievementClass: 'weeklyChampion',
            achievementTier: WEEKLY_CHAMPION_TIER_BY_MILESTONE[milestone],
            progressCount: 1,
        }).catch((err: Error) => logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: [`weeklyChampion award failed for milestone ${milestone}`],
            traceArgs: { 'error.message': err?.message, 'user.id': userId },
        }))));
    } catch (err: any) {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Leaderboard rank milestone detection failed'],
            traceArgs: { 'error.message': err?.message, 'user.id': userId },
        });
        return null;
    }
};

export {
    detectAndCelebrateRankMilestones,
};
