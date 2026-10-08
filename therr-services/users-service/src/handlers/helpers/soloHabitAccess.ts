import { HABITS_SOLO_UNLOCK_INVITE_COUNT } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import { IUserHabitRow } from '../../store/UserHabitsStore';

/**
 * How long a user's first solo habit may be tracked before an invite is needed to keep it.
 *
 * Friends with Habits used to refuse any solo habit until the user had invited
 * HABITS_SOLO_UNLOCK_INVITE_COUNT people, which put the invite in front of the first check-in.
 * In production (2026-10-08) 69% of new users left without creating a habit or a pact, and of
 * those who checked in at all, 19 of 26 did it on their first day. So the first habit is free to
 * track alone for a week; the ask comes once there is a streak worth protecting. See #3010.
 */
export const SOLO_GRACE_DAYS = 7;

/** Sent invites that keep the grace habit going past SOLO_GRACE_DAYS. */
export const SOLO_GRACE_KEEP_INVITE_COUNT = 1;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ISoloGrace {
    userHabitId: string;
    habitGoalId: string;
    startedAt: string;
    endsAt: string;
    hasEnded: boolean;
    /**
     * Ended, and the user is short of SOLO_GRACE_KEEP_INVITE_COUNT. Check-ins on the habit are
     * refused (403 `solo-grace-ended`) until they invite someone.
     */
    isLocked: boolean;
}

export interface ISoloInviteProgress {
    /** Distinct people this user has invited to a pact they created. */
    invitedCount: number;
    /** How many are needed to unlock solo habits. */
    requiredCount: number;
    /** At or past `requiredCount`: any number of solo habits, subject only to the free-tier cap. */
    isUnlockedByInvites: boolean;
    /** Not unlocked by invites, and the first-habit grace is still unused. */
    isGraceAvailable: boolean;
    /** May start a solo habit now: unlocked by invites, or by spending the grace. */
    canCreateSolo: boolean;
    /** The habit tracked under the grace, once it has been used. */
    soloGrace: ISoloGrace | null;
}

/**
 * The grace window of one tracking row, and whether it now blocks check-ins.
 *
 * Exported for the check-in path, which already holds the row and the invite count and must not
 * read either twice.
 */
export const describeSoloGrace = (
    row: Pick<IUserHabitRow, 'id' | 'habitGoalId' | 'soloGraceStartedAt'>,
    invitedCount: number,
    now: Date = new Date(),
): ISoloGrace | null => {
    if (!row.soloGraceStartedAt) {
        return null;
    }

    const startedAt = new Date(row.soloGraceStartedAt);
    const endsAt = new Date(startedAt.getTime() + SOLO_GRACE_DAYS * MS_PER_DAY);
    const hasEnded = now.getTime() >= endsAt.getTime();

    return {
        userHabitId: row.id,
        habitGoalId: row.habitGoalId,
        startedAt: startedAt.toISOString(),
        endsAt: endsAt.toISOString(),
        hasEnded,
        isLocked: hasEnded && invitedCount < SOLO_GRACE_KEEP_INVITE_COUNT,
    };
};

const DENIED = (requiredCount: number): ISoloInviteProgress => ({
    // Zero rather than the real count: on the deny path the client renders this as progress,
    // and inventing a number we could not read would show the user a bar that jumps backwards
    // on the next successful call.
    invitedCount: 0,
    requiredCount,
    isUnlockedByInvites: false,
    isGraceAvailable: false,
    canCreateSolo: false,
    soloGrace: null,
});

/**
 * Progress toward tracking habits alone.
 *
 * Two ways in:
 *
 *   - By invites: HABITS_SOLO_UNLOCK_INVITE_COUNT distinct people invited, in any state. The
 *     inviting is the growth loop. Sent rather than accepted, because gating on acceptance
 *     measures the friend's action, not the user's, and would park someone whose friends install
 *     a week later; declined and abandoned pacts still count. Distinct people, so inviting one
 *     friend to three pacts does not clear a bar meant to put the app in front of three people.
 *   - By the first-habit grace: once per user, one habit tracked alone for SOLO_GRACE_DAYS, kept
 *     beyond that by SOLO_GRACE_KEEP_INVITE_COUNT invites.
 *
 * Returns the whole picture rather than a boolean because the requirement only works as a growth
 * lever if the user can *see* it coming: "2 of 3 friends invited" reads as something to finish, a
 * bare "no" reads as a wall.
 *
 * Fails CLOSED, unlike the habit cap. Wrongly allowing solo habits skips the onboarding the growth
 * loop depends on and cannot be undone once the user has habits; wrongly denying is a retryable
 * error on a screen they are already on.
 */
export const getSoloInviteProgress = async (userId: string, now: Date = new Date()): Promise<ISoloInviteProgress> => {
    const requiredCount = HABITS_SOLO_UNLOCK_INVITE_COUNT;

    try {
        const [invitedCount, graceRow] = await Promise.all([
            Store.pactMembers.countDistinctInvitedByCreator(userId),
            Store.userHabits.getSoloGraceRow(userId),
        ]);
        const isUnlockedByInvites = invitedCount >= requiredCount;
        const isGraceAvailable = !isUnlockedByInvites && !graceRow;

        return {
            invitedCount,
            requiredCount,
            isUnlockedByInvites,
            isGraceAvailable,
            canCreateSolo: isUnlockedByInvites || isGraceAvailable,
            soloGrace: graceRow ? describeSoloGrace(graceRow, invitedCount, now) : null,
        };
    } catch (err: any) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to evaluate solo habit eligibility; denying'],
            traceArgs: {
                'error.message': err?.message,
                'user.id': userId,
            },
        });

        return DENIED(requiredCount);
    }
};

/**
 * Spend the grace on the row the caller just started tracking, when the grace is what allowed it.
 * A user unlocked by invites spends nothing.
 *
 * Returns false when the grace was used in between the caller's read and this write (a
 * concurrent start); the caller must then treat the start as refused.
 */
export const spendSoloGraceIfNeeded = async (
    progress: ISoloInviteProgress,
    userHabit: Pick<IUserHabitRow, 'id' | 'userId'>,
): Promise<boolean> => {
    if (progress.isUnlockedByInvites) {
        return true;
    }

    return Store.userHabits.claimSoloGrace(userHabit.id, userHabit.userId);
};

export default { getSoloInviteProgress };
