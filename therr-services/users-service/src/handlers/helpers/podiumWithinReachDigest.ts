/**
 * The podium-within-reach producer: one pass inside the daily habits digest.
 *
 * On the last digest before the weekly reset (a UTC Sunday — see isLastDigestBeforeReset),
 * every user a short XP gap from tying #3 gets one push: "You're #5, just 30 XP behind #3.
 * The leaderboard resets in 9 hours". A deadline plus a closable gap is the strongest reason
 * the board gives anyone to come back today, and it reaches the people the top-3 race
 * otherwise ignores.
 *
 * ## Why it rides the daily digest
 *
 * There is one Cloud Scheduler firing and no spare job (docs/CROSS_REPO_INTEGRATION.md § 4).
 * The digest already lands ~9–10 hours before the Monday 00:00 UTC reset on Sundays, which is
 * the window this needs, so the pass just returns early on every other day.
 *
 * ## Sent now, not at a local time
 *
 * The gap is a snapshot: deferring the push to each user's evening would let the board move
 * under it and cite a number that is no longer true. So it is queued for immediate delivery,
 * and a user who is inside their quiet hours at that instant is skipped rather than woken —
 * for the zones where that happens (roughly UTC+7 and east), the reset is a few hours later
 * anyway. Copy counts hours, not "tonight", for the same reason.
 *
 * ## Who gets one
 *
 * Eligible board members (opted in, not deleted) scoring within PODIUM_WITHIN_REACH_MAX_GAP
 * of the third-highest score, who have not muted leaderboard alerts
 * (`settingsPushLeaderboardAlerts`). The dedupe key is the period, so a re-run, a retry or a
 * manual curl on the same Sunday sends nothing twice.
 *
 * ## Leagues
 *
 * While leagues are active for the brand (handlers/helpers/leaderboardPeriods.ts
 * `areLeaguesActiveForBrand`), "the podium" is each league's own: the pass runs once per tier,
 * against that tier's #3. A user is in exactly one tier, so the per-period dedupe key still means
 * at most one nudge each.
 */

import { PushNotifications } from 'therr-js-utilities/constants';
import { getLeaderboardTiers } from 'therr-js-utilities/config';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import enqueueNotification from '../../utilities/enqueueNotification';
import { isInQuietHoursAt } from '../../utilities/localReminderSchedule';
import {
    getHoursUntilReset,
    getLeaderboardPeriodStart,
    getPodiumWithinReachDedupeKey,
    isLastDigestBeforeReset,
    LEADERBOARD_DISPLACEMENT_THRESHOLD,
    PODIUM_WITHIN_REACH_MAX_GAP,
    PODIUM_WITHIN_REACH_MIN_HOURS_LEFT,
} from '../../utilities/leaderboardHelpers';
import { areLeaguesActiveForBrand } from './leaderboardPeriods';

/**
 * Kill switch. Defaults on: it is at most one push per user per week. It stays a flag because
 * it is a send-volume increase, and this is the lever that stops it without a deploy.
 */
export const arePodiumNudgesEnabled = (): boolean => process.env.LEADERBOARD_PODIUM_NUDGES_ENABLED !== 'false';

export interface IPodiumWithinReachCounters {
    /** True only on the run that actually looked at the board (the Sunday one). */
    podiumPassRan: boolean;
    podiumCandidates: number;
    podiumNudgesQueued: number;
    /** Already queued this period. A second run of the Sunday lands entirely here. */
    podiumNudgesDeduped: number;
    /** Skipped because the user was inside their quiet hours at send time. */
    podiumNudgesSkippedQuietHours: number;
    podiumErrors: number;
}

export const EMPTY_PODIUM_WITHIN_REACH_COUNTERS: IPodiumWithinReachCounters = {
    podiumPassRan: false,
    podiumCandidates: 0,
    podiumNudgesQueued: 0,
    podiumNudgesDeduped: 0,
    podiumNudgesSkippedQuietHours: 0,
    podiumErrors: 0,
};

/**
 * One podium pool: the whole brand board, or one league of it. Returns that pool's counters.
 */
