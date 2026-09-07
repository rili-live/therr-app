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
    creatorUserId: 'me',
    durationDays: 30,
    ...overrides,
}) as any;

describe('getHabitsBadgeState', () => {
    it('does not badge invites the user sent', () => {
        // The reported case: two invites sent, none received, badge showed "2".
        const state = getHabitsBadgeState(
            [],
            [pact({ id: 'a' }), pact({ id: 'b' })],
            [],
            'me',
        );

        expect(state.badgeCount).toBe(0);
    });

    it('badges invites awaiting the user\'s reply', () => {
        const state = getHabitsBadgeState(
            [pact({ id: 'in1', creatorUserId: 'them' })],
            [],
            [],
            'me',
        );

        expect(state.badgeCount).toBe(1);
        expect(state.initialTab).toBe('pending');
    });

    it('counts only received invites when the user has both', () => {
        const state = getHabitsBadgeState(
            [pact({ id: 'in1', creatorUserId: 'them' })],
            [pact({ id: 'out1' }), pact({ id: 'out2' })],
            [],
            'me',
        );

        expect(state.badgeCount).toBe(1);
    });

    it('lands on Sent when nothing awaits a reply and there is no active pact', () => {
        const state = getHabitsBadgeState([], [pact()], [], 'me');

        expect(state.badgeCount).toBe(0);
        expect(state.initialTab).toBe('outgoing');
    });

    it('lands on Habits when a pact is active, so check-ins stay one tap away', () => {
        const state = getHabitsBadgeState(
            [],
            [pact(), pact({ id: 'p2', status: 'active' })],
            [pact({ id: 'p2', status: 'active' })],
            'me',
        );

        expect(state.initialTab).toBe('habits');
    });

    it('prefers the reply-needed segment over an active pact', () => {
        // A pending invite is time-sensitive in a way a daily check-in is not,
        // and it is the thing the badge is pointing at.
        const state = getHabitsBadgeState(
            [pact({ id: 'in1', creatorUserId: 'them' })],
            [],
            [pact({ id: 'p2', status: 'active' })],
            'me',
        );

        expect(state.initialTab).toBe('pending');
    });

    it('treats a pending pact created by someone else as not outgoing', () => {
        const state = getHabitsBadgeState([], [pact({ creatorUserId: 'them' })], [], 'me');

        expect(state.initialTab).toBe('habits');
    });

    it('is inert with no user id, rather than claiming every pact is outgoing', () => {
        const state = getHabitsBadgeState([], [pact({ creatorUserId: undefined })], [], undefined);

        expect(state.badgeCount).toBe(0);
        expect(state.initialTab).toBe('habits');
    });

    it('handles undefined slices from a cold store', () => {
        const state = getHabitsBadgeState(undefined, undefined, undefined, 'me');

        expect(state).toEqual({ badgeCount: 0, initialTab: 'habits' });
    });
});
