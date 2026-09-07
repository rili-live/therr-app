import { it, describe, expect } from '@jest/globals';
import { splitHabitsByPactState } from '../../main/routes/Habits/pactState';

/**
 * Habits dashboard pact-state regression tests.
 *
 * The dashboard used to render `habits.habitGoals` with no pact awareness at
 * all, which produced two visible bugs at once:
 *
 *   1. Goals whose pact was still awaiting an invitee's acceptance were shown
 *      with a live "Check In" button, as though the pact had started.
 *   2. Goals joined by accepting someone else's invite never appeared, because
 *      the goal row belongs to the inviter. The pact the user had actually
 *      committed to was the one habit they could not see or check into.
 *
 * `splitHabitsByPactState` is the fix's decision point: it pairs each goal
 * with the state of its pacts so live habits and pending ones render
 * differently. (The companion server fix makes joined goals appear in
 * `habitGoals` in the first place — see HabitGoalsStore.getByUserId.)
 */

const goal = (id: string): any => ({
    id,
    name: `Habit ${id}`,
    goalType: 'build_good',
    frequencyType: 'daily',
    frequencyCount: 1,
    createdByUserId: 'inviter-1',
    isTemplate: false,
    isPublic: false,
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
});

const member = (userId: string, role: string, status: string, firstName?: string, userName?: string): any => ({
    id: `member-${userId}`,
    pactId: 'pact-x',
    userId,
    role,
    status,
    firstName,
    userName,
    totalCheckins: 0,
    completedCheckins: 0,
    currentStreak: 0,
    longestStreak: 0,
});

const pact = (id: string, habitGoalId: string, status: string, members: any[]): any => ({
    id,
    creatorUserId: 'inviter-1',
    habitGoalId,
    pactType: 'accountability',
    status,
    durationDays: 30,
    members,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('splitHabitsByPactState', () => {
    it('lists a habit whose pact is active as live', () => {
        const activePact = pact('pact-1', 'goal-1', 'active', [
            member('me', 'creator', 'active'),
            member('friend', 'partner', 'active', 'Dana'),
        ]);

        const { live, pending } = splitHabitsByPactState(
            [goal('goal-1')],
            [activePact],
            [activePact],
            'me',
        );

        expect(pending).toHaveLength(0);
        expect(live).toHaveLength(1);
        expect(live[0].goal.id).toBe('goal-1');
        expect(live[0].partnerNames).toEqual(['Dana']);
        expect(live[0].awaitingPartnerNames).toEqual([]);
    });

    it('lists a habit whose only pact is awaiting acceptance as pending', () => {
        const pendingPact = pact('pact-1', 'goal-1', 'pending', [
            member('me', 'creator', 'active'),
            member('friend', 'partner', 'pending', 'Dana'),
        ]);

        const { live, pending } = splitHabitsByPactState(
            [goal('goal-1')],
            [],
            [pendingPact],
            'me',
        );

        expect(live).toHaveLength(0);
        expect(pending).toHaveLength(1);
        expect(pending[0].awaitingPartnerNames).toEqual(['Dana']);
    });

    // The reported bug: two outstanding invites rendered as checkin-able while
    // the pact the user had accepted was missing entirely.
    it('separates outstanding invites from the pact the user accepted', () => {
        const pendingA = pact('pact-a', 'goal-a', 'pending', [
            member('me', 'creator', 'active'),
            member('friend-a', 'partner', 'pending', 'Dana'),
        ]);
        const pendingB = pact('pact-b', 'goal-b', 'pending', [
            member('me', 'creator', 'active'),
            member('friend-b', 'partner', 'pending', undefined, 'sam99'),
        ]);
        const joined = pact('pact-c', 'goal-c', 'active', [
            member('inviter-1', 'creator', 'active', 'Riley'),
            member('me', 'partner', 'active'),
        ]);

        const { live, pending } = splitHabitsByPactState(
            [goal('goal-a'), goal('goal-b'), goal('goal-c')],
            [joined],
            [pendingA, pendingB, joined],
            'me',
        );

        expect(live.map((h) => h.goal.id)).toEqual(['goal-c']);
        expect(pending.map((h) => h.goal.id)).toEqual(['goal-a', 'goal-b']);
        expect(pending[0].awaitingPartnerNames).toEqual(['Dana']);
        // Falls back to the username when the invitee has no name on file.
        expect(pending[1].awaitingPartnerNames).toEqual(['sam99']);
    });

    it('keeps a habit live once any one of its pacts is active', () => {
        const pendingPact = pact('pact-1', 'goal-1', 'pending', [
            member('me', 'creator', 'active'),
            member('friend-b', 'partner', 'pending', 'Sam'),
        ]);
        const activePact = pact('pact-2', 'goal-1', 'active', [
            member('me', 'creator', 'active'),
            member('friend-a', 'partner', 'active', 'Dana'),
        ]);

        const { live, pending } = splitHabitsByPactState(
            [goal('goal-1')],
            [activePact],
            [pendingPact, activePact],
            'me',
        );

        expect(pending).toHaveLength(0);
        expect(live[0].partnerNames).toEqual(['Dana']);
    });

    // Defensive: never strand a habit behind a pact state we can't see.
    it('treats a habit with no pacts at all as live', () => {
        const { live, pending } = splitHabitsByPactState([goal('goal-1')], [], [], 'me');

        expect(pending).toHaveLength(0);
        expect(live).toHaveLength(1);
        expect(live[0].partnerNames).toEqual([]);
    });

    it('excludes the current user and non-partner roles from partner names', () => {
        const activePact = pact('pact-1', 'goal-1', 'active', [
            member('inviter-1', 'creator', 'active', 'Riley'),
            member('me', 'partner', 'active', 'Me'),
            member('friend', 'partner', 'active', 'Dana'),
        ]);

        const { live } = splitHabitsByPactState([goal('goal-1')], [activePact], [activePact], 'me');

        expect(live[0].partnerNames).toEqual(['Dana']);
    });

    it('does not name partners who have not accepted on an active pact', () => {
        const activePact = pact('pact-1', 'goal-1', 'active', [
            member('me', 'creator', 'active'),
            member('friend-a', 'partner', 'active', 'Dana'),
            member('friend-b', 'partner', 'pending', 'Sam'),
        ]);

        const { live } = splitHabitsByPactState([goal('goal-1')], [activePact], [activePact], 'me');

        expect(live[0].partnerNames).toEqual(['Dana']);
    });

    it('tolerates pacts that arrive without hydrated members', () => {
        const pendingPact = pact('pact-1', 'goal-1', 'pending', undefined as any);

        const { live, pending } = splitHabitsByPactState([goal('goal-1')], [], [pendingPact], 'me');

        expect(live).toHaveLength(0);
        expect(pending[0].awaitingPartnerNames).toEqual([]);
    });
});
