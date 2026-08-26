import { PushNotifications } from 'therr-js-utilities/constants';

/**
 * Which `streakAtRisk` body to render.
 *
 * Split out of `firebaseAdmin.ts` so the rule can be tested without importing
 * firebase-admin (which initializes a credential at module load) — the same
 * reason `wizardSteps.ts` and `pactState.ts` live apart from their screens.
 *
 * The rule itself is the point of the change: warning that a streak is on the
 * line while silently holding a freeze that would cover tonight teaches the
 * user the threat is overstated. "Build in the miss" only works as a rule
 * agreed in advance, so the copy names the net whenever there is one.
 */
export const selectStreakAtRiskBodyKey = (freezesRemaining: unknown): string => (
    Number(freezesRemaining || 0) > 0
        ? 'notifications.streakAtRisk.bodyWithFreeze'
        : 'notifications.streakAtRisk.body'
);

/**
 * Streak notifications whose copy interpolates a freeze count. A locale that
 * drops `{freezesRemaining}` still renders a grammatical sentence, so nothing
 * fails loudly — it just quietly stops telling that locale's users the rule.
 */
export const FREEZE_AWARE_COPY_KEYS: string[] = [
    'streakAtRisk.bodyWithFreeze',
    'streakFreezeUsed.body',
];

/** Push types that announce the streak-freeze mechanic rather than a threat. */
export const FREEZE_ANNOUNCEMENT_TYPES: PushNotifications.Types[] = [
    PushNotifications.Types.streakFreezeUsed,
];
