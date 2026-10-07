import { PushNotifications } from 'therr-js-utilities/constants';
import { getBrandContext, parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import Store from '../../store';
import sendEmailAndOrPushNotification from '../../utilities/sendEmailAndOrPushNotification';
import enqueueNotification, { EnqueueOutcome } from '../../utilities/enqueueNotification';
import { isInQuietHoursAt } from '../../utilities/localReminderSchedule';
import {
    getCrossedRankMilestones,
    getLeaderboardPeriodStart,
    getRankLostDedupeKey,
    LEADERBOARD_DISPLACEMENT_THRESHOLD,
    WEEKLY_CHAMPION_TIER_BY_MILESTONE,
} from '../../utilities/leaderboardHelpers';

/**
 * Tells whoever the climber just bumped off the podium (#3 → #4) who passed them.
 *
 * Only called when the climber crossed into the top 3, which is exactly when someone can
 * fall out of it: if the climber was already inside, no one at #3 was ahead of their old
 * score. Queued rather than sent inline — the recipient isn't watching for this, and the
 * queue gives a per-day dedup (see getRankLostDedupeKey) plus the per-user daily cap, so a
 * see-saw race at #3 costs each user at most one push a day.
 *
 * The climber's afternoon is often the recipient's night, so a recipient inside their own
 * quiet hours is skipped rather than woken. Skipped, not deferred: "you're #4" is a snapshot
 * that the morning may no longer bear out, and skipping leaves the day's dedupe key unspent,
 * so a later displacement while they are awake still reaches them.
 */
const notifyUsersDisplacedFromPodium = async ({
    brandVariation,
    periodStart,
    climber,
    prevPoints,
    newPoints,
    whiteLabelOrigin,
    now = new Date(),
}: {
    brandVariation: string,
    periodStart: string,
    climber: { id: string, userName?: string },
    prevPoints: number,
    newPoints: number,
    whiteLabelOrigin?: string,
    now?: Date,
}): Promise<(EnqueueOutcome | 'quiet-hours')[]> => {
    const displaced = await Store.userLeaderboardScores.getUsersDisplacedFromRank(brandVariation, {
        periodStart,
        rank: LEADERBOARD_DISPLACEMENT_THRESHOLD,
        climberUserId: climber.id,
        prevPoints,
        newPoints,
    });
    if (!displaced.length) {
        return [];
    }
    const dedupeKey = getRankLostDedupeKey(LEADERBOARD_DISPLACEMENT_THRESHOLD, now);

    return Promise.all(displaced.map((displacedUser) => (isInQuietHoursAt(displacedUser, now)
        ? Promise.resolve('quiet-hours' as const)
        : enqueueNotification({
            brandVariation,
            toUserId: displacedUser.userId,
            type: PushNotifications.Types.leaderboardRankLost,
            dedupeKey,
            payload: {
            // The worker rebuilds the send from this payload alone, so the copy's locale
            // must be the recipient's — not the climber's, whose request this is.
                locale: displacedUser.settingsLocale || 'en-us',
                whiteLabelOrigin: whiteLabelOrigin || '',
                fromUserId: climber.id,
                fromUser: { id: climber.id, userName: climber.userName },
                rank: LEADERBOARD_DISPLACEMENT_THRESHOLD + 1,
            },
        }))));
};

/**
 * Celebrates weekly-rank milestones (top 10 / top 3 / #1) after an XP award moves a
 * user up the board: one push notification (best threshold crossed) plus weeklyChampion
 * achievement progress per crossed threshold. Crossing into the top 3 also queues a
 * leaderboardRankLost push for whoever that climb knocked from #3 to #4.
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
        // Both ranks exclude the user's own row so they mean the same thing: "how many
        // OTHERS are ahead of this score". The award has already been written by the time
        // this runs, so counting self would make prevRank one worse than it really was —
        // enough to make a user sitting exactly at rank 1/3/10 re-cross that threshold on
        // every single XP award.
        const [prevRank, newRank] = await Promise.all([
            Store.userLeaderboardScores.getRankForScore(brandVariation, prevPoints, { periodStart, excludeUserId: userId }),
            Store.userLeaderboardScores.getRankForScore(brandVariation, newPoints, { periodStart, excludeUserId: userId }),
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

        if (crossedMilestones.includes(LEADERBOARD_DISPLACEMENT_THRESHOLD)) {
            notifyUsersDisplacedFromPodium({
                brandVariation,
                periodStart,
                climber: { id: userId, userName: userName || user.userName },
                prevPoints,
                newPoints,
                whiteLabelOrigin,
            }).catch((err) => logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Failed to queue leaderboard rank-lost notifications'],
                traceArgs: { 'error.message': err?.message, 'user.id': userId },
            }));
        }

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
    notifyUsersDisplacedFromPodium,
};
