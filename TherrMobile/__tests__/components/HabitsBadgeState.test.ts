import { it, describe, expect } from '@jest/globals';
import { getHabitsBadgeState } from '../../main/components/ButtonMenu/habitsBadgeState';

/**
 * The Habits tab badge is the app's only always-visible count, so what it means
 * is pinned here.
 *
 * It used to count invites the user had *sent*. That made it a notification
 * about someone else's inaction — no action available to the user cleared it —
 * so an invite nobody answered badged the tab bar for as long as it went
 * unanswered. These cases exist to stop that from being reintroduced, and to
 * keep the landing segment agreeing with whatever the badge is advertising.
 */

const pact = (overrides: any = {}) => ({
    id: 'p1',
    status: 'pending',
    creatorUserId: 'them',
    durationDays: 30,
    ...overrides,
}) as any;

describe('getHabitsBadgeState', () => {
    it('badges invites awaiting the user\'s reply and lands on them', () => {
        const state = getHabitsBadgeState([pact({ id: 'in1' }), pact({ id: 'in2' })]);

        expect(state.badgeCount).toBe(2);
        expect(state.initialTab).toBe('pending');
    });

    it('lands on Habits when nothing awaits a reply, so check-ins stay one tap away', () => {
        // Invites the user *sent* are not an input at all: neither the badge nor
        // the landing segment depends on them. Landing on Sent whenever there was
        // no active pact hid solo habits behind a list the user could not act on.
        const state = getHabitsBadgeState([]);

        expect(state).toEqual({ badgeCount: 0, initialTab: 'habits' });
    });

    it('handles an undefined slice from a cold store', () => {
        const state = getHabitsBadgeState(undefined);

        expect(state).toEqual({ badgeCount: 0, initialTab: 'habits' });
    });
});
