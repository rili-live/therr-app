/**
 * The demotion-risk producer: one pass inside the daily habits digest.
 *
 * While leagues are running, each weekly close relegates the bottom of every league but the lowest
 * (utilities/leaderboardLeagues.ts). The league board draws that as a line. This pass tells the
 * people currently under it, on the days it can still change: "You're #14 in your league, 12 XP
 * short of safety. The week ends in 3 days — check in today so you don't drop down a league".
 *
 * ## Who gets one
 *
 * A user the close would relegate if the week ended now, who:
 *   - has not muted leaderboard alerts (`settingsPushLeaderboardAlerts`),
 *   - has not completed a check-in yet on their own local today (the ask is a check-in, and a
 *     user who already did one has done what the push would ask), and
 *   - is not inside their quiet hours at send time (sent now, as the podium nudge is: the gap is
 *     a snapshot and deferring it lets the board move under the number it quotes).
 *
 * The zone is computed with `computeLeagueResults` over this week's live participants — the same
 * function and the same input the weekly close uses — so the push and the line on the board never
 * disagree about who is under it. Users who muted alerts are filtered only after ranking: they
 * are still on the board, and ranking without them would move the line.
 *
 * ## When
 *
 * Only on the digests in the last DEMOTION_RISK_MAX_HOURS_LEFT hours of the week (Friday through
 * Sunday). One per user per day, keyed on the period and the UTC date, so a re-run, a retry or a
 * manual curl of the same day sends nothing twice. Brand is pinned by the digest (HABITS).
 */

import { PushNotifications } from 'therr-js-utilities/constants';
import { getLeaderboardLeagueIndex } from 'therr-js-utilities/config';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import enqueueNotification from '../../utilities/enqueueNotification';
import { isInQuietHoursAt } from '../../utilities/localReminderSchedule';
import { getLocalDate, resolveCheckinTimeZone } from '../../utilities/dailyStreak';
import {
    DEMOTION_RISK_MAX_HOURS_LEFT,
    getDemotionRiskDedupeKey,
    getHoursUntilReset,
    getLeaderboardPeriodStart,
    PODIUM_WITHIN_REACH_MIN_HOURS_LEFT,
} from '../../utilities/leaderboardHelpers';
import { computeLeagueResults, ILeagueResult } from '../../utilities/leaderboardLeagues';
import { areLeaguesActiveForBrand } from './leaderboardPeriods';

/**
 * Kill switch. Defaults on: at most three pushes per user per week, and only to people with
 * something to lose. A flag because it is a send-volume increase.
 */
export const areDemotionRiskNudgesEnabled = (): boolean => process.env.LEADERBOARD_DEMOTION_NUDGES_ENABLED !== 'false';

export interface IDemotionRiskCounters {
    /** True only on a run that actually ranked the leagues (a late-week day, leagues active). */
    demotionPassRan: boolean;
    /** Under a demotion line right now, before any filter. */
    demotionCandidates: number;
    demotionNudgesQueued: number;
    /** Already queued today. A second run of the same day lands entirely here. */
    demotionNudgesDeduped: number;
    demotionSkippedMuted: number;
    demotionSkippedCheckedIn: number;
    demotionSkippedQuietHours: number;
    demotionErrors: number;
}

export const EMPTY_DEMOTION_RISK_COUNTERS: IDemotionRiskCounters = {
    demotionPassRan: false,
    demotionCandidates: 0,
    demotionNudgesQueued: 0,
    demotionNudgesDeduped: 0,
    demotionSkippedMuted: 0,
    demotionSkippedCheckedIn: 0,
    demotionSkippedQuietHours: 0,
    demotionErrors: 0,
};

export interface IDemotionRiskCandidate {
    userId: string;
    /** Competition rank within the league — what the board shows beside the row. */
    rank: number;
    /** XP to tie the lowest score above the line, which is enough: ties at the line are spared. */
    pointsBehind: number;
}

/**
 * Everyone the close would relegate if the week ended now, with the gap to safety. Pure.
 */
export const getDemotionRiskCandidates = (brand: string, results: ILeagueResult[]): IDemotionRiskCandidate[] => {
    const isDemoted = (result: ILeagueResult) => (
        getLeaderboardLeagueIndex(brand, result.leagueTo) < getLeaderboardLeagueIndex(brand, result.leagueFrom)
    );

    // The lowest score that stays, per league: the line a demoted user has to reach.
    const safeFloorByLeague = new Map<string, number>();
    results.forEach((result) => {
        if (isDemoted(result)) {
            return;
        }
        const floor = safeFloorByLeague.get(result.leagueFrom);
        if (floor === undefined || result.score < floor) {
            safeFloorByLeague.set(result.leagueFrom, result.score);
        }
    });

    return results
        .filter(isDemoted)
        .map((result) => ({
            userId: result.userId,
            rank: result.placement,
            // Every league that relegates has at least five members and relegates at most a fifth,
            // so there is always someone above the line; Math.max guards the type, not a real case.
            pointsBehind: Math.max(1, (safeFloorByLeague.get(result.leagueFrom) ?? result.score + 1) - result.score),
        }));
};

