import {
    IHabitsLifetimeOffer, IHabitsPremiumOffer, IUserHabit, IUserHabitEligibility,
} from 'therr-react/types';
import { shouldShowFounderCta } from '../components/Habits/founderCtaState';

/**
 * The eligibility payload as servers from 2026-09 onward send it: both free-tier
 * caps and both counts, whenever they apply. Declared here rather than read
 * off `IUserHabitEligibility` so this branch compiles against a shared library
 * that predates the fields — every one is optional, and every reader below
 * treats "absent" as "unknown", never as zero.
 */
export interface IHabitCapacityEligibility extends IUserHabitEligibility {
    habitLimitReason?: 'habit-limit-reached' | 'habit-start-limit-reached' | null;
    habitStartLimit?: number | null;
    habitStartWindowDays?: number | null;
    recentHabitStartCount?: number;
}

/**
 * Where a user came from when they reached the paywall. Carried on the
 * `UpgradePaywall` route params as `source` and reported on
 * `habits_paywall_view` and both purchase events, so each entry point's
 * click-through and conversion can be read on its own. A new surface adds a
 * value here rather than inventing a string at the call site.
 */
export type PaywallSource =
    | 'drawer'
    | 'dashboard-capacity'
    | 'dashboard-checkin'
    | 'habit-detail'
    | 'create-pact'
    | 'create-pact-wizard'
    | 'pact-accept'
    | 'settings'
    | 'weekly-recap'
    | 'celebration-milestone';

export type UpgradeNudgeVariant = 'atCap' | 'nearCap' | 'startCap';

export interface IUpgradeNudge {
    variant: UpgradeNudgeVariant;
    /** Active habits for `atCap`/`nearCap`; habits started this window for `startCap`. */
    used: number;
    /** The active cap for `atCap`/`nearCap`; the starts-per-window cap for `startCap`. */
    limit: number;
    remaining: number;
    /** Only on `startCap`: the rolling window the start cap is measured over. */
    windowDays?: number;
}

/**
 * Whether anything on the paywall can actually be bought from this device.
 *
 * Every nudge fails closed on this, the same way the drawer's founder entry
 * does (`shouldShowFounderCta`): an upsell that opens a screen with nothing to
 * tap is worse than no upsell. The monthly plan counts too — once the founder
 * offer sells out it is the only thing for sale, and the nudges should keep
 * routing there.
 */
export const isUpgradePurchasable = (
    lifetimeOffer: IHabitsLifetimeOffer | null | undefined,
    premiumOffer: IHabitsPremiumOffer | null | undefined,
): boolean => {
    if (lifetimeOffer?.isEntitled || premiumOffer?.isEntitled) {
        return false;
    }

    if (shouldShowFounderCta(lifetimeOffer)) {
        return true;
    }

    return !!premiumOffer && premiumOffer.isStoreConfigured === true;
};

/**
 * Active (tracked, not archived) habits — the count the server's free-tier cap
 * is measured against (`countActiveByUser` in users-service). Null until the
 * tracking registry has loaded: an empty list and an unloaded one look the same
 * otherwise, and a nudge computed from "0 of 5" before the fetch lands would
 * flash and vanish.
 */
export const countActiveHabits = (userHabits: IUserHabit[] | null | undefined): number | null => {
    if (!Array.isArray(userHabits)) {
        return null;
    }

    return userHabits.filter((habit) => habit?.status === 'active').length;
};

const toPositiveInt = (value: unknown): number | null => (
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : null
);

const toCount = (value: unknown): number | null => (
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null
);

export interface IHabitCapacityInputs {
    activeHabitCount: number | null;
    limit: number;
    isAtStartLimit: boolean;
    recentStartCount: number | null;
    startLimit: number | null;
    startWindowDays: number | null;
}

/**
 * Everything `getHabitCapacityNudge` needs, read off the server's eligibility
 * payload with the tracking registry as the live source for the active count.
 *
 * The limit comes from the server whenever it says one: it is env-tunable
 * there, and a client constant is only ever right until the day it is changed.
 * `fallbackLimit` (the build-time constant) covers a server that predates the
 * field, which reports `habitLimit` only once the cap is hit.
 *
 * The active count prefers the registry over the payload because archiving
 * updates the registry at once, while eligibility is refetched only on
 * refresh — a strip that keeps saying "3 of 3" after the user just archived one
 * to make room is the strip they stop believing.
 */
