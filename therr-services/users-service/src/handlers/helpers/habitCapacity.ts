import {
    BrandVariations,
    HABITS_FREE_HABIT_LIMIT,
    hasHabitsPremiumEntitlement,
} from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import translate from '../../utilities/translator';

/**
 * The Friends with Habits free-tier gate: how many habits an account may track
 * at once, and who is exempt.
 *
 * This replaced a cap on *pacts created*. Every caller now goes through
 * `checkHabitCapacity` so the rule lives in one place — the limit is enforced
 * at four separate entry points (create a pact, accept a pact invite, start a
 * solo habit, restore an archived one) and a hand-rolled check at any of them
 * is a silent hole in the gate or a silent overcharge of a paying customer.
 */
export interface IHabitCapacityDenial {
    error: 'habit-limit-reached';
    message: string;
    limit: number;
    activeHabitCount: number;
    upgradeRequired: true;
}

/**
 * Non-HABITS brands bypass entirely — the cap is a Friends with Habits
 * monetization mechanic, not a platform-wide policy, and Therr/Teem accounts
 * touching the same shared handlers must not trip it.
 */
export const isHabitCapExempt = (
    brandVariation: string | undefined,
    accessLevels: string[] | undefined,
): boolean => {
    if (brandVariation !== BrandVariations.HABITS) {
        return true;
    }

    return hasHabitsPremiumEntitlement(accessLevels);
};

/**
 * Returns a 402 payload when the caller is at their habit limit, or `null` when
 * they may proceed.
 *
 * The access-level read happens here rather than in the caller so that no entry
 * point can accidentally pass a partially-selected user record. Selecting the
 * column explicitly matters: `accessLevels` is JSONB and arrives `undefined`
 * when it was not asked for, which `hasHabitsPremiumEntitlement` reads as "not
 * entitled" — an unexpected paywall for a paying customer.
 *
 * FAILS OPEN. A count or user-lookup error lets the request through, matching
 * the behaviour of the pact cap this replaced. The cap is a soft commercial
 * limit with no data-integrity stake, so a transient database hiccup should
 * never be the reason a paying-or-not user cannot start a habit. The tradeoff
 * is deliberate: the worst case is a free user briefly getting a sixth habit.
 *
 * Callers must check *before* creating the tracking row. `countActiveByUser`
 * counts only `active` rows, so the restore path is naturally safe — the row
 * being restored is still `archived` when the check runs — but a caller that
 * inserted first would count the new habit against its own limit.
 */
export const checkHabitCapacity = async ({
    userId,
    brandVariation,
    locale,
}: {
    userId: string;
    brandVariation?: string;
    locale?: string;
}): Promise<IHabitCapacityDenial | null> => {
    if (brandVariation !== BrandVariations.HABITS) {
        return null;
    }

    try {
        const [requesterUser] = await Store.users.findUser({ id: userId }, ['accessLevels']);
        const accessLevels: string[] = (requesterUser?.accessLevels as string[]) || [];

        if (isHabitCapExempt(brandVariation, accessLevels)) {
            return null;
        }

        const activeHabitCount = await Store.userHabits.countActiveByUser(userId);

        if (activeHabitCount < HABITS_FREE_HABIT_LIMIT) {
            return null;
        }

        return {
            error: 'habit-limit-reached',
            message: translate(locale || 'en-us', 'errorMessages.habits.freeTierHabitLimitReached', {
                limit: HABITS_FREE_HABIT_LIMIT,
            }) || `Free accounts can track ${HABITS_FREE_HABIT_LIMIT} habits at a time.`,
            limit: HABITS_FREE_HABIT_LIMIT,
            activeHabitCount,
            upgradeRequired: true,
        };
    } catch (err: any) {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to evaluate habit capacity; allowing the request'],
            traceArgs: {
                'error.message': err?.message,
                'user.id': userId,
            },
        });
        return null;
    }
};

export default {
    checkHabitCapacity,
    isHabitCapExempt,
};