const runPodiumPassForPool = async ({
    brandVariation,
    whiteLabelOrigin,
    periodStart,
    hoursLeft,
    league,
    now,
}: {
    brandVariation: string,
    whiteLabelOrigin?: string,
    periodStart: string,
    hoursLeft: number,
    league?: string,
    now: Date,
}): Promise<IPodiumWithinReachCounters> => {
    const counters: IPodiumWithinReachCounters = { ...EMPTY_PODIUM_WITHIN_REACH_COUNTERS, podiumPassRan: true };
    const podium = await Store.userLeaderboardScores.getTopScores(brandVariation, {
        periodStart,
        limit: LEADERBOARD_DISPLACEMENT_THRESHOLD,
        league,
    });
    // Fewer than three people on the board means everyone on it is already on the podium.
    if (podium.length < LEADERBOARD_DISPLACEMENT_THRESHOLD) {
        return counters;
    }
    // Tying the third-highest score is enough: ranks are "1 + users strictly ahead".
    const podiumCutoff = podium[LEADERBOARD_DISPLACEMENT_THRESHOLD - 1].points;

    const chasers = await Store.userLeaderboardScores.getUsersWithinReachOfScore(brandVariation, {
        periodStart,
        targetPoints: podiumCutoff,
        maxGap: PODIUM_WITHIN_REACH_MAX_GAP,
        league,
    });
    counters.podiumCandidates = chasers.length;
    if (!chasers.length) {
        return counters;
    }

    const dedupeKey = getPodiumWithinReachDedupeKey(periodStart);
    // Ranked with the board's own definition, once per distinct score. Not derivable from the
    // chaser list: it omits users who muted alerts, and ties at #3 put more than three above it.
    const rankByPoints = new Map<number, number>();
    await Promise.all([...new Set(chasers.map((chaser) => chaser.points))].map((points) => Store.userLeaderboardScores
        .getRankForScore(brandVariation, points, { periodStart, league })
        .then((rank) => { rankByPoints.set(points, rank); })));

    await Promise.all(chasers.map((chaser) => {
        const rank = rankByPoints.get(chaser.points);
        if (!rank || rank <= LEADERBOARD_DISPLACEMENT_THRESHOLD) {
            // The board moved between the two reads; this user is no longer a chaser.
            return Promise.resolve();
        }

        if (isInQuietHoursAt(chaser, now)) {
            counters.podiumNudgesSkippedQuietHours += 1;
            return Promise.resolve();
        }

        return enqueueNotification({
            brandVariation,
            toUserId: chaser.userId,
            type: PushNotifications.Types.leaderboardPodiumWithinReach,
            dedupeKey,
            payload: {
                // The recipient's own locale — this row is built from the chaser query,
                // not the scheduler request, so it never sees the request's header locale.
                locale: chaser.settingsLocale || 'en-us',
                whiteLabelOrigin: whiteLabelOrigin || '',
                rank,
                pointsBehind: podiumCutoff - chaser.points,
                hoursLeft,
            },
        }).then((outcome) => {
            if (outcome === 'queued') {
                counters.podiumNudgesQueued += 1;
            } else if (outcome === 'duplicate') {
                counters.podiumNudgesDeduped += 1;
            } else {
                counters.podiumErrors += 1;
            }
        });
    })).catch((err: any) => {
        counters.podiumErrors += 1;
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [err?.message, 'Habits digest: failed to queue podium-within-reach nudges'],
            traceArgs: { 'pushNotification.brandVariation': String(brandVariation), 'leaderboard.league': league || '' },
        });
    });

    return counters;
};

export const runPodiumWithinReachPass = async (
    { brandVariation, whiteLabelOrigin }: { brandVariation: string, whiteLabelOrigin?: string },
    now: Date = new Date(),
): Promise<IPodiumWithinReachCounters> => {
    const counters: IPodiumWithinReachCounters = { ...EMPTY_PODIUM_WITHIN_REACH_COUNTERS };

    const hoursLeft = getHoursUntilReset(now);
    if (!arePodiumNudgesEnabled() || !isLastDigestBeforeReset(now) || hoursLeft < PODIUM_WITHIN_REACH_MIN_HOURS_LEFT) {
        return counters;
    }
    counters.podiumPassRan = true;

    const periodStart = getLeaderboardPeriodStart(now);
    const leagues = (await areLeaguesActiveForBrand(brandVariation, now))
        ? getLeaderboardTiers(brandVariation).map((tier) => tier.id)
        : [undefined];
    // One league at a time: each is a handful of small reads, and serialising keeps a brand with
    // six tiers from opening six times the connections in the digest's busiest pass.
    // eslint-disable-next-line no-restricted-syntax
    for (const league of leagues) {
        // eslint-disable-next-line no-await-in-loop
        const poolCounters = await runPodiumPassForPool({
            brandVariation, whiteLabelOrigin, periodStart, hoursLeft, league, now,
        });
        counters.podiumCandidates += poolCounters.podiumCandidates;
        counters.podiumNudgesQueued += poolCounters.podiumNudgesQueued;
        counters.podiumNudgesDeduped += poolCounters.podiumNudgesDeduped;
        counters.podiumNudgesSkippedQuietHours += poolCounters.podiumNudgesSkippedQuietHours;
        counters.podiumErrors += poolCounters.podiumErrors;
    }

    return counters;
};
