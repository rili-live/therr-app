import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

let mockLifetimeOfferEnabled = true;

jest.mock('../../main/utilities/getConfig', () => ({
    __esModule: true,
    default: () => ({ featureFlags: { ENABLE_HABITS_LIFETIME_OFFER: mockLifetimeOfferEnabled } }),
}));

import { getHabitCapPaywallParams } from '../../main/utilities/habitCapPaywall';

const CAP_REFUSAL = {
    statusCode: 402,
    message: 'Free accounts can track 5 habits at a time.',
    error: 'habit-limit-reached',
    limit: 5,
    upgradeRequired: true,
};

describe('getHabitCapPaywallParams', () => {
    beforeEach(() => {
        mockLifetimeOfferEnabled = true;
    });

    it('returns paywall params for a 402 at the habit cap', () => {
        expect(getHabitCapPaywallParams(CAP_REFUSAL)).toEqual({ reason: 'habit-limit-reached', limit: 5 });
    });

    it('carries the start-window numbers through for a start-limit refusal', () => {
        // The paywall's header needs both to say why: "5 every 30 days".
        expect(getHabitCapPaywallParams({
            statusCode: 402,
            error: 'habit-start-limit-reached',
            limit: 3,
            startLimit: 5,
            startWindowDays: 30,
            recentStartCount: 5,
            upgradeRequired: true,
        }, 'create-pact')).toEqual({
            reason: 'habit-start-limit-reached',
            limit: 3,
            startLimit: 5,
            startWindowDays: 30,
            source: 'create-pact',
        });
    });

    it('omits the start-window fields when an older server did not send them', () => {
        expect(getHabitCapPaywallParams(CAP_REFUSAL)).not.toHaveProperty('startLimit');
        expect(getHabitCapPaywallParams(CAP_REFUSAL)).not.toHaveProperty('startWindowDays');
    });

    it('defaults the reason when the body does not name one', () => {
        expect(getHabitCapPaywallParams({ statusCode: 402 })).toEqual({ reason: 'habit-limit-reached', limit: undefined });
    });

    // `UpgradePaywall` is not registered with the offer off, and navigating to it
    // would silently do nothing — the caller has to fall back to its toast.
    it('returns null when the paywall route is not registered', () => {
        mockLifetimeOfferEnabled = false;

        expect(getHabitCapPaywallParams(CAP_REFUSAL)).toBeNull();
    });

    it('returns null for anything that is not a 402', () => {
        expect(getHabitCapPaywallParams({ statusCode: 403, error: 'solo-locked' })).toBeNull();
        expect(getHabitCapPaywallParams({ statusCode: 500, message: 'SQL:X:ERROR' })).toBeNull();
        expect(getHabitCapPaywallParams(new Error('Network Error'))).toBeNull();
    });
});
