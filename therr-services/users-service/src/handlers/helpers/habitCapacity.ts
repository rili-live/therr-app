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
 * How many times this process has failed open, and when it last did.
 *
 * A fail-open is indistinguishable from a working cap: the request succeeds, the
 * user gets their habit, and nothing downstream is wrong. That is why a user
 * reaching 8 active habits against a limit of 5 (#2923) could not be explained
 * from the code — a *persistent* failure in `findUser` or `countActiveByUser`
 * disables the gate silently and indefinitely, and a single warn-level span per
 * occurrence does not distinguish one transient blip from a cap that stopped
 * enforcing days ago.
 *
 * Kept in-process and reported on the span rather than pushed to a metrics
 * backend: the count only has to make a *sustained* fail-open visible, and a
 * rising counter on consecutive spans does that without new infrastructure. It
 * resets on restart, which is acceptable — a cap broken badly enough to matter
 * re-accumulates within minutes.
 */
let failOpenCount = 0;

/** Total fail-opens since this process started. */
export const getHabitCapacityFailOpenCount = (): number => failOpenCount;

/** Test affordance: forget this process's fail-open tally. */
export const resetHabitCapacityFailOpenCount = (): void => {
    failOpenCount = 0;
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
 * "Briefly" is the load-bearing word, and it is what the fail-open reporting
 * below exists to keep honest — see `failOpenCount`. The span is `error` rather
 * than `warn` because a gate that is not enforcing is not a warning about
 * something that might matter later; it is the gate being off right now.
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

    // Which read was in flight when it threw. The two have different meanings: a
    // failing `findUser` means nobody can be recognised as entitled (so paying
    // customers are also being let through unevaluated), while a failing
    // `countActiveByUser` means only the count is unavailable. Guessing between
    // them from a stack trace after the fact is what made #2923 hard to answer.
    let stage: 'findUser' | 'countActiveByUser' = 'findUser';

    try {
        const [requesterUser] = await Store.users.findUser({ id: userId }, ['accessLevels']);
        const accessLevels: string[] = (requesterUser?.accessLevels as string[]) || [];

        if (isHabitCapExempt(brandVariation, accessLevels)) {
            return null;
        }

        stage = 'countActiveByUser';
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
        failOpenCount += 1;
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to evaluate habit capacity; allowing the request'],
            traceArgs: {
                'error.message': err?.message,
                'user.id': userId,
                // Alert on this, not on the message: a single fail-open is a blip,
                // a climbing count is the cap being off.
                'habitCapacity.failOpenCount': failOpenCount,
                'habitCapacity.failedStage': stage,
                'habitCapacity.brandVariation': String(brandVariation),
            },
        });
        return null;
    }
};

export default {
    checkHabitCapacity,
    isHabitCapExempt,
};
