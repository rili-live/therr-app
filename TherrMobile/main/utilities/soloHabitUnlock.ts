import { IUserHabitEligibility } from 'therr-react/types';

/**
 * Progress toward unlocking habits tracked on your own.
 *
 * Friends with Habits requires you to bring people with you before you can
 * track a habit alone. That requirement only works as a growth lever if the
 * user can see it coming: "invite 2 more friends to unlock" is something to
 * finish, while a locked button with no explanation is a reason to leave. Every
 * surface that can refuse a solo habit reads its copy from this.
 *
 * Kept free of react-native imports so it stays unit-testable, and shared
 * because the wizard and the onboarding overlay must never disagree about how
 * many invites are left.
 */
export interface ISoloUnlockProgress {
    /** Distinct people the user has invited to a pact they created. */
    invitedCount: number;
    /** Invites needed to unlock. Server-driven — never hardcode 3 at a call site. */
    requiredCount: number;
    /** Invites still to send, floored at 0. */
    remaining: number;
    isUnlocked: boolean;
    /**
     * Whether there are real numbers to render. False while eligibility is
     * still loading, and false against a server that predates the threshold and
     * sends no counts. Callers must show the locked state *without* a progress
     * line rather than inventing "0 of 0", which would read as a broken promise.
     */
    hasProgress: boolean;
}

const toCount = (value: unknown): number | null => (
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
);

/** Nothing unlocked and nothing to render — the shape every "no" resolves to. */
const NO_PROGRESS: ISoloUnlockProgress = {
    invitedCount: 0,
    requiredCount: 0,
    remaining: 0,
    isUnlocked: false,
    hasProgress: false,
};

/**
 * @param isSoloEnabled `ENABLE_HABITS_SOLO`. Required rather than read here so
 *   this module keeps its RN-free contract — `getConfig` pulls in `react-native`
 *   through `env-config`. Passing it in also puts the *meaning* of "disabled" in
 *   one place: every surface derives its copy from the returned object, so a
 *   flag that is off must resolve to locked-and-silent here rather than at four
 *   call sites that could each get it half right. Without that, turning the flag
 *   off hid the CTA but left the progress banner promising an unlock the app no
 *   longer offered.
 */
export const getSoloUnlockProgress = (
    eligibility: IUserHabitEligibility | null | undefined,
    isSoloEnabled: boolean,
): ISoloUnlockProgress => {
    if (!isSoloEnabled) {
        return NO_PROGRESS;
    }

    // Unloaded eligibility is treated as locked, which is the safe direction:
    // showing the affordance early only walks the user into a 403 the server
    // was always going to return.
    const isUnlocked = !!eligibility?.canCreateSolo;
    const invitedCount = toCount(eligibility?.invitedCount);
    const requiredCount = toCount(eligibility?.soloUnlockInviteCount);

    if (invitedCount === null || requiredCount === null || requiredCount === 0) {
        return { ...NO_PROGRESS, isUnlocked };
    }

    return {
        invitedCount,
        requiredCount,
        // Never negative: a user past the threshold who is somehow still locked
        // must not be told to invite "-1 more friends".
        remaining: Math.max(requiredCount - invitedCount, 0),
        isUnlocked,
        hasProgress: true,
    };
};
