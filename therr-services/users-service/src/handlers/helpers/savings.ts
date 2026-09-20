import { HabitGoalTypes, PushNotifications } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import enqueueNotification from '../../utilities/enqueueNotification';
import { ISavingsProgress, buildSavingsProgress, isSavingsGoal } from '../../utilities/savingsProgress';
import { attachMemberStatsToPact } from './pactMemberStats';

/**
 * The store-backed half of savings progress: read the totals, hand them to the pure
 * builder in `utilities/savingsProgress.ts`.
 *
 * Split this way so the rules about what "reached" means stay testable without a
 * database, and so the one place that decides *when* to spend a query lives next to the
 * handlers that call it rather than inside the rule.
 */

/**
 * Savings progress for a pact, or null when the pact is not a savings pact.
 *
 * Costs one goal read plus one aggregate, which is why it is only called from the pact
 * *detail* endpoint and never from the list endpoints — `GET /habits/pacts` renders a
 * card per pact and would otherwise pay both per row.
 *
 * Never throws. A savings total is decoration on a response whose primary job is to
 * return the pact; failing the whole request because an aggregate timed out would take
 * the detail screen down over a number it renders in one line. A failure logs and
 * returns null, which the client already has to handle (it is what a non-savings pact
 * returns).
 */
export const getPactSavingsProgress = async (
    pact: any,
    members: any[],
    viewerUserId?: string,
): Promise<ISavingsProgress | null> => {
    if (!pact?.habitGoalId) {
        return null;
    }

    try {
        const goal = await Store.habitGoals.getById(pact.habitGoalId);
        if (!isSavingsGoal(goal)) {
            return null;
        }

        const memberTotals = await Store.habitCheckins.getSavingsTotalsByPactMember(pact.id, pact.habitGoalId);

        return buildSavingsProgress({
            goal,
            memberTotals,
            viewerUserId,
            // Only members who can still check in hold the goal open. See the
            // `activeUserIds` note in utilities/savingsProgress.ts.
            activeUserIds: members
                .filter((member: any) => member.status === 'active')
                .map((member: any) => member.userId),
        });
    } catch (err: any) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [err?.message, 'Failed to compute pact savings progress'],
            traceArgs: {
                'pact.id': pact?.id,
                'habitGoal.id': pact?.habitGoalId,
            },
        });
        return null;
    }
};

/**
 * Attaches `savingsProgress` to a pact, leaving a non-savings pact untouched.
 *
 * The key is absent rather than null on a non-savings pact, so that a client can tell
 * "this is not a savings pact" from "this is one and nothing has been saved" — the
 * latter comes back with zeroed totals.
 */
export const withSavingsProgress = async (pact: any, members: any[], viewerUserId?: string) => {
    const savingsProgress = await getPactSavingsProgress(pact, members, viewerUserId);

    return savingsProgress ? { ...pact, savingsProgress } : pact;
};

export interface ISavingsCheckinOutcome {
    progress: ISavingsProgress;
    /** Pact ids this check-in pushed over the line, newly completed by this request. */
    completedPactIds: string[];
}

/**
 * Re-evaluate a savings goal after a check-in, completing any pact whose target the
 * check-in just met.
 *
 * This is the "the goal is reached when the total is equal or more" rule. It runs on
 * every check-in against a savings goal rather than only on ones carrying an amount,
 * because a target can also be met by someone *else's* contribution arriving first —
 * whoever checks in next is the one who observes it. Completion is therefore not
 * attributed to the contributor; it is simply noticed.
 *
 * Idempotence comes from the `status !== 'active'` guard plus the fact that
 * `Store.pacts.complete` is a conditional write on a row this request re-read: a second
 * check-in after the target is met finds the pact already `completed` and does nothing.
 * Two concurrent check-ins can both observe `active` and both call complete — the second
 * write sets the same status and the same frozen stats, so the race is benign. What it
 * would *not* survive is a duplicate notification, which is why the pact-completed push
 * is queued with a dedupe key naming the pact and nothing time-varying.
 *
 * Never throws: a check-in that has already committed must not fail because the money
 * math or a notification did.
 */
