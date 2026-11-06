/**
 * Retention copy for the habits digest's drop-off messages, and the streak-aware pact renewal copy.
 *
 * Split out of `firebaseAdmin.ts` for the same reason as `pactDeclinedCopy.ts`: the rules can be
 * tested without importing firebase-admin, which initializes a credential at module load.
 *
 * ## Why a variant on `dailyHabitReminder`, not new types
 *
 * users-service stamps `messageVariant` on a `dailyHabitReminder` row (see its
 * `utilities/retentionLadder.ts`). That type is already data-only, already carries the one-press
 * Check In button, is already routed by every installed Android build and already passes the
 * worker's send-time freshness gate. A new type would reach existing installs with no intent
 * action and no tap route until a new build shipped, and would lose all four. The variant changes
 * only the words.
 *
 * An unknown or missing variant renders the ordinary reminder — an older users-service, or a
 * hand-made request, keeps the copy this type always had.
 *
 * Copy rules (docs/HABIT_LIFECYCLE_MESSAGING.md): lead with the user's own habit and partner;
 * never cite the streak they lost (the abstinence violation effect turns a lapse into a relapse);
 * no multipliers or success-rate claims.
 */

export const RETENTION_MESSAGE_VARIANTS = ['first-checkin', 'day-two', 'comeback', 'comeback-no-bonus', 'fresh-start'] as const;

export type RetentionMessageVariant = typeof RETENTION_MESSAGE_VARIANTS[number];

const KNOWN_VARIANTS = new Set<string>(RETENTION_MESSAGE_VARIANTS);

/** The locale block under `notifications.habitRetention` for each variant. */
const VARIANT_BLOCKS: Record<RetentionMessageVariant, string> = {
    'first-checkin': 'firstCheckin',
    'day-two': 'dayTwo',
    comeback: 'comeback',
    'comeback-no-bonus': 'comebackNoBonus',
    'fresh-start': 'freshStart',
};

export const isRetentionMessageVariant = (value: unknown): value is RetentionMessageVariant => (
    typeof value === 'string' && KNOWN_VARIANTS.has(value)
);

export interface IRetentionCopyKeys {
    titleKey: string;
    bodyKey: string;
}

/**
 * Title and body keys for a retention variant, or null for the ordinary reminder copy. The
 * partner-naming body is chosen only when there is a partner name to put in it.
 */
export const selectRetentionCopyKeys = (variant: unknown, partnerName: unknown): IRetentionCopyKeys | null => {
    if (!isRetentionMessageVariant(variant)) {
        return null;
    }
    const base = `notifications.habitRetention.${VARIANT_BLOCKS[variant]}`;
    const hasPartner = typeof partnerName === 'string' && partnerName.trim().length > 0;
    return {
        titleKey: `${base}.title`,
        bodyKey: hasPartner ? `${base}.bodyWithPartner` : `${base}.body`,
    };
};

/**
 * `pactExpiring` / `pactEnded` body: the streak-carrying version when there is a live streak to
 * carry, the plain renewal offer otherwise. "Keep your streak" to someone at zero would be a
 * claim about nothing.
 */
export const selectPactRenewalBodyKey = (
    type: 'pactExpiring' | 'pactEnded',
    streakCount: unknown,
): string => (
    Number(streakCount) > 0 ? `notifications.${type}.bodyWithStreak` : `notifications.${type}.body`
);