export const runDemotionRiskPass = async (
    { brandVariation, whiteLabelOrigin }: { brandVariation: string, whiteLabelOrigin?: string },
    now: Date = new Date(),
): Promise<IDemotionRiskCounters> => {
    const counters: IDemotionRiskCounters = { ...EMPTY_DEMOTION_RISK_COUNTERS };

    const hoursLeft = getHoursUntilReset(now);
    if (!areDemotionRiskNudgesEnabled()
        || hoursLeft > DEMOTION_RISK_MAX_HOURS_LEFT
        || hoursLeft < PODIUM_WITHIN_REACH_MIN_HOURS_LEFT) {
        return counters;
    }
    if (!(await areLeaguesActiveForBrand(brandVariation, now))) {
        return counters;
    }
    counters.demotionPassRan = true;

    const periodStart = getLeaderboardPeriodStart(now);
    const participants = await Store.userLeaderboardScores.getEligibleParticipantsForPeriod(brandVariation, periodStart);
    const candidates = getDemotionRiskCandidates(brandVariation, computeLeagueResults(brandVariation, participants));
    counters.demotionCandidates = candidates.length;
    if (!candidates.length) {
        return counters;
    }

    const users: {
        id: string,
        settingsLocale?: string | null,
        settingsTimezone?: string | null,
        settingsQuietHoursStart?: string | null,
        settingsQuietHoursEnd?: string | null,
        settingsPushLeaderboardAlerts?: boolean | null,
    }[] = await Store.users.findUsers({ ids: candidates.map((candidate) => candidate.userId) }, [
        'id',
        'settingsLocale',
        'settingsTimezone',
        'settingsQuietHoursStart',
        'settingsQuietHoursEnd',
        'settingsPushLeaderboardAlerts',
    ]);
    const userById = new Map(users.map((user) => [user.id, user]));

    // Mutes on an explicit false only; null is a row that predates the column.
    const reachable = candidates.filter((candidate) => {
        const user = userById.get(candidate.userId);
        if (!user || user.settingsPushLeaderboardAlerts === false) {
            counters.demotionSkippedMuted += 1;
            return false;
        }
        return true;
    });

    const checkedIn = await Store.habitCheckins.getUsersCompletedOnLocalDates(reachable.map((candidate) => ({
        userId: candidate.userId,
        localDate: getLocalDate(resolveCheckinTimeZone(userById.get(candidate.userId)?.settingsTimezone), now),
    })));

    const dedupeKey = getDemotionRiskDedupeKey(periodStart, now);
    await Promise.all(reachable.map((candidate) => {
        // Present: `reachable` kept only candidates with a user row.
        const user = userById.get(candidate.userId) || { id: candidate.userId };
        if (checkedIn.has(candidate.userId)) {
            counters.demotionSkippedCheckedIn += 1;
            return Promise.resolve();
        }
        if (isInQuietHoursAt(user, now)) {
            counters.demotionSkippedQuietHours += 1;
            return Promise.resolve();
        }

        return enqueueNotification({
            brandVariation,
            toUserId: candidate.userId,
            type: PushNotifications.Types.leaderboardDemotionRisk,
            dedupeKey,
            payload: {
                // The recipient's own locale — the scheduler request's header locale is not theirs.
                locale: user.settingsLocale || 'en-us',
                whiteLabelOrigin: whiteLabelOrigin || '',
                rank: candidate.rank,
                pointsBehind: candidate.pointsBehind,
                hoursLeft,
            },
        }).then((outcome) => {
            if (outcome === 'queued') {
                counters.demotionNudgesQueued += 1;
            } else if (outcome === 'duplicate') {
                counters.demotionNudgesDeduped += 1;
            } else {
                counters.demotionErrors += 1;
            }
        });
    })).catch((err: any) => {
        counters.demotionErrors += 1;
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [err?.message, 'Habits digest: failed to queue demotion-risk nudges'],
            traceArgs: { 'pushNotification.brandVariation': String(brandVariation) },
        });
    });

    return counters;
};