export const evaluateSavingsAfterCheckin = async ({
    goal,
    pacts,
    userId,
    brandVariation,
    locale,
    whiteLabelOrigin,
}: {
    goal: any;
    pacts: any[];
    userId: string;
    brandVariation: string;
    locale?: string;
    whiteLabelOrigin?: string;
}): Promise<ISavingsCheckinOutcome | null> => {
    if (!isSavingsGoal(goal)) {
        return null;
    }

    try {
        // A solo savings habit has no pact and still has a total worth reporting, so
        // the no-pact case is computed from the user's own check-ins rather than
        // skipped. `getSavingsTotalsByPactMember` is pact-driven and cannot serve it.
        if (!pacts.length) {
            const totalsByGoal = await Store.habitCheckins.getSavingsTotalsByGoalForUser(userId, [goal.id]);
            const own = totalsByGoal[goal.id] || { totalSaved: 0, contributionCount: 0 };

            return {
                progress: buildSavingsProgress({
                    goal,
                    memberTotals: [{ userId, ...own }],
                    viewerUserId: userId,
                }),
                completedPactIds: [],
            };
        }

        const completedPactIds: string[] = [];
        let observedProgress: ISavingsProgress | null = null;

        // Sequential rather than Promise.all: a habit backing several pacts is rare
        // (and capped by the free-tier habit limit), while each iteration issues two
        // reads and possibly a write. Parallelising a rare two-element loop trades
        // readability for nothing.
        // eslint-disable-next-line no-restricted-syntax
        for (const pact of pacts) {
            // eslint-disable-next-line no-await-in-loop
            const members = await Store.pactMembers.getByPactId(pact.id);
            // eslint-disable-next-line no-await-in-loop
            const memberTotals = await Store.habitCheckins.getSavingsTotalsByPactMember(pact.id, goal.id);

            const progress = buildSavingsProgress({
                goal,
                memberTotals,
                viewerUserId: userId,
                activeUserIds: members
                    .filter((member: any) => member.status === 'active')
                    .map((member: any) => member.userId),
            });

            // The checking-in user's own pact is the one whose progress the response
            // reports. First wins, matching how `attributedPactId` picks a pact.
            if (!observedProgress) {
                observedProgress = progress;
            }

            if (!progress.isGoalReached || pact.status !== 'active') {
                // eslint-disable-next-line no-continue
                continue;
            }

            // Freeze the derived per-member stats before flipping the status, for the
            // same reason `completePact` does: the derived window closes with the pact
            // and the stored columns become the only record.
            // eslint-disable-next-line no-await-in-loop
            const { members: refreshedMembers } = await attachMemberStatsToPact({ ...pact, members });
            // eslint-disable-next-line no-await-in-loop
            await Promise.all(refreshedMembers.map((member: any) => Store.pactMembers.update(member.id, {
                totalCheckins: member.totalCheckins,
                completedCheckins: member.completedCheckins,
                currentStreak: member.currentStreak,
                longestStreak: member.longestStreak,
                completionRate: member.completionRate,
            })));

            const creatorMember = refreshedMembers.find((member: any) => member.role === 'creator');
            const partnerMember = refreshedMembers.find((member: any) => member.role === 'partner');

            // No winner is set. A savings pact that hit its number was finished by
            // everybody who contributed, and naming the member with the higher
            // *check-in* completion rate the "winner" of a money goal would reward the
            // wrong thing entirely.
            // eslint-disable-next-line no-await-in-loop
            await Store.pacts.complete(
                pact.id,
                undefined,
                creatorMember ? Number(creatorMember.completionRate) || 0 : 0,
                partnerMember ? Number(partnerMember.completionRate) || 0 : 0,
            );
            completedPactIds.push(pact.id);

            // Tell everyone, including the person who just checked in — they saved the
            // last of it and the app should say so. The dedupe key names the pact and
            // the reason, with nothing time-varying in it, so a concurrent second
            // check-in observing the same completion queues nothing.
            // eslint-disable-next-line no-await-in-loop
            await Promise.all(refreshedMembers
                .filter((member: any) => member.status === 'active')
                .map((member: any) => enqueueNotification({
                    brandVariation,
                    toUserId: member.userId,
                    type: PushNotifications.Types.pactCompleted,
                    dedupeKey: `pact-completed:savings-target:${pact.id}`,
                    payload: {
                        locale,
                        whiteLabelOrigin,
                        pactId: pact.id,
                        habitGoalId: goal.id,
                        habitName: goal.name,
                        targetAmount: progress.targetAmount,
                        currencyCode: progress.currencyCode,
                        totalSaved: progress.totalSaved,
                    },
                })));
        }

        return observedProgress
            ? { progress: observedProgress, completedPactIds }
            : null;
    } catch (err: any) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [err?.message, 'Failed to evaluate savings progress after a check-in'],
            traceArgs: { 'habitGoal.id': goal?.id, 'user.id': userId },
        });
        return null;
    }
};

/**
 * Adds `totalSaved` to each savings habit in a user's habit list, and turns the
 * `targetAmount` text the list query returns into a number.
 *
 * One aggregate for the whole list rather than one per habit: the dashboard renders
 * every habit a user tracks, and a per-row query would make the page cost scale with
 * how committed the user is. Habits that are not savings goals are skipped entirely, so
 * a user with none pays nothing.
 *
 * Degrades rather than fails, for the same reason `getPactSavingsProgress` does — the
 * habit list's job is to list habits. On failure the target still comes back parsed and
 * `totalSaved` is simply absent, which the client is required to treat as "unknown"
 * (see `IUserHabit.totalSaved`) rather than zero.
 */
export const attachSavingsTotals = async (userHabits: any[]) => {
    const parsed = userHabits.map((habit) => ({
        ...habit,
        targetAmount: habit.targetAmount === null || habit.targetAmount === undefined
            ? null
            : Number(habit.targetAmount),
    }));

    const savingsHabits = parsed.filter((habit) => habit.goalType === HabitGoalTypes.SAVINGS_GOAL);
    if (!savingsHabits.length) {
        return parsed;
    }

    // Every savings habit belongs to one user here — this is that user's own list — so
    // a single (userId, goalIds) aggregate covers the page.
    const userId = savingsHabits[0].userId;
    let totalsByGoal: Record<string, { totalSaved: number; contributionCount: number }> = {};

    try {
        totalsByGoal = await Store.habitCheckins.getSavingsTotalsByGoalForUser(
            userId,
            savingsHabits.map((habit) => habit.habitGoalId),
        );
    } catch (err: any) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [err?.message, 'Failed to read habit savings totals'],
            traceArgs: { 'user.id': userId },
        });
        return parsed;
    }

    return parsed.map((habit) => (habit.goalType === HabitGoalTypes.SAVINGS_GOAL
        // A goal with no recorded amounts is absent from the map, not zero in it — the
        // habit has genuinely saved nothing, which is 0 rather than unknown.
        ? { ...habit, totalSaved: totalsByGoal[habit.habitGoalId]?.totalSaved || 0 }
        : habit));
};
