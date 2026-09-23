import {
    BrandVariations,
    HABITS_FREE_HABIT_LIMIT,
    HABITS_FREE_HABIT_STARTS_PER_WINDOW,
    HABITS_FREE_HABIT_START_WINDOW_DAYS,
    hasHabitsPremiumEntitlement,
} from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import translate from '../../utilities/translator';

/**
 * The Friends with Habits free-tier gate: how many habits an account may track
 * at once, how many it may start in a rolling window, and who is exempt.
 *
 * This replaced a cap on *pacts created*. Every caller now goes through
 * `checkHabitCapacity` so the rule lives in one place — the limit is enforced
 * at four separate entry points (create a pact, accept a pact invite, start a
 * solo habit, restore an archived one) and a hand-rolled check at any of them
 * is a silent hole in the gate or a silent overcharge of a paying customer.
 *
 * Two numbers, checked in this order:
 *   1. **Active habits** (`HABITS_FREE_HABIT_LIMIT`). Counts only active rows,
 *      so archiving is a real escape hatch.
 *   2. **Starts per window** (`HABITS_FREE_HABIT_STARTS_PER_WINDOW` in
 *      `HABITS_FREE_HABIT_START_WINDOW_DAYS`). Counts every habit started in
 *      the window whatever its status now, which is what stops the first cap
 *      being cycled through by archiving and re-creating.
 */
export type IHabitCapacityDenialReason = 'habit-limit-reached' | 'habit-start-limit-reached';

export interface IHabitCapacityDenial {
    error: IHabitCapacityDenialReason;
    message: string;
    /** The active-habit cap. Kept as `limit` because every client reads it by that name. */
    limit: number;
    activeHabitCount: number;
    startLimit: number;
    startWindowDays: number;
    recentStartCount: number;
    upgradeRequired: true;
}

/**
 * Where an account stands against both caps, for the eligibility endpoint —
 * which is how the client learns the numbers rather than hardcoding them.
 * `activeHabitCount` and `recentStartCount` are read for every brand (the
 * dashboard uses the first as "is anything tracked yet"); `isExempt` says
 * whether the caps apply to this account at all.
 */
