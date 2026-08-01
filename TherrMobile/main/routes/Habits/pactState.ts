import { IHabitGoal, IPact, IPactMember } from 'therr-react/types';

/**
 * A habit goal paired with the state of the pact(s) it belongs to. A goal is
 * only checkin-able once one of its pacts is live; while every pact is still
 * awaiting an invitee, the habit is listed separately as pending.
 *
 * Kept free of react-native imports so it stays unit-testable without the
 * native module graph the dashboard route pulls in.
 */
export interface IHabitWithPactState {
    goal: IHabitGoal;
    partnerNames: string[];
    awaitingPartnerNames: string[];
}

const getMemberDisplayName = (member: IPactMember): string => {
    const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim();
    return fullName || member.userName || '';
};

/**
 * Names of everyone but the current user who is a partner on the given pacts,
 * optionally narrowed to a single membership status.
 */
export const getPartnerNames = (
    pacts: IPact[],
    currentUserId?: string,
    memberStatus?: string,
): string[] => pacts.reduce((acc: string[], pact: IPact) => {
    (pact.members || []).forEach((member: IPactMember) => {
        if (member.userId === currentUserId || member.role !== 'partner') {
            return;
        }
        if (memberStatus && member.status !== memberStatus) {
            return;
        }
        const name = getMemberDisplayName(member);
        if (name && !acc.includes(name)) {
            acc.push(name);
        }
    });
    return acc;
}, []);

/**
 * Splits the habit list by whether its pact has started. Goals with no pact at
 * all are treated as live so a habit can never become un-checkin-able through
 * missing pact data.
 */
export const splitHabitsByPactState = (
    habitGoals: IHabitGoal[],
    activePacts: IPact[],
    allPacts: IPact[],
    currentUserId?: string,
): { live: IHabitWithPactState[]; pending: IHabitWithPactState[] } => habitGoals.reduce(
    (acc: { live: IHabitWithPactState[]; pending: IHabitWithPactState[] }, goal) => {
        const goalActivePacts = activePacts.filter((p) => p.habitGoalId === goal.id);
        const goalPendingPacts = allPacts.filter(
            (p) => p.habitGoalId === goal.id && p.status === 'pending',
        );

        if (goalActivePacts.length > 0 || goalPendingPacts.length === 0) {
            acc.live.push({
                goal,
                partnerNames: getPartnerNames(goalActivePacts, currentUserId, 'active'),
                awaitingPartnerNames: [],
            });
        } else {
            acc.pending.push({
                goal,
                partnerNames: [],
                awaitingPartnerNames: getPartnerNames(goalPendingPacts, currentUserId),
            });
        }

        return acc;
    },
    { live: [], pending: [] },
);
