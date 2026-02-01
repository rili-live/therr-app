import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import * as Immutable from 'seamless-immutable';
import { IHabitsState, HabitsActionTypes } from '../../types/redux/habits';

const initialState: IHabitsState = Immutable.from({
    habitGoals: Immutable.from([]),
    templates: Immutable.from([]),
    pacts: Immutable.from([]),
    activePacts: Immutable.from([]),
    pendingInvites: Immutable.from([]),
    checkins: Immutable.from([]),
    todayCheckins: Immutable.from([]),
    streaks: Immutable.from([]),
    activeStreaks: Immutable.from([]),
    milestones: Immutable.from([]),
    isLoading: false,
});

// eslint-disable-next-line default-param-last
const habits = (state: IHabitsState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = Immutable.from(state); // eslint-disable-line no-param-reassign
    }

    switch (action.type) {
        // Loading
        case HabitsActionTypes.HABITS_LOADING:
            return state.setIn(['isLoading'], true);
        case HabitsActionTypes.HABITS_LOADED:
            return state.setIn(['isLoading'], false);

        // Habit Goals
        case HabitsActionTypes.GET_USER_HABIT_GOALS:
            return state.setIn(['habitGoals'], Immutable.from(action.data || []));
        case HabitsActionTypes.GET_HABIT_GOAL_TEMPLATES:
            return state.setIn(['templates'], Immutable.from(action.data || []));
        case HabitsActionTypes.CREATE_HABIT_GOAL: {
            const currentGoals = [...state.habitGoals];
            currentGoals.unshift(action.data);
            return state.setIn(['habitGoals'], currentGoals);
        }
        case HabitsActionTypes.UPDATE_HABIT_GOAL: {
            const goals = [...state.habitGoals];
            const goalIndex = goals.findIndex((g) => g.id === action.data.id);
            if (goalIndex > -1) {
                goals[goalIndex] = action.data;
            }
            return state.setIn(['habitGoals'], goals);
        }
        case HabitsActionTypes.DELETE_HABIT_GOAL: {
            const filteredGoals = state.habitGoals.filter((g) => g.id !== action.data.id);
            return state.setIn(['habitGoals'], filteredGoals);
        }

        // Pacts
        case HabitsActionTypes.GET_USER_PACTS:
            return state.setIn(['pacts'], Immutable.from(action.data || []));
        case HabitsActionTypes.GET_ACTIVE_PACTS:
            return state.setIn(['activePacts'], Immutable.from(action.data || []));
        case HabitsActionTypes.GET_PENDING_INVITES:
            return state.setIn(['pendingInvites'], Immutable.from(action.data || []));
        case HabitsActionTypes.GET_PACT_DETAILS: {
            const existingPacts = [...state.pacts];
            const pactIndex = existingPacts.findIndex((p) => p.id === action.data.id);
            if (pactIndex > -1) {
                existingPacts[pactIndex] = action.data;
            } else {
                existingPacts.push(action.data);
            }
            return state.setIn(['pacts'], existingPacts);
        }
        case HabitsActionTypes.CREATE_PACT: {
            const currentPacts = [...state.pacts];
            currentPacts.unshift(action.data);
            return state.setIn(['pacts'], currentPacts);
        }
        case HabitsActionTypes.ACCEPT_PACT: {
            // Move from pending invites to active pacts
            const newPendingInvites = state.pendingInvites.filter((p) => p.id !== action.data.id);
            const newActivePacts = [...state.activePacts, action.data];
            const updatedPacts = [...state.pacts];
            const pIdx = updatedPacts.findIndex((p) => p.id === action.data.id);
            if (pIdx > -1) {
                updatedPacts[pIdx] = action.data;
            }
            return state
                .setIn(['pendingInvites'], newPendingInvites)
                .setIn(['activePacts'], newActivePacts)
                .setIn(['pacts'], updatedPacts);
        }
        case HabitsActionTypes.DECLINE_PACT: {
            const declinedInvites = state.pendingInvites.filter((p) => p.id !== action.data.id);
            return state.setIn(['pendingInvites'], declinedInvites);
        }
        case HabitsActionTypes.ABANDON_PACT: {
            const abandonedActive = state.activePacts.filter((p) => p.id !== action.data.id);
            const updatedPactsList = [...state.pacts];
            const abandonIdx = updatedPactsList.findIndex((p) => p.id === action.data.id);
            if (abandonIdx > -1) {
                updatedPactsList[abandonIdx] = action.data;
            }
            return state
                .setIn(['activePacts'], abandonedActive)
                .setIn(['pacts'], updatedPactsList);
        }

        // Checkins
        case HabitsActionTypes.GET_TODAY_CHECKINS:
            return state.setIn(['todayCheckins'], Immutable.from(action.data || []));
        case HabitsActionTypes.GET_CHECKINS_BY_RANGE:
            return state.setIn(['checkins'], Immutable.from(action.data || []));
        case HabitsActionTypes.CREATE_CHECKIN: {
            const currentCheckins = [...state.todayCheckins];
            const existingIdx = currentCheckins.findIndex(
                (c) => c.habitGoalId === action.data.habitGoalId && c.scheduledDate === action.data.scheduledDate,
            );
            if (existingIdx > -1) {
                currentCheckins[existingIdx] = action.data;
            } else {
                currentCheckins.unshift(action.data);
            }
            return state.setIn(['todayCheckins'], currentCheckins);
        }
        case HabitsActionTypes.UPDATE_CHECKIN:
        case HabitsActionTypes.SKIP_CHECKIN: {
            const updatedCheckins = [...state.todayCheckins];
            const checkinIdx = updatedCheckins.findIndex((c) => c.id === action.data.id);
            if (checkinIdx > -1) {
                updatedCheckins[checkinIdx] = action.data;
            }
            return state.setIn(['todayCheckins'], updatedCheckins);
        }

        // Streaks
        case HabitsActionTypes.GET_USER_STREAKS:
            return state.setIn(['streaks'], Immutable.from(action.data || []));
        case HabitsActionTypes.GET_ACTIVE_STREAKS:
            return state.setIn(['activeStreaks'], Immutable.from(action.data || []));
        case HabitsActionTypes.GET_STREAK_BY_HABIT: {
            const currentStreaks = [...state.streaks];
            const streakIdx = currentStreaks.findIndex((s) => s.habitGoalId === action.data.habitGoalId);
            if (streakIdx > -1) {
                currentStreaks[streakIdx] = action.data;
            } else if (action.data.id) {
                currentStreaks.push(action.data);
            }
            return state.setIn(['streaks'], currentStreaks);
        }
        case HabitsActionTypes.GET_MILESTONES:
            return state.setIn(['milestones'], Immutable.from(action.data || []));
        case HabitsActionTypes.USE_GRACE_DAY: {
            const gracedStreaks = [...state.streaks];
            const graceIdx = gracedStreaks.findIndex((s) => s.id === action.data.id);
            if (graceIdx > -1) {
                gracedStreaks[graceIdx] = action.data;
            }
            const gracedActive = [...state.activeStreaks];
            const graceActiveIdx = gracedActive.findIndex((s) => s.id === action.data.id);
            if (graceActiveIdx > -1) {
                gracedActive[graceActiveIdx] = action.data;
            }
            return state
                .setIn(['streaks'], gracedStreaks)
                .setIn(['activeStreaks'], gracedActive);
        }

        // Reset
        case HabitsActionTypes.RESET_HABITS:
        case SocketClientActionTypes.LOGOUT:
            return initialState;

        default:
            return state;
    }
};

export default habits;
