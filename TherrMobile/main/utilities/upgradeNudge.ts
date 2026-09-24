import { IHabitsLifetimeOffer, IHabitsPremiumOffer, IUserHabit } from 'therr-react/types';
import { shouldShowFounderCta } from '../components/Habits/founderCtaState';

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

export type UpgradeNudgeVariant = 'atCap' | 'nearCap';

export interface IUpgradeNudge {
    variant: UpgradeNudgeVariant;
    used: number;
    limit: number;
    remaining: number;
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

interface IGetCapacityNudgeArgs {
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
