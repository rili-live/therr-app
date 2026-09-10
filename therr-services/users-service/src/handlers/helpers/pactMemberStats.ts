import Store from '../../store';
import {
    buildPactMemberStats,
    countScheduledCheckins,
    getPactStatsWindow,
    IPactMemberStats,
    ZERO_PACT_MEMBER_STATS,
} from '../../utilities/pactMemberStats';
import { getTodayDateString } from '../../utilities/streakHelpers';

interface IStatsTarget {
    key: string;
    userId: string;
    habitGoalId: string;
    startDate: string;
    endDate: string;
}

const statsKey = (pactId: string, userId: string) => `${pactId}:${userId}`;

const withStats = (member: any, stats: IPactMemberStats) => ({ ...member, ...stats });

/**
 * Replaces the stored (and permanently zeroed — see utilities/pactMemberStats)
 * stat columns on each pact's members with values derived from check-ins and
 * streaks. Every member comes back with numeric stats, so clients never have to
 * distinguish "no progress" from "never computed".
 *
 * Batched across the whole page: four queries total regardless of how many
 * pacts or members are passed in.
 */
export const attachPactMemberStats = async (pacts: any[]): Promise<any[]> => {
    if (!pacts.length) {
        return pacts;
    }

    const windowsByPactId: Record<string, { startDate: string; endDate: string }> = {};
    const targets: IStatsTarget[] = [];
    const goalIds = new Set<string>();
    const pairs: { userId: string; habitGoalId: string }[] = [];
    const seenPairs = new Set<string>();

    pacts.forEach((pact) => {
        const statsWindow = getPactStatsWindow(pact);
        if (!statsWindow || !pact?.habitGoalId || !pact?.members?.length) {
            return;
        }

        windowsByPactId[pact.id] = statsWindow;
        goalIds.add(pact.habitGoalId);

        pact.members.forEach((member: any) => {
            if (!member?.userId) {
                return;
            }
            targets.push({
                key: statsKey(pact.id, member.userId),
                userId: member.userId,
                habitGoalId: pact.habitGoalId,
                ...statsWindow,
            });
            const pairKey = `${member.userId}:${pact.habitGoalId}`;
            if (!seenPairs.has(pairKey)) {
                seenPairs.add(pairKey);
                pairs.push({ userId: member.userId, habitGoalId: pact.habitGoalId });
            }
        });
    });

    // Nothing measurable (all pending / not yet started): zero out rather than
    // pass the stale columns through.
    if (!targets.length) {
        return pacts.map((pact) => ({
            ...pact,
            members: (pact?.members || []).map((member: any) => withStats(member, ZERO_PACT_MEMBER_STATS)),
        }));
    }

    // The service's UTC habit day, matching what the check-in write path
    // stores in `scheduledDate` — see getTodayDateString.
    const today = getTodayDateString();

    const [goals, streaks, completedCounts, completedToday] = await Promise.all([
        Store.habitGoals.getByIds([...goalIds]),
        Store.streaks.getByUserHabitPairs(pairs),
        Store.habitCheckins.getCompletedCountsForWindows(targets),
        Store.habitCheckins.getCompletedOnDateForPairs(pairs, today),
    ]);

    const goalsById: Record<string, any> = goals.reduce((acc: any, goal: any) => {
        acc[goal.id] = goal;
        return acc;
    }, {});
    const streaksByPair: Record<string, any> = streaks.reduce((acc: any, streak: any) => {
        acc[`${streak.userId}:${streak.habitGoalId}`] = streak;
        return acc;
    }, {});

    // The cadence is a property of the habit goal, so every member of a pact
    // shares the same denominator — compute it once per pact.
    const scheduledByPactId: Record<string, number> = {};
    pacts.forEach((pact) => {
        const statsWindow = windowsByPactId[pact?.id];
        if (statsWindow) {
            scheduledByPactId[pact.id] = countScheduledCheckins(
                statsWindow.startDate,
                statsWindow.endDate,
                goalsById[pact.habitGoalId],
            );
        }
    });

    return pacts.map((pact) => {
        const members = pact?.members || [];
        if (!windowsByPactId[pact?.id]) {
            return { ...pact, members: members.map((member: any) => withStats(member, ZERO_PACT_MEMBER_STATS)) };
        }

        return {
            ...pact,
            members: members.map((member: any) => withStats(member, buildPactMemberStats({
                scheduledCount: scheduledByPactId[pact.id] || 0,
                completedCheckins: completedCounts[statsKey(pact.id, member.userId)] || 0,
                streak: streaksByPair[`${member.userId}:${pact.habitGoalId}`],
                checkedInToday: completedToday.has(`${member.userId}:${pact.habitGoalId}`),
            }))),
        };
    });
};

/**
 * Single-pact convenience wrapper.
 */
export const attachMemberStatsToPact = async (pact: any): Promise<any> => {
    const [hydrated] = await attachPactMemberStats([pact]);
    return hydrated;
};

export default attachPactMemberStats;
