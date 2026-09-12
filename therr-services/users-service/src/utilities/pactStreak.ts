/**
 * Shared ("pact") streak logic for the HABITS app.
 *
 * A pact streak is the group's own streak, separate from each member's personal
 * `habits.streaks` row. It advances on any day a *majority* of the pact's active
 * members complete the habit, so a couple of members slipping no longer costs the
 * group its momentum. The per-day majority ledger (`habits.pact_streak_days`) is
 * the source of truth; these are the pure decisions layered over it.
 *
 * Kept free of any DB or request dependency so the threshold and continuity rules
 * can be unit-tested directly — the handler wires them to the stores.
 */
import { countMissedDaysForStreak, normalizeDateString } from './streakHelpers';

/**
 * A pact must keep at least this many members to remain a pact. Below it the
 * remaining member is offered the solo-continuation path instead (see
 * `canContinueSolo`), and member removal is refused (see `canRemoveMember`).
 */
export const MIN_PACT_MEMBERS = 2;

/**
 * The number of members who must complete the habit on a given day for that day to
 * count toward the pact streak — a strict majority (more than half).
 *
 * Solo (one active member, e.g. after everyone else left and they chose to continue)
 * needs that one member. A degenerate zero-member count returns 1 so the threshold is
 * never trivially satisfied by nobody.
 */
export const getMajorityThreshold = (activeMemberCount: number): number => {
    const count = Math.max(0, Math.floor(Number(activeMemberCount) || 0));
    if (count <= 1) {
        return 1;
    }
    return Math.floor(count / 2) + 1;
};

/**
 * Whether `completedCount` of `activeMemberCount` members clears the majority bar.
 */
export const hasReachedMajority = (
    completedCount: number,
    activeMemberCount: number,
): boolean => (Number(completedCount) || 0) >= getMajorityThreshold(activeMemberCount);

/**
 * The pact streak's new value once `streakDate` is credited, given the last day the
 * pact was credited and the habit's cadence.
 *
 *   - Same day already credited (lastPactStreakDate === streakDate) → unchanged. The
 *     caller also guards this via the ledger's UNIQUE constraint; this keeps the
 *     function honest if called twice.
 *   - No gap for the cadence (consecutive daily, or on-schedule weekly) → +1.
 *   - A gap → the run is broken, so `streakDate` starts a fresh streak at 1.
 *
 * Cadence handling is delegated to `countMissedDaysForStreak`, the same helper the
 * personal streak uses, so a "3x per week" pact isn't reset for a normal off day.
 */
export const computeNextPactStreak = ({
    lastPactStreakDate,
    currentPactStreak,
    streakDate,
    frequencyType = 'daily',
    targetDaysOfWeek,
}: {
    lastPactStreakDate: string | Date | null | undefined;
    currentPactStreak: number;
    streakDate: string;
    frequencyType?: string | null;
    targetDaysOfWeek?: number[] | null;
}): number => {
    const current = Math.max(0, Math.floor(Number(currentPactStreak) || 0));

    if (!lastPactStreakDate) {
        return 1;
    }

    const lastStr = normalizeDateString(lastPactStreakDate);
    if (lastStr === streakDate) {
        return current;
    }

    const missed = countMissedDaysForStreak(
        lastStr,
        streakDate,
        frequencyType || 'daily',
        targetDaysOfWeek || undefined,
    );

    return missed > 0 ? 1 : current + 1;
};

/**
 * Whether the last remaining active member may convert an active group pact into a
 * solo one. True only when a single active member is left, the pact is still active,
 * and it has not already been converted — so the client shows the offer exactly once.
 */
export const canContinueSolo = ({
    status,
    isSolo,
    activeMemberCount,
}: {
    status?: string | null;
    isSolo?: boolean | null;
    activeMemberCount: number;
}): boolean => status === 'active'
    && !isSolo
    && (Math.floor(Number(activeMemberCount) || 0) === 1);

/**
 * Whether a member may be removed from a pact without dropping it below the minimum.
 * Removal that would leave a single member is refused — that member takes the
 * solo-continuation path instead, a deliberate choice rather than a side effect of
 * removing someone else.
 */
export const canRemoveMember = (activeMemberCount: number): boolean => (
    Math.floor(Number(activeMemberCount) || 0) - 1 >= MIN_PACT_MEMBERS
);
