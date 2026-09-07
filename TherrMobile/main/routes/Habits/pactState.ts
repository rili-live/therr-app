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

/**
 * Has this cycle already been continued by a re-commit?
 *
 * `supersededByPactId` is derived server-side and names the newest cycle that
 * continues this pact — absent when the only renewal was declined or abandoned,
 * which is what makes such a pact re-committable again.
 *
 * The list read leaves superseded cycles out, so most screens never see one.
 * The exception is the pact reached deliberately, through a successor's
 * "extended from" link: there the pact is history, and it must read as history
 * rather than offering to start a cycle that already exists.
 */
export const isPactSuperseded = (
    pact: { supersededByPactId?: string | null } | null | undefined,
): boolean => !!pact?.supersededByPactId;

/**
 * Whether a pact's cycle is over and can therefore be renewed.
 *
 * Mirrors `isPactRenewable` in users-service (`src/utilities/pactHelpers.ts`),
 * which is the authority — the server re-checks this and 400s a renewal it
 * disagrees with, so a drift here shows the wrong CTA rather than corrupting
 * anything. It is duplicated instead of shared because the helper lives in a
 * backend service, not in a library mobile consumes.
 *
 * The `active`-past-`endDate` arm is the one that earns its keep. The nightly
 * digest sweep is what marks a finished pact `expired`, so between a pact's end
 * and the next sweep its status still reads `active`. Gating on status alone
 * would tell a user who opens the app that morning that a pact which visibly
 * ended is still running, and hide the one CTA the screen exists to offer.
 *
 * `abandoned` and `pending` are deliberately absent: someone who walked away
 * should start fresh deliberately, and a pending pact never had a cycle to
 * finish.
 *
 * The supersession arm has no counterpart in the server helper, because the
 * server answers the same question in two steps — `isPactRenewable`, then a
 * separate successor lookup. Here it has to be one answer, since every CTA on
 * both screens is drawn from this predicate: a cycle that has already been
 * continued must not offer to continue it a second time. That combination —
 * the CTA staying live on a pact that had already been renewed — is how one tap
 * per duplicate pact used to reach the server at all.
 */
export const isPactRenewable = (
    pact: {
        status?: string;
        endDate?: Date | string | null;
        supersededByPactId?: string | null;
    } | null | undefined,
): boolean => {
    if (!pact || isPactSuperseded(pact)) {
        return false;
    }
    if (pact.status === 'completed' || pact.status === 'expired') {
        return true;
    }
    if (pact.status !== 'active' || !pact.endDate) {
        return false;
    }

    const endDate = new Date(pact.endDate);
    if (Number.isNaN(endDate.getTime())) {
        return false;
    }

    return Date.now() > endDate.getTime();
};
