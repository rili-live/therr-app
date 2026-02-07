import { HabitsActionTypes } from '../../types/redux/habits';
import HabitGoalsService, { ICreateHabitGoalBody, IUpdateHabitGoalBody } from '../../services/HabitGoalsService';
import PactsService, { ICreatePactBody } from '../../services/PactsService';
import HabitCheckinsService, { ICreateCheckinBody, IUpdateCheckinBody } from '../../services/HabitCheckinsService';
import StreaksService from '../../services/StreaksService';

const Habits = {
    // Habit Goals
    getUserGoals: (limit?: number, offset?: number) => (dispatch: any) => {
        dispatch({ type: HabitsActionTypes.HABITS_LOADING });
        return HabitGoalsService.getUserGoals(limit, offset).then((response) => {
            dispatch({
                type: HabitsActionTypes.GET_USER_HABIT_GOALS,
                data: response.data,
            });
            return response.data;
        }).finally(() => {
            dispatch({ type: HabitsActionTypes.HABITS_LOADED });
        });
    },

    getTemplates: (category?: string, limit?: number, offset?: number) => (dispatch: any) => HabitGoalsService
        .getTemplates(category, limit, offset).then((response) => {
            dispatch({
                type: HabitsActionTypes.GET_HABIT_GOAL_TEMPLATES,
                data: response.data,
            });
            return response.data;
        }),

    createGoal: (data: ICreateHabitGoalBody) => (dispatch: any) => HabitGoalsService.create(data).then((response) => {
        dispatch({
            type: HabitsActionTypes.CREATE_HABIT_GOAL,
            data: response.data,
        });
        return response.data;
    }),

    updateGoal: (id: string, data: IUpdateHabitGoalBody) => (dispatch: any) => HabitGoalsService
        .update(id, data).then((response) => {
            dispatch({
                type: HabitsActionTypes.UPDATE_HABIT_GOAL,
                data: response.data,
            });
            return response.data;
        }),

    deleteGoal: (id: string) => (dispatch: any) => HabitGoalsService.delete(id).then((response) => {
        dispatch({
            type: HabitsActionTypes.DELETE_HABIT_GOAL,
            data: { id },
        });
        return response.data;
    }),

    // Pacts
    getUserPacts: (status?: string, limit?: number, offset?: number) => (dispatch: any) => {
        dispatch({ type: HabitsActionTypes.HABITS_LOADING });
        return PactsService.getUserPacts(status, limit, offset).then((response) => {
            dispatch({
                type: HabitsActionTypes.GET_USER_PACTS,
                data: response.data,
            });
            return response.data;
        }).finally(() => {
            dispatch({ type: HabitsActionTypes.HABITS_LOADED });
        });
    },

    getActivePacts: () => (dispatch: any) => PactsService.getActivePacts().then((response) => {
        dispatch({
            type: HabitsActionTypes.GET_ACTIVE_PACTS,
            data: response.data,
        });
        return response.data;
    }),

    getPendingInvites: () => (dispatch: any) => PactsService.getPendingInvites().then((response) => {
        dispatch({
            type: HabitsActionTypes.GET_PENDING_INVITES,
            data: response.data,
        });
        return response.data;
    }),

    getPactDetails: (id: string) => (dispatch: any) => PactsService.get(id).then((response) => {
        dispatch({
            type: HabitsActionTypes.GET_PACT_DETAILS,
            data: response.data,
        });
        return response.data;
    }),

    createPact: (data: ICreatePactBody) => (dispatch: any) => PactsService.create(data).then((response) => {
        dispatch({
            type: HabitsActionTypes.CREATE_PACT,
            data: response.data,
        });
        return response.data;
    }),

    acceptPact: (id: string) => (dispatch: any) => PactsService.accept(id).then((response) => {
        dispatch({
            type: HabitsActionTypes.ACCEPT_PACT,
            data: response.data,
        });
        return response.data;
    }),

    declinePact: (id: string) => (dispatch: any) => PactsService.decline(id).then((response) => {
        dispatch({
            type: HabitsActionTypes.DECLINE_PACT,
            data: { id },
        });
        return response.data;
    }),

    abandonPact: (id: string) => (dispatch: any) => PactsService.abandon(id).then((response) => {
        dispatch({
            type: HabitsActionTypes.ABANDON_PACT,
            data: response.data,
        });
        return response.data;
    }),

    // Checkins
    getTodayCheckins: (habitGoalId?: string) => (dispatch: any) => HabitCheckinsService
        .getTodayCheckins(habitGoalId).then((response) => {
            dispatch({
                type: HabitsActionTypes.GET_TODAY_CHECKINS,
                data: response.data,
            });
            return response.data;
        }),

    getCheckinsByRange: (startDate: string, endDate: string, habitGoalId?: string) => (dispatch: any) => HabitCheckinsService
        .getByDateRange(startDate, endDate, habitGoalId).then((response) => {
            dispatch({
                type: HabitsActionTypes.GET_CHECKINS_BY_RANGE,
                data: response.data,
            });
            return response.data;
        }),

    createCheckin: (data: ICreateCheckinBody) => (dispatch: any) => HabitCheckinsService
        .create(data).then((response) => {
            dispatch({
                type: HabitsActionTypes.CREATE_CHECKIN,
                data: response.data,
            });
            return response.data;
        }),

    updateCheckin: (id: string, data: IUpdateCheckinBody) => (dispatch: any) => HabitCheckinsService
        .update(id, data).then((response) => {
            dispatch({
                type: HabitsActionTypes.UPDATE_CHECKIN,
                data: response.data,
            });
            return response.data;
        }),

    skipCheckin: (id: string, notes?: string) => (dispatch: any) => HabitCheckinsService
        .skip(id, notes).then((response) => {
            dispatch({
                type: HabitsActionTypes.SKIP_CHECKIN,
                data: response.data,
            });
            return response.data;
        }),

    // Streaks
    getUserStreaks: (isActive?: boolean) => (dispatch: any) => StreaksService
        .getUserStreaks(isActive).then((response) => {
            dispatch({
                type: HabitsActionTypes.GET_USER_STREAKS,
                data: response.data,
            });
            return response.data;
        }),

    getActiveStreaks: () => (dispatch: any) => StreaksService.getActiveStreaks().then((response) => {
        dispatch({
            type: HabitsActionTypes.GET_ACTIVE_STREAKS,
            data: response.data,
        });
        return response.data;
    }),

    getStreakByHabit: (habitGoalId: string) => (dispatch: any) => StreaksService
        .getByHabit(habitGoalId).then((response) => {
            dispatch({
                type: HabitsActionTypes.GET_STREAK_BY_HABIT,
                data: response.data,
            });
            return response.data;
        }),

    getMilestones: () => (dispatch: any) => StreaksService.getMilestones().then((response) => {
        dispatch({
            type: HabitsActionTypes.GET_MILESTONES,
            data: response.data,
        });
        return response.data;
    }),

    useGraceDay: (id: string) => (dispatch: any) => StreaksService.useGraceDay(id).then((response) => {
        dispatch({
            type: HabitsActionTypes.USE_GRACE_DAY,
            data: response.data,
        });
        return response.data;
    }),

    // Reset
    reset: () => (dispatch: any) => {
        dispatch({ type: HabitsActionTypes.RESET_HABITS });
    },
};

export default Habits;
