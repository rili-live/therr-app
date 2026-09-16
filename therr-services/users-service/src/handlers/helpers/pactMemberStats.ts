import Store from '../../store';
import {
    buildPactMemberStats,
    countScheduledCheckins,
    getPactStatsWindow,
    IPactMemberStats,
    ZERO_PACT_MEMBER_STATS,
} from '../../utilities/pactMemberStats';
import { getLocalDate, resolveCheckinTimeZone } from '../../utilities/dailyStreak';
import { FALLBACK_TIME_ZONE } from '../../utilities/localReminderSchedule';
import { canContinueSolo } from '../../utilities/pactStreak';

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
 * Attach the pact-level fields the client needs to render the group without recomputing them:
 * how many members are actively participating (the majority denominator, and what decides
 * whether add/remove is offered) and whether the last remaining member should be shown the
 * continue-solo offer. Derived from the already-loaded members, so no extra query.
 */
const withPactSummary = (pact: any, members: any[]) => {
    const activeMemberCount = members.filter((m: any) => m?.status === 'active').length;
    return {
        ...pact,
        members,
        activeMemberCount,
        canContinueSolo: canContinueSolo({
            status: pact?.status,
            isSolo: pact?.isSolo,
            activeMemberCount,
        }),
    };
};

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
        return pacts.map((pact) => withPactSummary(
            pact,
            (pact?.members || []).map((member: any) => withStats(member, ZERO_PACT_MEMBER_STATS)),
        ));
    }

    // "Checked in today" is asked once per member, in that member's own zone — a habit day is
    // the checking-in user's calendar day (see resolveCheckinHabitDate), and a pact's members
    // are not necessarily in the same one. Asking it in UTC would show a partner in Chicago as
    // not-yet-checked-in for the five hours after their local evening crossed UTC midnight,
    // which is the same off-by-one the write path used to have. One extra query for the whole
    // page; members with no saved zone fall back exactly as everywhere else.
    const memberTimeZones = await Store.users.getTimeZonesByIds(
        [...new Set(pairs.map((pair) => pair.userId))],
    ).catch(() => ({} as Record<string, string>));
    const localDateByUserId: Record<string, string> = {};
    const datedPairs = pairs.map((pair) => {
        if (!localDateByUserId[pair.userId]) {
            localDateByUserId[pair.userId] = getLocalDate(resolveCheckinTimeZone(memberTimeZones[pair.userId]));
        }
        return { ...pair, date: localDateByUserId[pair.userId] };
    });
    const fallbackToday = getLocalDate(FALLBACK_TIME_ZONE);

    const [goals, streaks, completedCounts, completedToday] = await Promise.all([
        Store.habitGoals.getByIds([...goalIds]),
        Store.streaks.getByUserHabitPairs(pairs),
        Store.habitCheckins.getCompletedCountsForWindows(targets),
        Store.habitCheckins.getCompletedOnDateForPairs(datedPairs, fallbackToday),
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
            return withPactSummary(pact, members.map((member: any) => withStats(member, ZERO_PACT_MEMBER_STATS)));
        }

        return withPactSummary(pact, members.map((member: any) => withStats(member, buildPactMemberStats({
            scheduledCount: scheduledByPactId[pact.id] || 0,
            completedCheckins: completedCounts[statsKey(pact.id, member.userId)] || 0,
            streak: streaksByPair[`${member.userId}:${pact.habitGoalId}`],
            checkedInToday: completedToday.has(`${member.userId}:${pact.habitGoalId}`),
        }))));
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
