import { it, describe, expect } from '@jest/globals';

import {
    countActiveHabits,
    getHabitCapacityNudge,
    getMembershipStatus,
    isUpgradePurchasable,
} from '../../main/utilities/upgradeNudge';

/**
 * Every path to the paywall other than a 402 goes through these gates. Each
 * case below is a way a nudge could otherwise advertise something the paywall
 * cannot sell, or interrupt someone who has not earned the interruption.
 */
const buildLifetime = (overrides: any = {}): any => ({
    productId: 'habits_founder_unlock',
    total: 5000,
    claimed: 18,
    remaining: 4982,
    isSoldOut: false,
    isEntitled: false,
    purchase: null,
    isStoreConfigured: true,
    ...overrides,
});

const buildPremium = (overrides: any = {}): any => ({
    productId: 'habits_premium_monthly',
    isEntitled: false,
    subscription: null,
    isStoreConfigured: true,
    ...overrides,
});

const baseArgs = () => ({
    isOfferEnabled: true,
    lifetimeOffer: buildLifetime(),
    premiumOffer: buildPremium(),
    activeHabitCount: 5,
    limit: 5,
});

describe('isUpgradePurchasable', () => {
    it('is true while the founder offer can be bought', () => {
        expect(isUpgradePurchasable(buildLifetime(), null)).toBe(true);
    });

    it('falls through to the monthly plan once the founder offer is sold out', () => {
        expect(isUpgradePurchasable(buildLifetime({ isSoldOut: true, remaining: 0 }), buildPremium())).toBe(true);
    });

    it('is false for an entitled account, whichever offer says so', () => {
        expect(isUpgradePurchasable(buildLifetime({ isEntitled: true }), buildPremium())).toBe(false);
        expect(isUpgradePurchasable(buildLifetime(), buildPremium({ isEntitled: true }))).toBe(false);
    });

    it('is false with nothing loaded, or nothing the store can sell', () => {
        // Also what offline looks like: the interceptor resolves a failed GET with
        // empty data, so neither offer ever lands in Redux.
        expect(isUpgradePurchasable(null, null)).toBe(false);
        expect(isUpgradePurchasable(undefined, undefined)).toBe(false);
        expect(isUpgradePurchasable(
            buildLifetime({ isStoreConfigured: false }),
            buildPremium({ isStoreConfigured: false }),
        )).toBe(false);
    });
});

describe('countActiveHabits', () => {
    it('counts only active tracking rows', () => {
        expect(countActiveHabits([
            { status: 'active' }, { status: 'archived' }, { status: 'active' },
        ] as any)).toBe(2);
    });

    it('is null before the registry has loaded, and zero for an empty one', () => {
        // The two look the same otherwise, and "0 of 5" before the fetch lands
        // would flash a nudge that vanishes.
        expect(countActiveHabits(undefined)).toBeNull();
        expect(countActiveHabits(null)).toBeNull();
        expect(countActiveHabits([])).toBe(0);
    });
});

describe('getHabitCapacityNudge', () => {
    it('reports the cap when every free slot is taken', () => {
        expect(getHabitCapacityNudge(baseArgs())).toEqual({
            variant: 'atCap', used: 5, limit: 5, remaining: 0,
        });
    });

    it('warns in the last slot', () => {
        expect(getHabitCapacityNudge({ ...baseArgs(), activeHabitCount: 4 })).toEqual({
            variant: 'nearCap', used: 4, limit: 5, remaining: 1,
        });
    });

    it('says nothing with two or more slots free', () => {
        // Earlier than the last slot it is an ad on a screen opened every day.
        expect(getHabitCapacityNudge({ ...baseArgs(), activeHabitCount: 3 })).toBeNull();
        expect(getHabitCapacityNudge({ ...baseArgs(), activeHabitCount: 0 })).toBeNull();
    });

    it('treats an over-cap count as at the cap, not as a negative remainder', () => {
        // Possible when the server limit was raised then lowered by env.
        expect(getHabitCapacityNudge({ ...baseArgs(), activeHabitCount: 7 })).toMatchObject({
            variant: 'atCap', used: 7, remaining: 0,
        });
    });

    it('is silent until the tracking registry has loaded', () => {
        expect(getHabitCapacityNudge({ ...baseArgs(), activeHabitCount: null })).toBeNull();
        expect(getHabitCapacityNudge({ ...baseArgs(), activeHabitCount: NaN })).toBeNull();
    });

    it('is silent with the offer flag off, so a Therr build never renders it', () => {
        expect(getHabitCapacityNudge({ ...baseArgs(), isOfferEnabled: false })).toBeNull();
    });

    it('is silent for an entitled account', () => {
        expect(getHabitCapacityNudge({
            ...baseArgs(),
            lifetimeOffer: buildLifetime({ isEntitled: true, purchase: { founderNumber: 3 } }),
        })).toBeNull();
    });

    it('is silent when the paywall would have nothing to sell', () => {
        expect(getHabitCapacityNudge({ ...baseArgs(), lifetimeOffer: null, premiumOffer: null })).toBeNull();
        expect(getHabitCapacityNudge({
            ...baseArgs(),
            lifetimeOffer: buildLifetime({ isSoldOut: true, remaining: 0 }),
            premiumOffer: buildPremium({ isStoreConfigured: false }),
        })).toBeNull();
    });

    it('keeps nudging toward the monthly plan after the founder offer sells out', () => {
        expect(getHabitCapacityNudge({
            ...baseArgs(),
            lifetimeOffer: buildLifetime({ isSoldOut: true, remaining: 0 }),
        })).toMatchObject({ variant: 'atCap' });
    });

    it('is silent for a nonsensical limit', () => {
        expect(getHabitCapacityNudge({ ...baseArgs(), limit: 0 })).toBeNull();
        expect(getHabitCapacityNudge({ ...baseArgs(), limit: NaN })).toBeNull();
    });
});

describe('getMembershipStatus', () => {
    it('names the founder number from the recorded purchase', () => {
        expect(getMembershipStatus(buildLifetime({ isEntitled: true, purchase: { founderNumber: 42 } }), null))
            .toEqual({ kind: 'founder', founderNumber: 42 });
    });

    it('is a founder without a number for a purchase past the seat limit', () => {
        expect(getMembershipStatus(buildLifetime({ isEntitled: true, purchase: { founderNumber: null } }), null))
            .toEqual({ kind: 'founder', founderNumber: null });
    });

    it('tells a subscriber they have the monthly plan, not lifetime access', () => {
        // Both offers report `isEntitled` for a subscriber; only the subscription
        // row says which it is.
        expect(getMembershipStatus(
            buildLifetime({ isEntitled: true }),
            buildPremium({ isEntitled: true, subscription: { id: 'sub-1', status: 'active' } }),
        )).toEqual({ kind: 'premium' });
    });

    it('is a generic entitlement for an admin with nothing bought', () => {
        expect(getMembershipStatus(buildLifetime({ isEntitled: true }), buildPremium({ isEntitled: true })))
            .toEqual({ kind: 'entitled' });
    });

    it('is null for a free account and for nothing loaded', () => {
        expect(getMembershipStatus(buildLifetime(), buildPremium())).toBeNull();
        expect(getMembershipStatus(null, null)).toBeNull();
    });
});
