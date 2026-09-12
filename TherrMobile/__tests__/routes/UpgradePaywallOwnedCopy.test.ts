import { it, describe, expect, jest } from '@jest/globals';

// The paywall module pulls in firebase analytics at import time; the native side
// is not what this file is about.
jest.mock('@react-native-firebase/analytics', () => ({
    __esModule: true,
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

import { getOwnedCopy } from '../../main/routes/Habits/UpgradePaywall';

/**
 * Both offer endpoints derive `isEntitled` from the same access-level check,
 * which is true for a lifetime founder AND for a monthly subscriber. The
 * paywall used to pick its "already owned" line off `lifetimeOffer.isEntitled`,
 * so every subscriber was told they had lifetime access. The line has to come
 * from what the account actually bought.
 */
describe('UpgradePaywall owned copy', () => {
    it('tells a monthly subscriber they have a subscription, not lifetime access', () => {
        expect(getOwnedCopy(
            { isEntitled: true, purchase: null },
            { isEntitled: true, subscription: { id: 'sub-1', status: 'active' } },
        )).toEqual({ key: 'pages.upgrade.premium.owned' });
    });

    it('names the founder number when the account holds a founder purchase', () => {
        expect(getOwnedCopy(
            { isEntitled: true, purchase: { founderNumber: 12 } },
            { isEntitled: true, subscription: null },
        )).toEqual({ key: 'pages.upgrade.ownedWithNumber', params: { number: 12 } });
    });

    it('prefers the founder purchase when the account somehow holds both', () => {
        expect(getOwnedCopy(
            { isEntitled: true, purchase: { founderNumber: 3 } },
            { isEntitled: true, subscription: { id: 'sub-1' } },
        ).key).toBe('pages.upgrade.ownedWithNumber');
    });

    it('falls back to the lifetime line for a founder purchase with no number', () => {
        expect(getOwnedCopy({ purchase: { id: 'p-1' } }, null))
            .toEqual({ key: 'pages.upgrade.owned' });
    });

    it('uses the generic line for an account entitled without any purchase', () => {
        // An admin: entitled by access level, nothing bought on either offer.
        expect(getOwnedCopy({ isEntitled: true }, { isEntitled: true }))
            .toEqual({ key: 'pages.upgrade.owned' });
        expect(getOwnedCopy(null, null)).toEqual({ key: 'pages.upgrade.owned' });
    });
});
