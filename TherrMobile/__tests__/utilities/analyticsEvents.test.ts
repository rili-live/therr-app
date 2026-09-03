import {
    it, describe, expect, beforeEach, jest,
} from '@jest/globals';

jest.mock('@react-native-firebase/analytics', () => ({
    __esModule: true,
    getAnalytics: jest.fn(() => ({ __instance: true })),
    logEvent: jest.fn(() => Promise.resolve()),
}));

import { logEvent } from '@react-native-firebase/analytics';
import { logAppEvent } from '../../main/utilities/analyticsEvents';

/**
 * Both behaviours here exist because their absence is silent.
 *
 * A rejected `logEvent` inside a check-in or a purchase would surface to the
 * user as that action failing, and an `undefined` param reaches Firebase as the
 * string "undefined" — a funnel grouped on `userId` then reports a cohort that
 * does not exist rather than reporting a gap.
 */
describe('logAppEvent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (logEvent as jest.Mock).mockImplementation(() => Promise.resolve());
    });

    it('forwards the event name and its defined params', () => {
        logAppEvent('habit_checkin_complete', { userId: 'user-1', source: 'dashboard' });

        expect(logEvent).toHaveBeenCalledWith(
            expect.anything(),
            'habit_checkin_complete',
            { userId: 'user-1', source: 'dashboard' },
        );
    });

    it('omits an undefined param rather than sending the string "undefined"', () => {
        // `userId` is read off a user record a push-driven path may not have
        // loaded. Firebase records undefined as a literal, turning a missing
        // value into a populated wrong one.
        logAppEvent('habit_checkin_complete', { userId: undefined, source: 'pushAction' });

        expect(logEvent).toHaveBeenCalledWith(
            expect.anything(),
            'habit_checkin_complete',
            { source: 'pushAction' },
        );
    });

    it('omits a null param for the same reason', () => {
        logAppEvent('habits_founder_unlock_purchase', { value: null, currency: null, isRecovery: false });

        expect(logEvent).toHaveBeenCalledWith(
            expect.anything(),
            'habits_founder_unlock_purchase',
            { isRecovery: false },
        );
    });

    it('keeps a falsy-but-real value', () => {
        logAppEvent('habit_pact_create', { partnerCount: 0, hasProof: false });

        expect(logEvent).toHaveBeenCalledWith(
            expect.anything(),
            'habit_pact_create',
            { partnerCount: 0, hasProof: false },
        );
    });

    it('swallows a rejection so measurement cannot break what it measures', async () => {
        (logEvent as jest.Mock).mockImplementation(
            () => Promise.reject(new Error('analytics not initialized')),
        );

        // The helper logs the swallowed error; keep it out of the test output.
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

        try {
            expect(() => logAppEvent('habits_paywall_view', { userId: 'user-1' })).not.toThrow();

            // Nothing to await on the caller's side, so let the rejection land.
            await Promise.resolve();
            await Promise.resolve();
        } finally {
            logSpy.mockRestore();
        }
    });

    it('is callable with no params at all', () => {
        logAppEvent('habit_solo_start');

        expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'habit_solo_start', {});
    });
});