export interface IHabitCapacityStatus {
    isExempt: boolean;
    limit: number;
    startLimit: number;
    startWindowDays: number;
    activeHabitCount: number;
    recentStartCount: number;
    denial: IHabitCapacityDenial | null;
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

/** The start of the rolling start window, as of now. */
export const getStartWindowSince = (now: number = Date.now()): Date => new Date(
    now - (HABITS_FREE_HABIT_START_WINDOW_DAYS * 24 * 60 * 60 * 1000),
);

interface ICapacityCounts {
    activeHabitCount: number;
    recentStartCount: number;
}

const readCapacityCounts = async (userId: string): Promise<ICapacityCounts> => {
    const [activeHabitCount, recentStartCount] = await Promise.all([
        Store.userHabits.countActiveByUser(userId),
        Store.userHabits.countStartedSinceByUser(userId, getStartWindowSince()),
    ]);

    return { activeHabitCount, recentStartCount };
};

/**
 * The decision itself, separated from the reads so both the enforcing path and
 * the reporting path apply exactly one rule. The active cap is checked first:
 * it is the one the user can see on their dashboard, and the one whose remedy
 * (archive something) is in their hands right now.
 */
export const evaluateHabitCapacity = (
    counts: ICapacityCounts,
    locale?: string,
): IHabitCapacityDenial | null => {
    const shared = {
        limit: HABITS_FREE_HABIT_LIMIT,
        activeHabitCount: counts.activeHabitCount,
        startLimit: HABITS_FREE_HABIT_STARTS_PER_WINDOW,
        startWindowDays: HABITS_FREE_HABIT_START_WINDOW_DAYS,
        recentStartCount: counts.recentStartCount,
        upgradeRequired: true as const,
    };

    if (counts.activeHabitCount >= HABITS_FREE_HABIT_LIMIT) {
        return {
            error: 'habit-limit-reached',
            message: translate(locale || 'en-us', 'errorMessages.habits.freeTierHabitLimitReached', {
                limit: HABITS_FREE_HABIT_LIMIT,
            }) || `Free accounts can track ${HABITS_FREE_HABIT_LIMIT} habits at a time.`,
            ...shared,
        };
    }

    if (counts.recentStartCount >= HABITS_FREE_HABIT_STARTS_PER_WINDOW) {
        return {
            error: 'habit-start-limit-reached',
            message: translate(locale || 'en-us', 'errorMessages.habits.freeTierHabitStartLimitReached', {
                limit: HABITS_FREE_HABIT_STARTS_PER_WINDOW,
                days: HABITS_FREE_HABIT_START_WINDOW_DAYS,
            }) || `Free accounts can start ${HABITS_FREE_HABIT_STARTS_PER_WINDOW} new habits`
                + ` every ${HABITS_FREE_HABIT_START_WINDOW_DAYS} days.`,
            ...shared,
        };
    }

    return null;
};

/**
 * Both caps and both counts, for `GET /habits/user-habits/eligibility`.
 *
 * Unlike `checkHabitCapacity` this THROWS on a database error rather than
 * failing open: the caller is a read endpoint that reports state, and a 500 is
 * the honest answer when the state cannot be read. Counts are taken for every
 * brand because the dashboard reads `activeHabitCount` as "is anything tracked
 * yet"; the user lookup that decides exemption is skipped for brands the cap
 * never applies to.
 */
export const getHabitCapacityStatus = async ({
    userId,
    brandVariation,
    locale,
}: {
    userId: string;
    brandVariation?: string;
    locale?: string;
}): Promise<IHabitCapacityStatus> => {
    let isExempt = brandVariation !== BrandVariations.HABITS;

    const [counts, requesterUsers] = await Promise.all([
        readCapacityCounts(userId),
        isExempt ? Promise.resolve([]) : Store.users.findUser({ id: userId }, ['accessLevels']),
    ]);

    if (!isExempt) {
        const accessLevels: string[] = (requesterUsers?.[0]?.accessLevels as string[]) || [];
        isExempt = isHabitCapExempt(brandVariation, accessLevels);
    }

    return {
        isExempt,
        limit: HABITS_FREE_HABIT_LIMIT,
        startLimit: HABITS_FREE_HABIT_STARTS_PER_WINDOW,
        startWindowDays: HABITS_FREE_HABIT_START_WINDOW_DAYS,
        activeHabitCount: counts.activeHabitCount,
        recentStartCount: counts.recentStartCount,
        denial: isExempt ? null : evaluateHabitCapacity(counts, locale),
    };
};

/**
 * How many times this process has failed open, and when it last did.
 *
 * A fail-open is indistinguishable from a working cap: the request succeeds, the
 * user gets their habit, and nothing downstream is wrong. That is why a user
 * reaching 8 active habits against a limit of 5 (#2923) could not be explained
 * from the code — a *persistent* failure in `findUser` or the count reads
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
 * Returns a 402 payload when the caller is at either limit, or `null` when
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
 * is deliberate: the worst case is a free user briefly getting one habit over.
 *
 * "Briefly" is the load-bearing word, and it is what the fail-open reporting
 * below exists to keep honest — see `failOpenCount`. The span is `error` rather
 * than `warn` because a gate that is not enforcing is not a warning about
 * something that might matter later; it is the gate being off right now.
 *
 * Callers must check *before* creating the tracking row. `countActiveByUser`
 * counts only `active` rows, so the restore path is naturally safe — the row
 * being restored is still `archived` when the check runs — but a caller that
 * inserted first would count the new habit against its own limit. The same
 * holds for the start window: the new row's `startedAt` must not exist yet.
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
    // customers are also being let through unevaluated), while a failing count
    // means only the numbers are unavailable. Guessing between them from a
    // stack trace after the fact is what made #2923 hard to answer.
    let stage: 'findUser' | 'readCapacityCounts' = 'findUser';

    try {
        const [requesterUser] = await Store.users.findUser({ id: userId }, ['accessLevels']);
        const accessLevels: string[] = (requesterUser?.accessLevels as string[]) || [];

        if (isHabitCapExempt(brandVariation, accessLevels)) {
            // Entitled accounts do not even pay for the count queries.
            return null;
        }

        stage = 'readCapacityCounts';
        const counts = await readCapacityCounts(userId);

        return evaluateHabitCapacity(counts, locale);
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
    getHabitCapacityStatus,
    isHabitCapExempt,
};
