import reducer from '../habits';
import { HabitsActionTypes } from '../../../types/redux/habits';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';

describe('habits reducer', () => {
    let initialState: any;

    beforeEach(() => {
        initialState = reducer(undefined, { type: '@@INIT' });
    });

    it('returns initial state with correct shape', () => {
        expect(Array.from(initialState.habitGoals)).toEqual([]);
        expect(Array.from(initialState.pacts)).toEqual([]);
        expect(Array.from(initialState.checkins)).toEqual([]);
        expect(Array.from(initialState.streaks)).toEqual([]);
        expect(initialState.isLoading).toBe(false);
    });

    // Loading
    it('handles HABITS_LOADING', () => {
        const result = reducer(initialState, { type: HabitsActionTypes.HABITS_LOADING });
        expect(result.isLoading).toBe(true);
    });

    it('handles HABITS_LOADED', () => {
        const loading = reducer(initialState, { type: HabitsActionTypes.HABITS_LOADING });
        const result = reducer(loading, { type: HabitsActionTypes.HABITS_LOADED });
        expect(result.isLoading).toBe(false);
    });

    // Habit Goals
    it('handles GET_USER_HABIT_GOALS', () => {
        const goals = [{ id: 'g1', name: 'Exercise' }];
        const result = reducer(initialState, {
            type: HabitsActionTypes.GET_USER_HABIT_GOALS,
            data: goals,
        });
        expect(result.habitGoals.length).toBe(1);
        expect(result.habitGoals[0].name).toBe('Exercise');
    });

    it('handles GET_USER_HABIT_GOALS with null data', () => {
        const result = reducer(initialState, {
            type: HabitsActionTypes.GET_USER_HABIT_GOALS,
            data: null,
        });
        expect(Array.from(result.habitGoals)).toEqual([]);
    });

    it('handles GET_HABIT_GOAL_TEMPLATES', () => {
        const result = reducer(initialState, {
            type: HabitsActionTypes.GET_HABIT_GOAL_TEMPLATES,
            data: [{ id: 't1', name: 'Template' }],
        });
        expect(result.templates.length).toBe(1);
    });

    it('handles CREATE_HABIT_GOAL by prepending', () => {
        const populated = reducer(initialState, {
            type: HabitsActionTypes.GET_USER_HABIT_GOALS,
            data: [{ id: 'g1' }],
        });
        const result = reducer(populated, {
            type: HabitsActionTypes.CREATE_HABIT_GOAL,
            data: { id: 'g2', name: 'New' },
        });
        expect(result.habitGoals.length).toBe(2);
        expect(result.habitGoals[0].id).toBe('g2');
    });

    it('handles UPDATE_HABIT_GOAL', () => {
        const populated = reducer(initialState, {
            type: HabitsActionTypes.GET_USER_HABIT_GOALS,
            data: [{ id: 'g1', name: 'Original' }],
        });
        const result = reducer(populated, {
            type: HabitsActionTypes.UPDATE_HABIT_GOAL,
            data: { id: 'g1', name: 'Updated' },
        });
        expect(result.habitGoals[0].name).toBe('Updated');
    });

    it('handles DELETE_HABIT_GOAL', () => {
        const populated = reducer(initialState, {
            type: HabitsActionTypes.GET_USER_HABIT_GOALS,
            data: [{ id: 'g1' }, { id: 'g2' }],
        });
        const result = reducer(populated, {
            type: HabitsActionTypes.DELETE_HABIT_GOAL,
            data: { id: 'g1' },
        });
        expect(result.habitGoals.length).toBe(1);
        expect(result.habitGoals[0].id).toBe('g2');
    });

    // Pacts
    it('handles GET_USER_PACTS', () => {
        const result = reducer(initialState, {
            type: HabitsActionTypes.GET_USER_PACTS,
            data: [{ id: 'p1' }],
        });
        expect(result.pacts.length).toBe(1);
    });

    it('handles GET_ACTIVE_PACTS', () => {
        const result = reducer(initialState, {
            type: HabitsActionTypes.GET_ACTIVE_PACTS,
            data: [{ id: 'p1' }],
        });
        expect(result.activePacts.length).toBe(1);
    });

    it('handles GET_PENDING_INVITES', () => {
        const result = reducer(initialState, {
            type: HabitsActionTypes.GET_PENDING_INVITES,
            data: [{ id: 'p1' }],
        });
        expect(result.pendingInvites.length).toBe(1);
    });

    it('handles CREATE_PACT by prepending', () => {
        const result = reducer(initialState, {
            type: HabitsActionTypes.CREATE_PACT,
            data: { id: 'p1', status: 'pending' },
        });
        expect(result.pacts.length).toBe(1);
        expect(result.pacts[0].id).toBe('p1');
    });

    it('handles ACCEPT_PACT (moves from pending to active)', () => {
        const withPending = reducer(initialState, {
            type: HabitsActionTypes.GET_PENDING_INVITES,
            data: [{ id: 'p1', status: 'pending' }],
        });
        const withPacts = reducer(withPending, {
            type: HabitsActionTypes.GET_USER_PACTS,
            data: [{ id: 'p1', status: 'pending' }],
        });
        const result = reducer(withPacts, {
            type: HabitsActionTypes.ACCEPT_PACT,
            data: { id: 'p1', status: 'active' },
        });
        expect(result.pendingInvites.length).toBe(0);
        expect(result.activePacts.length).toBe(1);
        expect(result.pacts[0].status).toBe('active');
    });

    it('handles DECLINE_PACT', () => {
        const withPending = reducer(initialState, {
            type: HabitsActionTypes.GET_PENDING_INVITES,
            data: [{ id: 'p1' }, { id: 'p2' }],
        });
        const result = reducer(withPending, {
            type: HabitsActionTypes.DECLINE_PACT,
            data: { id: 'p1' },
        });
        expect(result.pendingInvites.length).toBe(1);
        expect(result.pendingInvites[0].id).toBe('p2');
    });

    it('handles ABANDON_PACT', () => {
        const populated = reducer(initialState, {
            type: HabitsActionTypes.GET_ACTIVE_PACTS,
            data: [{ id: 'p1' }],
        });
        const withPacts = reducer(populated, {
            type: HabitsActionTypes.GET_USER_PACTS,
            data: [{ id: 'p1', status: 'active' }],
        });
        const result = reducer(withPacts, {
            type: HabitsActionTypes.ABANDON_PACT,
            data: { id: 'p1', status: 'abandoned' },
        });
        expect(result.activePacts.length).toBe(0);
        expect(result.pacts[0].status).toBe('abandoned');
    });

    // Checkins
    it('handles GET_TODAY_CHECKINS', () => {
        const result = reducer(initialState, {
            type: HabitsActionTypes.GET_TODAY_CHECKINS,
            data: [{ id: 'c1' }],
        });
        expect(result.todayCheckins.length).toBe(1);
    });

    it('handles CREATE_CHECKIN (new)', () => {
        const result = reducer(initialState, {
            type: HabitsActionTypes.CREATE_CHECKIN,
            data: { id: 'c1', habitGoalId: 'g1', scheduledDate: '2024-01-01' },
        });
        expect(result.todayCheckins.length).toBe(1);
    });

    it('handles CREATE_CHECKIN (updates existing by habitGoalId+scheduledDate)', () => {
        const populated = reducer(initialState, {
            type: HabitsActionTypes.GET_TODAY_CHECKINS,
            data: [{ id: 'c1', habitGoalId: 'g1', scheduledDate: '2024-01-01', status: 'pending' }],
        });
        const result = reducer(populated, {
            type: HabitsActionTypes.CREATE_CHECKIN,
            data: { id: 'c1', habitGoalId: 'g1', scheduledDate: '2024-01-01', status: 'completed' },
        });
        expect(result.todayCheckins.length).toBe(1);
        expect(result.todayCheckins[0].status).toBe('completed');
    });

    it('handles UPDATE_CHECKIN', () => {
        const populated = reducer(initialState, {
            type: HabitsActionTypes.GET_TODAY_CHECKINS,
            data: [{ id: 'c1', status: 'pending' }],
        });
        const result = reducer(populated, {
            type: HabitsActionTypes.UPDATE_CHECKIN,
            data: { id: 'c1', status: 'completed' },
        });
        expect(result.todayCheckins[0].status).toBe('completed');
    });

    // Streaks
    it('handles GET_USER_STREAKS', () => {
        const result = reducer(initialState, {
            type: HabitsActionTypes.GET_USER_STREAKS,
            data: [{ id: 's1', currentStreak: 5 }],
        });
        expect(result.streaks.length).toBe(1);
    });

    it('handles GET_ACTIVE_STREAKS', () => {
        const result = reducer(initialState, {
            type: HabitsActionTypes.GET_ACTIVE_STREAKS,
            data: [{ id: 's1' }],
        });
        expect(result.activeStreaks.length).toBe(1);
    });

    it('handles GET_MILESTONES', () => {
        const result = reducer(initialState, {
            type: HabitsActionTypes.GET_MILESTONES,
            data: [{ id: 'm1' }],
        });
        expect(result.milestones.length).toBe(1);
    });

    it('handles USE_GRACE_DAY (updates both streaks and activeStreaks)', () => {
        let state = reducer(initialState, {
            type: HabitsActionTypes.GET_USER_STREAKS,
            data: [{ id: 's1', graceDaysUsed: 0 }],
        });
        state = reducer(state, {
            type: HabitsActionTypes.GET_ACTIVE_STREAKS,
            data: [{ id: 's1', graceDaysUsed: 0 }],
        });
        const result = reducer(state, {
            type: HabitsActionTypes.USE_GRACE_DAY,
            data: { id: 's1', graceDaysUsed: 1 },
        });
        expect(result.streaks[0].graceDaysUsed).toBe(1);
        expect(result.activeStreaks[0].graceDaysUsed).toBe(1);
    });

    // Reset
    it('handles RESET_HABITS', () => {
        const populated = reducer(initialState, {
            type: HabitsActionTypes.GET_USER_HABIT_GOALS,
            data: [{ id: 'g1' }],
        });
        const result = reducer(populated, {
            type: HabitsActionTypes.RESET_HABITS,
        });
        expect(Array.from(result.habitGoals)).toEqual([]);
        expect(result.isLoading).toBe(false);
    });

    it('handles LOGOUT', () => {
        const populated = reducer(initialState, {
            type: HabitsActionTypes.GET_USER_PACTS,
            data: [{ id: 'p1' }],
        });
        const result = reducer(populated, {
            type: SocketClientActionTypes.LOGOUT,
        });
        expect(Array.from(result.pacts)).toEqual([]);
    });

    it('returns state unchanged for unknown action', () => {
        const result = reducer(initialState, { type: 'UNKNOWN_ACTION' });
        expect(result).toBe(initialState);
    });
});
