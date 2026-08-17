import { HabitGoalType } from 'therr-js-utilities/constants';

// Habit Goal Types
export interface IHabitGoal {
    id: string;
    name: string;
    description?: string;
    category?: string;
    emoji?: string;
    goalType: HabitGoalType;
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
    invitedAt?: string;
    nudgedAt?: string;
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

// Per-partner outcome returned by the nudgePact endpoint. Transient — surfaced
// to the caller (e.g. toast copy) but not persisted into pact state.
export interface IPactNudgeResult {
    partnerId: string;
    nudged: boolean;
    reason?: 'cooldown' | 'error';
    nextNudgeAvailableAt?: string;
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

// Tracked-habit Types
/**
 * A habit the user is tracking, whether or not a pact backs it.
 *
 * `isSolo` is derived server-side (no *active* pact covers this habit), so a
 * habit whose pact ends becomes personal rather than disappearing. Clients
 * should read it rather than inferring it from pact lists, which go stale
 * independently of this one.
 */
export interface IUserHabit {
    id: string;
    userId: string;
    habitGoalId: string;
    status: 'active' | 'archived';
    startedAt: string;
    archivedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    // Joined fields
    goalName: string;
    goalEmoji?: string | null;
    goalCategory?: string | null;
    goalType: HabitGoalType;
    frequencyType: string;
    frequencyCount?: number | null;
    targetDaysOfWeek?: number[] | null;
    isSolo: boolean;
    activePactCount: number;
    currentStreak: number;
    longestStreak: number;
}

/**
 * Whether the user may start habits on their own yet, and where they stand
 * against the free-tier cap. Fetched as one object so the client never has to
 * re-derive the rule the server is enforcing.
 */
export interface IUserHabitEligibility {
    canCreateSolo: boolean;
    activeHabitCount: number;
    isAtHabitLimit: boolean;
    habitLimit: number | null;
}

// Journal Types
export interface IJournalEntry {
    id: string;
    userId: string;
    habitGoalId?: string | null;
    checkinId?: string | null;
    body: string;
    entryDate: string;
    occurredAt: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * One row of the merged journal feed. Six sources share this shape so the
 * client renders a single list; `meta` carries the per-type extras rather than
 * widening the item with fields that are null for most types.
 *
 * `goal` is a `main.thoughts` row the user posted — its `id` is a thought id,
 * so a client may open it in the thought view. Note that `goalName`/`goalEmoji`
 * describe the tagged *habit* goal and are null on a `goal` item.
 */
export interface IJournalFeedItem {
    id: string;
    type: 'note' | 'checkin' | 'achievement' | 'milestone' | 'habit_started' | 'goal';
    occurredAt: string;
    /** The user's local calendar day, which is what day-grouping keys on. */
    entryDate: string;
    body?: string | null;
    habitGoalId?: string | null;
    goalName?: string | null;
    goalEmoji?: string | null;
    meta?: any;
}

// Lifetime purchase / founder offer Types
export interface IHabitsLifetimePurchase {
    id: string;
    userId: string;
    platform: string;
    productId: string;
    status: 'active' | 'refunded' | 'revoked';
    founderNumber?: number | null;
    priceAmountMicros?: string | null;
    priceCurrencyCode?: string | null;
    purchasedAt?: string | null;
    acknowledgedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface IHabitsLifetimeOffer {
    productId: string;
    total: number;
    claimed: number;
    remaining: number;
    isSoldOut: boolean;
    /** True for any entitled account, including admins and future subscribers. */
    isEntitled: boolean;
    purchase: IHabitsLifetimePurchase | null;
    /** False when the server has no Play credentials — the CTA must stay hidden. */
    isStoreConfigured: boolean;
}

// State Interface
export interface IHabitsState {
    habitGoals: IHabitGoal[];
    templates: IHabitGoal[];
    pacts: IPact[];
    activePacts: IPact[];
    pendingInvites: IPact[];
    checkins: IHabitCheckin[];
    todayCheckins: IHabitCheckin[];
    streaks: IStreak[];
    activeStreaks: IStreak[];
    milestones: IStreakHistory[];
    userHabits: IUserHabit[];
    userHabitEligibility: IUserHabitEligibility | null;
    journalFeed: IJournalFeedItem[];
    /** `occurredAt` of the oldest loaded item; null once the feed is exhausted. */
    journalCursor: string | null;
    journalHasMore: boolean;
    lifetimeOffer: IHabitsLifetimeOffer | null;
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
    NUDGE_PACT = 'NUDGE_PACT',
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

    // Tracked habits (solo/personal)
    GET_USER_HABITS = 'GET_USER_HABITS',
    GET_USER_HABIT_ELIGIBILITY = 'GET_USER_HABIT_ELIGIBILITY',
    CREATE_USER_HABIT = 'CREATE_USER_HABIT',
    ARCHIVE_USER_HABIT = 'ARCHIVE_USER_HABIT',
    RESTORE_USER_HABIT = 'RESTORE_USER_HABIT',

    // Journal
    GET_JOURNAL_FEED = 'GET_JOURNAL_FEED',
    APPEND_JOURNAL_FEED = 'APPEND_JOURNAL_FEED',
    CREATE_JOURNAL_ENTRY = 'CREATE_JOURNAL_ENTRY',
    UPDATE_JOURNAL_ENTRY = 'UPDATE_JOURNAL_ENTRY',
    DELETE_JOURNAL_ENTRY = 'DELETE_JOURNAL_ENTRY',

    // Lifetime founder offer
    GET_LIFETIME_OFFER = 'GET_LIFETIME_OFFER',
    VERIFY_LIFETIME_PURCHASE = 'VERIFY_LIFETIME_PURCHASE',

    // Loading
    HABITS_LOADING = 'HABITS_LOADING',
    HABITS_LOADED = 'HABITS_LOADED',

    // Reset
    RESET_HABITS = 'RESET_HABITS',
}
