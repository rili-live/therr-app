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
 * Has this user sent a pact invite that is still waiting on the invitee?
 *
 * This is what releases the onboarding gate alongside an active pact. Gating
 * purely on acceptance made the user's own progress depend on someone else's
 * action: a friend who installed the app a week later — or never — left the
 * inviter parked on the overlay indefinitely with nothing they could do.
 *
 * Reads `pacts` (everything the user is party to) rather than `pendingInvites`,
 * which holds invitations *received*. The predicate is creator-side on purpose:
 * being invited by someone else is not evidence that this user did the inviting.
 */
export const hasSentPactInvite = (
    pacts: IPact[],
    currentUserId?: string,
): boolean => (pacts || []).some(
    (pact) => pact.status === 'pending' && !!currentUserId && pact.creatorUserId === currentUserId,
);

/**
 * Has this user actually started tracking a habit?
 *
 * The third condition that releases the onboarding overlay, and the one that
 * has to distinguish a habit from the *intent* to have one. The create-habit
 * wizard writes the habit goal first and only then makes the call that begins
 * tracking it, so any failure in between — the free-tier cap answering 402, the
 * solo threshold answering 403, a dropped connection — leaves a goal behind
 * with nothing tracking it. Counting goals therefore lifted this overlay for a
 * user holding nothing, dropping them on a dashboard with no habits and no
 * onboarding to explain it.
 *
 * `activeHabitCount` is the server's own count of habits being tracked, and it
 * covers both routes into one: joining or creating a pact calls
 * `userHabits.getOrCreate` the same as the solo path does, so a user whose only
 * pact has since completed still counts here.
 *
 * `trackedHabitCount` is the locally held list, checked first because the
 * server count is only as fresh as the last dashboard refresh. Starting a habit
 * navigates straight here, and `CREATE_USER_HABIT` lands in the store well
 * before the refetch it races — without this the overlay flashed back at the
 * user in the moment they had just succeeded. It is a within-session list that
 * starts empty and is only ever added to by a confirmed start, so it can raise
 * this answer but never staleley hold it true across a launch.
 *
 * Falls back to the goal count while eligibility has not loaded. There is no
 * count to consult then, and flashing the full-screen overlay at someone who
 * has used the app for months is worse than briefly trusting a goal that is
 * almost always real.
 */
export const hasTrackedHabit = (
    activeHabitCount: number | null | undefined,
    trackedHabitCount: number,
    habitGoalCount: number,
): boolean => {
    if (trackedHabitCount > 0) {
        return true;
    }

    return typeof activeHabitCount === 'number' ? activeHabitCount > 0 : habitGoalCount > 0;
};

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
