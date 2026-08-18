import { HabitsActionTypes } from '../../types/redux/habits';
import HabitGoalsService, { ICreateHabitGoalBody, IUpdateHabitGoalBody } from '../../services/HabitGoalsService';
import PactsService, { ICreatePactBody, IBulkInvitePactBody } from '../../services/PactsService';
import HabitCheckinsService, { ICreateCheckinBody, IUpdateCheckinBody } from '../../services/HabitCheckinsService';
import StreaksService from '../../services/StreaksService';
import UserHabitsService, { ICreateUserHabitBody } from '../../services/UserHabitsService';
import JournalService, { ICreateJournalEntryBody, IUpdateJournalEntryBody } from '../../services/JournalService';
import HabitsLifetimeService, { IVerifyLifetimePurchaseBody } from '../../services/HabitsLifetimeService';

const Habits = {
    // Habit Goals
    getUserGoals: (limit?: number, offset?: number) => (dispatch: any) => {
        dispatch({ type: HabitsActionTypes.HABITS_LOADING });
        return HabitGoalsService.getUserGoals(limit, offset).then((response: any) => {
            if (response?.isOfflineFallback) return undefined;
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
        .getTemplates(category, limit, offset).then((response: any) => {
            if (response?.isOfflineFallback) return undefined;
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
        return PactsService.getUserPacts(status, limit, offset).then((response: any) => {
            if (response?.isOfflineFallback) return undefined;
            dispatch({
                type: HabitsActionTypes.GET_USER_PACTS,
                data: response.data,
            });
            return response.data;
        }).finally(() => {
            dispatch({ type: HabitsActionTypes.HABITS_LOADED });
        });
    },

    getActivePacts: () => (dispatch: any) => PactsService.getActivePacts().then((response: any) => {
        if (response?.isOfflineFallback) return undefined;
        dispatch({
            type: HabitsActionTypes.GET_ACTIVE_PACTS,
            data: response.data,
        });
        return response.data;
    }),

    getPendingInvites: () => (dispatch: any) => PactsService.getPendingInvites().then((response: any) => {
        if (response?.isOfflineFallback) return undefined;
        dispatch({
            type: HabitsActionTypes.GET_PENDING_INVITES,
            data: response.data,
        });
        return response.data;
    }),

    getPactDetails: (id: string) => (dispatch: any) => PactsService.get(id).then((response: any) => {
        if (response?.isOfflineFallback) return undefined;
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

    bulkInvitePact: (data: IBulkInvitePactBody) => (dispatch: any) => PactsService.bulkInvite(data).then((response) => {
        dispatch({
            type: HabitsActionTypes.CREATE_PACT,
            data: response.data,
        });
        return response.data;
    }),

    nudgePact: (id: string) => (dispatch: any) => PactsService.nudge(id).then((response) => {
        dispatch({
            type: HabitsActionTypes.NUDGE_PACT,
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
        .getTodayCheckins(habitGoalId).then((response: any) => {
            if (response?.isOfflineFallback) return undefined;
            dispatch({
                type: HabitsActionTypes.GET_TODAY_CHECKINS,
                data: response.data,
            });
            return response.data;
        }),

    getCheckinsByRange: (startDate: string, endDate: string, habitGoalId?: string) => (dispatch: any) => HabitCheckinsService
        .getByDateRange(startDate, endDate, habitGoalId).then((response: any) => {
            if (response?.isOfflineFallback) return undefined;
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
        .getUserStreaks(isActive).then((response: any) => {
            if (response?.isOfflineFallback) return undefined;
            dispatch({
                type: HabitsActionTypes.GET_USER_STREAKS,
                data: response.data,
            });
            return response.data;
        }),

    getActiveStreaks: () => (dispatch: any) => StreaksService.getActiveStreaks().then((response: any) => {
        if (response?.isOfflineFallback) return undefined;
        dispatch({
            type: HabitsActionTypes.GET_ACTIVE_STREAKS,
            data: response.data,
        });
        return response.data;
    }),

    getStreakByHabit: (habitGoalId: string) => (dispatch: any) => StreaksService
        .getByHabit(habitGoalId).then((response: any) => {
            if (response?.isOfflineFallback) return undefined;
            dispatch({
                type: HabitsActionTypes.GET_STREAK_BY_HABIT,
                data: response.data,
            });
            return response.data;
        }),

    getMilestones: () => (dispatch: any) => StreaksService.getMilestones().then((response: any) => {
        if (response?.isOfflineFallback) return undefined;
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

    // Tracked habits (solo/personal)
    getUserHabits: (status?: 'active' | 'archived') => (dispatch: any) => {
        dispatch({ type: HabitsActionTypes.HABITS_LOADING });
        return UserHabitsService.getUserHabits(status).then((response: any) => {
            if (response?.isOfflineFallback) return undefined;
            dispatch({
                type: HabitsActionTypes.GET_USER_HABITS,
                data: response.data,
            });
            return response.data;
        }).finally(() => {
            dispatch({ type: HabitsActionTypes.HABITS_LOADED });
        });
    },

    getUserHabitEligibility: () => (dispatch: any) => UserHabitsService.getEligibility()
        .then((response: any) => {
            if (response?.isOfflineFallback) return undefined;
            dispatch({
                type: HabitsActionTypes.GET_USER_HABIT_ELIGIBILITY,
                data: response.data,
            });
            return response.data;
        }),

    startUserHabit: (data: ICreateUserHabitBody) => (dispatch: any) => UserHabitsService.create(data)
        .then((response: any) => {
            dispatch({
                type: HabitsActionTypes.CREATE_USER_HABIT,
                data: response.data,
            });
            return response.data;
        }),

    archiveUserHabit: (id: string) => (dispatch: any) => UserHabitsService.archive(id)
        .then((response: any) => {
            dispatch({
                type: HabitsActionTypes.ARCHIVE_USER_HABIT,
                data: response.data,
            });
            return response.data;
        }),

    restoreUserHabit: (id: string) => (dispatch: any) => UserHabitsService.restore(id)
        .then((response: any) => {
            dispatch({
                type: HabitsActionTypes.RESTORE_USER_HABIT,
                data: response.data,
            });
            return response.data;
        }),

    // Journal
    /**
     * Pass `before` to page. The reducer appends rather than replaces when a
     * cursor was supplied, so a paged load cannot wipe the feed the user is
     * already scrolled into.
     */
    getJournalFeed: (options: { before?: string | null; limit?: number } = {}) => (dispatch: any) => {
        if (!options.before) {
            dispatch({ type: HabitsActionTypes.HABITS_LOADING });
        }
        return JournalService.getFeed(options).then((response: any) => {
            if (response?.isOfflineFallback) return undefined;
            dispatch({
                type: options.before
                    ? HabitsActionTypes.APPEND_JOURNAL_FEED
                    : HabitsActionTypes.GET_JOURNAL_FEED,
                data: response.data,
            });
            return response.data;
        }).finally(() => {
            if (!options.before) {
                dispatch({ type: HabitsActionTypes.HABITS_LOADED });
            }
        });
    },

    createJournalEntry: (data: ICreateJournalEntryBody) => (dispatch: any) => JournalService.create(data)
        .then((response: any) => {
            dispatch({
                type: HabitsActionTypes.CREATE_JOURNAL_ENTRY,
                data: response.data,
            });
            return response.data;
        }),

    updateJournalEntry: (id: string, data: IUpdateJournalEntryBody) => (dispatch: any) => JournalService
        .update(id, data).then((response: any) => {
            dispatch({
                type: HabitsActionTypes.UPDATE_JOURNAL_ENTRY,
                data: response.data,
            });
            return response.data;
        }),

    deleteJournalEntry: (id: string) => (dispatch: any) => JournalService.delete(id)
        .then((response: any) => {
            dispatch({
                type: HabitsActionTypes.DELETE_JOURNAL_ENTRY,
                data: { id },
            });
            return response.data;
        }),

    // Lifetime founder offer
    getLifetimeOffer: () => (dispatch: any) => HabitsLifetimeService.getOffer()
        .then((response: any) => {
            if (response?.isOfflineFallback) return undefined;
            dispatch({
                type: HabitsActionTypes.GET_LIFETIME_OFFER,
                data: response.data,
            });
            return response.data;
        }),

    /**
     * Returns the granted access levels alongside the purchase so the caller
     * can refresh the user record — the entitlement lives on the user, not in
     * habits state, and the paywall must not linger after a successful buy.
     */
    verifyLifetimePurchase: (data: IVerifyLifetimePurchaseBody) => (dispatch: any) => HabitsLifetimeService
        .verifyPurchase(data).then((response: any) => {
            dispatch({
                type: HabitsActionTypes.VERIFY_LIFETIME_PURCHASE,
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
