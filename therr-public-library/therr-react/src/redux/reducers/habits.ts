import { produce } from 'immer';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IHabitsState, HabitsActionTypes } from '../../types/redux/habits';

const initialState: IHabitsState = {
    habitGoals: [],
    templates: [],
    pacts: [],
    activePacts: [],
    pendingInvites: [],
    checkins: [],
    todayCheckins: [],
    streaks: [],
    activeStreaks: [],
    milestones: [],
    isLoading: false,
};

// eslint-disable-next-line default-param-last
const habits = produce((draft: IHabitsState, action: any) => {
    switch (action.type) {
        // Loading
        case HabitsActionTypes.HABITS_LOADING:
            draft.isLoading = true;
            break;
        case HabitsActionTypes.HABITS_LOADED:
            draft.isLoading = false;
            break;

        // Habit Goals
        case HabitsActionTypes.GET_USER_HABIT_GOALS:
            draft.habitGoals = action.data || [];
            break;
        case HabitsActionTypes.GET_HABIT_GOAL_TEMPLATES:
            draft.templates = action.data || [];
            break;
        case HabitsActionTypes.CREATE_HABIT_GOAL:
            draft.habitGoals.unshift(action.data);
            break;
        case HabitsActionTypes.UPDATE_HABIT_GOAL: {
            const goalIndex = draft.habitGoals.findIndex((g) => g.id === action.data.id);
            if (goalIndex > -1) {
                draft.habitGoals[goalIndex] = action.data;
            }
            break;
        }
        case HabitsActionTypes.DELETE_HABIT_GOAL:
            draft.habitGoals = draft.habitGoals.filter((g) => g.id !== action.data.id);
            break;

        // Pacts
        case HabitsActionTypes.GET_USER_PACTS:
            draft.pacts = action.data || [];
            break;
        case HabitsActionTypes.GET_ACTIVE_PACTS:
            draft.activePacts = action.data || [];
            break;
        case HabitsActionTypes.GET_PENDING_INVITES:
            draft.pendingInvites = action.data || [];
            break;
        case HabitsActionTypes.GET_PACT_DETAILS: {
            const pactIndex = draft.pacts.findIndex((p) => p.id === action.data.id);
            if (pactIndex > -1) {
                draft.pacts[pactIndex] = action.data;
            } else {
                draft.pacts.push(action.data);
            }
            break;
        }
        case HabitsActionTypes.CREATE_PACT:
            draft.pacts.unshift(action.data);
            break;
        case HabitsActionTypes.ACCEPT_PACT: {
            // Move from pending invites to active pacts
            draft.pendingInvites = draft.pendingInvites.filter((p) => p.id !== action.data.id);
            draft.activePacts.push(action.data);
            const pIdx = draft.pacts.findIndex((p) => p.id === action.data.id);
            if (pIdx > -1) {
                draft.pacts[pIdx] = action.data;
            }
            break;
        }
        case HabitsActionTypes.DECLINE_PACT:
            draft.pendingInvites = draft.pendingInvites.filter((p) => p.id !== action.data.id);
            break;
        case HabitsActionTypes.ABANDON_PACT: {
            draft.activePacts = draft.activePacts.filter((p) => p.id !== action.data.id);
            const abandonIdx = draft.pacts.findIndex((p) => p.id === action.data.id);
            if (abandonIdx > -1) {
                draft.pacts[abandonIdx] = action.data;
            }
            break;
        }

        // Checkins
        case HabitsActionTypes.GET_TODAY_CHECKINS:
            draft.todayCheckins = action.data || [];
            break;
        case HabitsActionTypes.GET_CHECKINS_BY_RANGE:
            draft.checkins = action.data || [];
            break;
        case HabitsActionTypes.CREATE_CHECKIN: {
            const existingIdx = draft.todayCheckins.findIndex(
                (c) => c.habitGoalId === action.data.habitGoalId && c.scheduledDate === action.data.scheduledDate,
            );
            if (existingIdx > -1) {
                draft.todayCheckins[existingIdx] = action.data;
            } else {
                draft.todayCheckins.unshift(action.data);
            }
            break;
        }
        case HabitsActionTypes.UPDATE_CHECKIN:
        case HabitsActionTypes.SKIP_CHECKIN: {
            const checkinIdx = draft.todayCheckins.findIndex((c) => c.id === action.data.id);
            if (checkinIdx > -1) {
                draft.todayCheckins[checkinIdx] = action.data;
            }
            break;
        }

        // Streaks
        case HabitsActionTypes.GET_USER_STREAKS:
            draft.streaks = action.data || [];
            break;
        case HabitsActionTypes.GET_ACTIVE_STREAKS:
            draft.activeStreaks = action.data || [];
            break;
        case HabitsActionTypes.GET_STREAK_BY_HABIT: {
            const streakIdx = draft.streaks.findIndex((s) => s.habitGoalId === action.data.habitGoalId);
            if (streakIdx > -1) {
                draft.streaks[streakIdx] = action.data;
            } else if (action.data.id) {
                draft.streaks.push(action.data);
            }
            break;
        }
        case HabitsActionTypes.GET_MILESTONES:
            draft.milestones = action.data || [];
            break;
        case HabitsActionTypes.USE_GRACE_DAY: {
            const graceIdx = draft.streaks.findIndex((s) => s.id === action.data.id);
            if (graceIdx > -1) {
                draft.streaks[graceIdx] = action.data;
            }
            const graceActiveIdx = draft.activeStreaks.findIndex((s) => s.id === action.data.id);
            if (graceActiveIdx > -1) {
                draft.activeStreaks[graceActiveIdx] = action.data;
            }
            break;
        }

        // Reset
        case HabitsActionTypes.RESET_HABITS:
        case SocketClientActionTypes.LOGOUT:
            return initialState;

        default:
            break;
    }
}, initialState);

export default habits;
