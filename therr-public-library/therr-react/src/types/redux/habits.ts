import * as Immutable from 'seamless-immutable';

// Habit Goal Types
export interface IHabitGoal {
    id: string;
    name: string;
    description?: string;
    category?: string;
    emoji?: string;
    frequencyType: string;
    frequencyCount: number;
    targetDaysOfWeek?: number[];
    createdByUserId: string;
    isTemplate: boolean;
    isPublic: boolean;
    usageCount: number;
    createdAt: string;
    updatedAt: string;
}

// Pact Types
export interface IPact {
    id: string;
    creatorUserId: string;
    partnerUserId?: string;
    habitGoalId: string;
    pactType: 'accountability' | 'challenge' | 'support';
    status: 'pending' | 'active' | 'completed' | 'abandoned' | 'expired';
    durationDays: number;
    startDate?: string;
    endDate?: string;
    consequenceType?: string;
    consequenceDetails?: object;
    endReason?: string;
    winnerId?: string;
    creatorCompletionRate?: number;
    partnerCompletionRate?: number;
    createdAt: string;
    updatedAt: string;
    // Joined fields
    habitGoalName?: string;
    habitGoalEmoji?: string;
    habitGoalCategory?: string;
    members?: IPactMember[];
}

export interface IPactMember {
    id: string;
    pactId: string;
    userId: string;
    role: 'creator' | 'partner';
    status: string;
    totalCheckins: number;
    completedCheckins: number;
    currentStreak: number;
    longestStreak: number;
    completionRate?: number;
    // Joined fields
    userName?: string;
    firstName?: string;
    lastName?: string;
    userMedia?: object;
}

// Checkin Types
export interface IHabitCheckin {
    id: string;
    userId: string;
    pactId?: string;
    habitGoalId: string;
    scheduledDate: string;
    completedAt?: string;
    status: 'pending' | 'completed' | 'partial' | 'skipped' | 'missed';
    notes?: string;
    selfRating?: number;
    difficultyRating?: number;
    hasProof: boolean;
    proofVerified: boolean;
    contributedToStreak: boolean;
    createdAt: string;
    updatedAt: string;
    // Joined fields
    habitGoalName?: string;
    habitGoalEmoji?: string;
}

// Streak Types
export interface IStreak {
    id: string;
    userId: string;
    habitGoalId: string;
    pactId?: string;
    currentStreak: number;
    currentStreakStartDate?: string;
    lastCompletedDate?: string;
    longestStreak: number;
    longestStreakStartDate?: string;
    longestStreakEndDate?: string;
    gracePeriodDays: number;
    graceDaysUsed: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    // Computed fields
    riskLevel?: 'safe' | 'at_risk' | 'critical';
    milestoneProgress?: {
        nextMilestone: number | null;
        progress: number;
    };
    displayText?: string;
    emoji?: string;
}

export interface IStreakHistory {
    id: string;
    streakId: string;
    userId: string;
    checkinId?: string;
    eventType: string;
    eventDate: string;
    streakBefore: number;
    streakAfter: number;
    milestoneReached?: number;
    createdAt: string;
}

// State Interface
export interface IHabitsState extends Immutable.ImmutableObject<any> {
    habitGoals: Immutable.ImmutableArray<IHabitGoal>;
    templates: Immutable.ImmutableArray<IHabitGoal>;
    pacts: Immutable.ImmutableArray<IPact>;
    activePacts: Immutable.ImmutableArray<IPact>;
    pendingInvites: Immutable.ImmutableArray<IPact>;
    checkins: Immutable.ImmutableArray<IHabitCheckin>;
    todayCheckins: Immutable.ImmutableArray<IHabitCheckin>;
    streaks: Immutable.ImmutableArray<IStreak>;
    activeStreaks: Immutable.ImmutableArray<IStreak>;
    milestones: Immutable.ImmutableArray<IStreakHistory>;
    isLoading: boolean;
}

// Action Types
// eslint-disable-next-line no-shadow
export enum HabitsActionTypes {
    // Habit Goals
    GET_USER_HABIT_GOALS = 'GET_USER_HABIT_GOALS',
    GET_HABIT_GOAL_TEMPLATES = 'GET_HABIT_GOAL_TEMPLATES',
    CREATE_HABIT_GOAL = 'CREATE_HABIT_GOAL',
    UPDATE_HABIT_GOAL = 'UPDATE_HABIT_GOAL',
    DELETE_HABIT_GOAL = 'DELETE_HABIT_GOAL',

    // Pacts
    GET_USER_PACTS = 'GET_USER_PACTS',
    GET_ACTIVE_PACTS = 'GET_ACTIVE_PACTS',
    GET_PENDING_INVITES = 'GET_PENDING_INVITES',
    GET_PACT_DETAILS = 'GET_PACT_DETAILS',
    CREATE_PACT = 'CREATE_PACT',
    ACCEPT_PACT = 'ACCEPT_PACT',
    DECLINE_PACT = 'DECLINE_PACT',
    ABANDON_PACT = 'ABANDON_PACT',

    // Checkins
    GET_TODAY_CHECKINS = 'GET_TODAY_CHECKINS',
    GET_CHECKINS_BY_RANGE = 'GET_CHECKINS_BY_RANGE',
    CREATE_CHECKIN = 'CREATE_CHECKIN',
    UPDATE_CHECKIN = 'UPDATE_CHECKIN',
    SKIP_CHECKIN = 'SKIP_CHECKIN',

    // Streaks
    GET_USER_STREAKS = 'GET_USER_STREAKS',
    GET_ACTIVE_STREAKS = 'GET_ACTIVE_STREAKS',
    GET_STREAK_BY_HABIT = 'GET_STREAK_BY_HABIT',
    GET_MILESTONES = 'GET_MILESTONES',
    USE_GRACE_DAY = 'USE_GRACE_DAY',

    // Loading
    HABITS_LOADING = 'HABITS_LOADING',
    HABITS_LOADED = 'HABITS_LOADED',

    // Reset
    RESET_HABITS = 'RESET_HABITS',
}
