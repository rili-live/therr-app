import AccessLevels from './enums/AccessLevels';

/**
 * The access levels that lift every Friends with Habits free-tier limit.
 *
 * Three entries, three different reasons:
 *   - HABITS_LIFETIME — the one-time founder purchase (Google Play Billing).
 *   - HABITS_PREMIUM  — reserved for a future recurring subscription. Nothing
 *     writes it today; it is listed here so that adding a subscription later
 *     requires no change at any gate.
 *   - SUPER_ADMIN     — so support and QA can reproduce a paid account without
 *     a real purchase.
 */
const HABITS_PREMIUM_ACCESS_LEVELS: string[] = [
    AccessLevels.HABITS_LIFETIME,
    AccessLevels.HABITS_PREMIUM,
    AccessLevels.SUPER_ADMIN,
];

/**
 * Single source of truth for "is this account exempt from the HABITS free-tier
 * limits?".
 *
 * Every gate must call this rather than testing an access level directly. The
 * limits are enforced in more than one handler (pact create, pact accept, solo
 * habit start, habit restore), and the failure mode of a hand-rolled check is
 * silent and one-sided: a gate that forgets HABITS_LIFETIME charges a paying
 * customer twice, and nothing surfaces it but a support email.
 *
 * `accessLevels` is read straight off `main.users.accessLevels`, which is a
 * JSONB column and therefore arrives as `undefined` when the caller forgot to
 * select it. That is treated as "not entitled" — the same way every other
 * consumer treats it — so a missed column shows up as an unexpected paywall
 * rather than as free premium for everyone.
 */
const hasHabitsPremiumEntitlement = (accessLevels: string[] | undefined | null): boolean => {
    if (!Array.isArray(accessLevels)) {
        return false;
    }

    return accessLevels.some((level) => HABITS_PREMIUM_ACCESS_LEVELS.includes(level));
};

export {
    HABITS_PREMIUM_ACCESS_LEVELS,
    hasHabitsPremiumEntitlement,
};
