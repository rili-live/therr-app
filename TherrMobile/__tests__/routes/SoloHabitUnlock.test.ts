import { it, describe, expect } from '@jest/globals';
import { hasSentPactInvite } from '../../main/routes/Habits/pactState';

/**
 * The solo-habit onboarding gate.
 *
 * Friends with Habits requires you to invite someone before you can start. The
 * problem that gate created is that it measured the *friend's* action: gating
 * on an accepted pact meant a user whose friend never installed the app sat on
 * the onboarding overlay forever, unable to track anything at all.
 *
 * `hasSentPactInvite` moves the test back onto something the user controls —
 * did they send the invitation. These cases pin that distinction, since the two
 * conditions look interchangeable until you hit the case where they aren't.
 */
const pact = (overrides: any = {}): any => ({
    id: 'pact-1',
    creatorUserId: 'me',
    habitGoalId: 'goal-1',
    pactType: 'accountability',
    status: 'pending',
    durationDays: 30,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
});

describe('hasSentPactInvite', () => {
    it('is false for a user who has done nothing', () => {
        expect(hasSentPactInvite([], 'me')).toBe(false);
    });

    it('is true once the user has created a pact awaiting a partner', () => {
        // The case the whole feature exists for: the invite is out, the friend
        // has not answered, and the user must not be stuck.
        expect(hasSentPactInvite([pact()], 'me')).toBe(true);
    });

    it('is false when the only pending pact was created by someone else', () => {
        // Being invited is not evidence that this user did any inviting;
        // otherwise the onboarding requirement could be satisfied entirely by
        // a friend, which is exactly what it exists to prevent.
        expect(hasSentPactInvite([pact({ creatorUserId: 'someone-else' })], 'me')).toBe(false);
    });

    it('is false for the user\'s own pacts that are no longer pending', () => {
        // An active pact releases the gate through the other condition, and a
        // completed or abandoned one is not an outstanding invitation.
        expect(hasSentPactInvite([pact({ status: 'active' })], 'me')).toBe(false);
        expect(hasSentPactInvite([pact({ status: 'completed' })], 'me')).toBe(false);
        expect(hasSentPactInvite([pact({ status: 'abandoned' })], 'me')).toBe(false);
    });

    it('finds a sent invite among a mixed list', () => {
        const pacts = [
            pact({ id: 'a', creatorUserId: 'someone-else' }),
            pact({ id: 'b', status: 'active' }),
            pact({ id: 'c' }),
        ];

        expect(hasSentPactInvite(pacts, 'me')).toBe(true);
    });

    it('is false when the current user is unknown', () => {
        // A missing user id must never match a pact's creatorUserId by accident
        // — an undefined-equals-undefined comparison would unlock the gate for
        // everyone while the user record is still loading.
        expect(hasSentPactInvite([pact({ creatorUserId: undefined })], undefined)).toBe(false);
    });
});
