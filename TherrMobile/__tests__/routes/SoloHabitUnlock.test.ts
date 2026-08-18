import { it, describe, expect } from '@jest/globals';
import { hasSentPactInvite, hasTrackedHabit } from '../../main/routes/Habits/pactState';

/**
 * One of the three conditions that release the habits onboarding overlay.
 *
 * The overlay clears on an active pact, on an invite the user has sent that
 * nobody has answered yet, or on the user having a habit of their own. This
 * predicate is the middle one. Gating on an *accepted* pact alone measured the
 * friend's action rather than the user's: someone whose friend never installed
 * the app sat on the overlay forever, unable to track anything.
 *
 * `hasSentPactInvite` puts the test back on something the user controls — did
 * they send the invitation. These cases pin that distinction, since the two
 * conditions look interchangeable until you hit the case where they aren't.
 *
 * Note this is no longer a gate on creating a habit; a personal habit needs no
 * invite at all. See `routes/Pacts/wizardSteps.ts`.
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

describe('hasTrackedHabit', () => {
    it('is false for a goal the user composed but never started tracking', () => {
        // The orphan. The wizard writes the goal, then calls the endpoint that
        // begins tracking it; a 402 at the free-tier cap or a 403 at the solo
        // threshold lands in between and leaves the goal behind. Counting it
        // lifted the onboarding overlay for a user holding nothing.
        expect(hasTrackedHabit(0, 0, 1)).toBe(false);
    });

    it('is true once the server confirms a habit is being tracked', () => {
        expect(hasTrackedHabit(1, 0, 1)).toBe(true);
    });

    it('trusts the server count over a stale local goal list', () => {
        // Goals can lag or run ahead of what is actually tracked in both
        // directions; the count is the authority either way.
        expect(hasTrackedHabit(2, 0, 0)).toBe(true);
        expect(hasTrackedHabit(0, 0, 5)).toBe(false);
    });

    it('is true the instant a habit is started, before the server count catches up', () => {
        // The regression this guards. Starting a habit navigates straight to
        // the dashboard, and the local list is updated well before the refetch
        // it races — so a stale zero from the server must not win here, or the
        // overlay flashes back at the user in the moment they succeeded.
        expect(hasTrackedHabit(0, 1, 1)).toBe(true);
    });

    it('falls back to the goal count while eligibility has not loaded', () => {
        // No count to consult yet. Flashing a full-screen onboarding overlay at
        // someone who has used the app for months is worse than briefly
        // trusting a goal that is almost always real.
        [null, undefined].forEach((notLoaded) => {
            expect(hasTrackedHabit(notLoaded, 0, 1)).toBe(true);
            expect(hasTrackedHabit(notLoaded, 0, 0)).toBe(false);
        });
    });
});