export const readHabitCapacity = (
    eligibility: IHabitCapacityEligibility | null | undefined,
    userHabits: IUserHabit[] | null | undefined,
    fallbackLimit: number,
): IHabitCapacityInputs => ({
    activeHabitCount: countActiveHabits(userHabits) ?? toCount(eligibility?.activeHabitCount),
    limit: toPositiveInt(eligibility?.habitLimit) ?? fallbackLimit,
    isAtStartLimit: eligibility?.habitLimitReason === 'habit-start-limit-reached',
    recentStartCount: toCount(eligibility?.recentHabitStartCount),
    startLimit: toPositiveInt(eligibility?.habitStartLimit),
    startWindowDays: toPositiveInt(eligibility?.habitStartWindowDays),
});

interface IGetCapacityNudgeArgs extends Partial<IHabitCapacityInputs> {
    isOfferEnabled: boolean;
    lifetimeOffer: IHabitsLifetimeOffer | null | undefined;
    premiumOffer: IHabitsPremiumOffer | null | undefined;
    activeHabitCount: number | null | undefined;
    limit: number;
}

/**
 * The capacity nudge for the dashboard and the create-pact wizard: a line that
 * says how close the account is to the free-tier cap, and offers the way past
 * it before the server has to refuse anything.
 *
 * Shown only in the last slot and at the cap. Earlier than that it is an ad on
 * a screen the user opens every day; at `limit - 1` it is information they
 * need before starting a pact that will 402 at the end of a three-step wizard.
 *
 * Null whenever the paywall would have nothing to sell — flag off, already
 * entitled, no purchasable offer loaded — or the count is not known yet.
 *
 * The client-side `limit` is a build-time constant that the server can
 * override by env. If they ever drift the 402 still carries the real limit, so
 * the wall is right even when this hint is early or late.
 */
export const getHabitCapacityNudge = ({
    isOfferEnabled,
    lifetimeOffer,
    premiumOffer,
    activeHabitCount,
    limit,
    isAtStartLimit = false,
    recentStartCount = null,
    startLimit = null,
    startWindowDays = null,
}: IGetCapacityNudgeArgs): IUpgradeNudge | null => {
    if (!isOfferEnabled) {
        return null;
    }

    if (!isUpgradePurchasable(lifetimeOffer, premiumOffer)) {
        return null;
    }

    if (typeof activeHabitCount !== 'number' || !Number.isFinite(activeHabitCount)) {
        return null;
    }

    if (!Number.isFinite(limit) || limit < 1) {
        return null;
    }

    const used = Math.max(0, activeHabitCount);
    const remaining = Math.max(0, limit - used);

    if (used >= limit) {
        return {
            variant: 'atCap', used, limit, remaining: 0,
        };
    }

    // The start window, which only the server can see: slots are free but the
    // next start would still be refused. Said only when the server said it,
    // and only with its own numbers — there is nothing to count client-side,
    // and the copy names the window, so it needs its length too.
    if (isAtStartLimit && startLimit && startWindowDays) {
        return {
            variant: 'startCap',
            used: recentStartCount ?? startLimit,
            limit: startLimit,
            remaining: 0,
            windowDays: startWindowDays,
        };
    }

    if (remaining === 1) {
        return {
            variant: 'nearCap', used, limit, remaining,
        };
    }

    return null;
};

/**
 * What an entitled account's membership row in Settings should say, or null for
 * a free account (which gets the upgrade row instead). Mirrors
 * `getOwnedCopy` on the paywall: decided from evidence of what was bought, not
 * from `isEntitled`, which cannot tell a founder from a subscriber.
 */
export const getMembershipStatus = (
    lifetimeOffer: IHabitsLifetimeOffer | null | undefined,
    premiumOffer: IHabitsPremiumOffer | null | undefined,
): { kind: 'founder'; founderNumber: number | null } | { kind: 'premium' } | { kind: 'entitled' } | null => {
    if (lifetimeOffer?.purchase) {
        const founderNumber = lifetimeOffer.purchase.founderNumber;
        return { kind: 'founder', founderNumber: typeof founderNumber === 'number' ? founderNumber : null };
    }

    if (premiumOffer?.subscription) {
        return { kind: 'premium' };
    }

    if (lifetimeOffer?.isEntitled || premiumOffer?.isEntitled) {
        return { kind: 'entitled' };
    }

    return null;
};
