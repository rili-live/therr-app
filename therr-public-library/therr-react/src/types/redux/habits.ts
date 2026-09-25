import { HabitGoalType, SavingsTargetScope } from 'therr-js-utilities/constants';

// Habit Goal Types
export interface IHabitGoal {
    id: string;
    name: string;
    description?: string;
    category?: string;
    emoji?: string;
    /**
     * Stable key for a system template, used by clients to translate `name` and
     * `description`, which are stored in English. Null on everything that is not a template,
     * including a user's copy of one.
     */
    templateKey?: string | null;
    goalType: HabitGoalType;
    /**
     * Cadence. `daily` asks for a check-in every day; `weekly` / `custom` with a
     * `frequencyCount` asks for that many check-ins a week on any days; a populated
     * `targetDaysOfWeek` (Sunday-first, 0-6) fixes the days outright and wins over
     * `frequencyType` in both directions.
     *
     * This is what streaks, streak freezes, reminders, achievements and the leaderboard are all
     * measured against — see users-service `utilities/habitCadence.ts`, which is the single
     * definition. A day the cadence does not ask for costs the user nothing.
     */
    frequencyType: string;
    frequencyCount: number;
    targetDaysOfWeek?: number[];
    /**
     * The date this cadence became authoritative, YYYY-MM-DD, or absent when it always was.
     *
     * Changing a habit's cadence applies forward only: the running streak survives and days
     * already lived under the previous cadence are never re-judged. Server-owned — a client
     * never sends it.
     */
    cadenceEffectiveFrom?: string | null;
    createdByUserId: string;
    isTemplate: boolean;
    isPublic: boolean;
    usageCount: number;
    createdAt: string;
    updatedAt: string;
    /**
     * How much this savings habit is aiming at, in major units. Only meaningful when
     * `goalType` is `savings_goal`.
     *
     * Absent or null means an open-ended savings habit — one that records amounts and
     * shows a running total but has no finish line. That is a supported state, not a
     * missing value, so render the total without a progress bar rather than treating
     * the target as zero.
     *
     * Serialized from a Postgres `numeric`, which `pg` returns as a string to avoid
     * precision loss; users-service coerces it to a number before sending, so a client
     * should never see a string here. Compare through `hasReachedSavingsTarget` rather
     * than with `>=` — see the float trap documented there.
     */
    targetAmount?: number | null;
    /** ISO 4217, display only. Nothing in the system converts between currencies. */
    currencyCode?: string | null;
    /**
     * Whether `targetAmount` is each member's own goal or the group's combined one.
     * Absent reads as `per_member` (`DEFAULT_SAVINGS_TARGET_SCOPE`).
     */
    savingsTargetScope?: SavingsTargetScope | null;
}

/**
 * A habit's standing in the current week, as the server computed it.
 *
 * `isRequiredToday` is deliberately narrow: under a weekly quota a day is required only once
 * skipping it would put the target out of reach, so a well-run week has *no* required days.
 * Use it to escalate ("you need every day that's left"), never to decide whether to show the
 * habit at all.
 */
export interface IHabitWeekProgress {
    /** Completed days so far this week, excluding today. */
    done: number;
    /** What a full week of this cadence asks for. 7 for a daily habit. */
    target: number;
    /** Days from today through Sunday, inclusive of today. */
    daysLeft: number;
    isRequiredToday: boolean;
    isMet: boolean;
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
    /**
     * The cycle this pact continues, set when it was created by re-commit.
     *
     * A renewal is a new pact on the same habit goal rather than a mutation of the old one,
     * so this is the only thing distinguishing "one habit, second cycle" from "two separate
     * pacts". Present means the card should offer a way back to the cycle it came from
     * instead of standing alone.
     */
    renewedFromPactId?: string;
    /** 1 for a first cycle, 2 for its first renewal, and so on. Legacy rows read 1. */
    renewalCycleNumber?: number;
    /**
     * Derived server-side: the newest cycle continuing *this* pact, or absent.
     *
     * Set means this pact is history — the list leaves it out by default and only the
     * successor's "extended from" link reaches it. Absent on a pact whose only renewal was
     * declined or abandoned, which is what makes such a pact re-committable again.
     */
    supersededByPactId?: string;
    /**
     * The shared ("pact") streak — the group's own streak, distinct from each member's personal
     * streak. Advances on any day a majority of the pact's active members check in. All three
     * are optional: a client can be talking to a users-service that predates the feature, in
     * which case they are absent (treat as 0 / none) rather than zero — render nothing.
     */
    currentPactStreak?: number;
    longestPactStreak?: number;
    lastPactStreakDate?: string;
    /** True once the last remaining member opted to continue the pact solo. */
    isSolo?: boolean;
    /**
     * Derived server-side. How many members are actively participating right now (the majority
     * denominator, and what gates add/remove), and whether the sole remaining member should be
     * shown the continue-solo offer.
     */
    activeMemberCount?: number;
    canContinueSolo?: boolean;
    // Joined fields
    habitGoalName?: string;
    habitGoalEmoji?: string;
    habitGoalCategory?: string;
    members?: IPactMember[];
    /**
     * Money saved against this pact's goal, derived server-side. Present only on the
     * pact *detail* response (`GET /habits/pacts/:id`) and only when the habit goal is a
     * `savings_goal` — the list endpoints do not compute it, because doing so would add
     * an aggregate per pact to a hot read path.
     *
     * Absent therefore means "not a savings pact, or not asked for", never "nothing
     * saved". A savings pact with no contributions yet returns the object with zeroed
     * totals.
     */
    savingsProgress?: ISavingsProgress;
}

/** One participant's contribution to a savings goal. */
export interface ISavingsMemberProgress {
    userId: string;
    /** Sum of this member's `savedAmount` check-ins for the goal, in major units. */
    totalSaved: number;
    /** How many check-ins carried an amount. Zero is the normal starting state. */
    contributionCount: number;
    /**
     * True when this member has met the target on their own. Always false under `group`
     * scope, where the target belongs to the pact rather than to any one member.
     */
    hasReachedTarget: boolean;
}

/**
 * A savings goal's progress, as the pact and habit detail views render it.
 *
 * Both totals are always present regardless of `scope`, because both are worth showing:
 * a group pot wants the combined number *and* who put in what, and a per-member target
 * still benefits from "between us, $4,300". What `scope` decides is which of them
 * `isGoalReached` is about.
 */
export interface ISavingsProgress {
    /** Null for an open-ended savings habit; see `IHabitGoal.targetAmount`. */
    targetAmount: number | null;
    currencyCode: string;
    scope: SavingsTargetScope;
    /** Combined across every participant. Equals the member total for a solo habit. */
    totalSaved: number;
    /** Per participant, ordered by amount saved, descending. */
    members: ISavingsMemberProgress[];
    /**
     * Whether the target has been met — the group total under `group` scope, or *every*
     * active member's own total under `per_member`. False whenever `targetAmount` is
     * null, since an open-ended habit has no finish line.
     */
    isGoalReached: boolean;
    /**
     * The calling user's own total, repeated here so a client does not have to find
     * itself in `members`. Zero for a viewer who has contributed nothing.
     */
    viewerTotalSaved: number;
    /**
     * What is left for the viewer (per-member scope) or for the group (group scope).
     * Null when there is no target; never negative once the target is passed.
     */
    remainingAmount: number | null;
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
    /**
     * Whether this member has completed today's check-in for the pact's habit
     * goal, on the service's UTC habit day. Derived server-side alongside the
     * other stats (users-service `utilities/pactMemberStats`).
     *
     * Optional because a client can be talking to a users-service that predates
     * it; treat `undefined` as "unknown" and render nothing rather than
     * implying the member missed a day.
     */
    checkedInToday?: boolean;
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
    /**
     * Why the nudge did not reach this partner. Mirrors `NudgeFailureReason` in
     * users-service `src/utilities/pactNudgeOutcome.ts`:
     *   cooldown      — nudged in the last 7 days; retry after `nextNudgeAvailableAt`
     *   undeliverable — no Habits install and no email or phone on file; retrying cannot help
     *   error         — dispatch threw; retrying is worth offering
     */
    reason?: 'cooldown' | 'undeliverable' | 'error';
    nextNudgeAvailableAt?: string;
}

// Checkin Types
/**
 * One proof image (or video) attached to a check-in.
 *
 * `path` + `type` are the pair `MapsService.fetchMedia` takes — `type` is the
 * bucket-selecting `Content.mediaTypes` value resolved server-side, NOT
 * `mediaType`, which says whether the file is an image or a video. Passing
 * `mediaType` where `type` belongs resolves the URL against the public bucket
 * and renders as a broken image with no error.
 */
export interface IHabitCheckinProof {
    id: string;
    checkinId: string;
    mediaType: 'image' | 'video';
    path: string;
    type: string;
    thumbnailPath: string | null;
    createdAt: string;
    capturedAt: string | null;
    verificationStatus: string | null;
}

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
    /**
     * How much money this check-in put away, in major units of the goal's
     * `currencyCode`. Only written on `savings_goal` habits.
     *
     * Null and 0 are different answers and both occur: null is "no amount recorded"
     * (every non-savings check-in, and a savings check-in someone completed without
     * filling the field in), 0 is an explicit "I saved nothing today", which a no-spend
     * habit may legitimately want to log. Totals ignore null and include 0.
     */
    savedAmount?: number | null;
    // Set once the check-in has been shared publicly — the id of the main.thoughts post that
    // carries the public copy of the proof. Absent/undefined until shared. Lets the calendar
    // day show "shared" and deep-link to the post.
    sharedThoughtId?: string;
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
    /** Cadence — see `IHabitGoal`. What this habit is actually held to. */
    frequencyType: string;
    frequencyCount?: number | null;
    targetDaysOfWeek?: number[] | null;
    cadenceEffectiveFrom?: string | null;
    /**
     * Where the user stands in their own Monday-Sunday week for this habit.
     *
     * Derived server-side, because deciding what a cadence asks for on a given day is a rule
     * the backend owns outright (`utilities/habitCadence.ts`) — a client that recomputed it
     * would be the second implementation, which is the failure that module exists to prevent.
     *
     * **Absent means unknown, never zero.** It is omitted by a server that predates this
     * field, and by one that could not resolve the user's timezone. Rendering "0 of 4" for
     * someone who trained four times is worse than rendering nothing, so treat `undefined` as
     * "hide the progress indicator".
     */
    weekProgress?: IHabitWeekProgress;
    isSolo: boolean;
    activePactCount: number;
    currentStreak: number;
    longestStreak: number;
    /**
     * A pact this user created for this habit that is still `pending` — no invitee
     * has accepted yet. Null once a partner joins or when the habit was started
     * solo. Present alongside `isSolo === true` is what marks a habit as "waiting
     * on a friend" rather than a genuine solo habit, and is the signal behind the
     * "continue solo or archive?" prompt. Absent on responses from a users-service
     * that predates it; treat `undefined` like `null`.
     */
    pendingPactId?: string | null;
    /**
     * The habit's savings target, mirrored from its goal so the habit list can render a
     * progress bar without fetching each goal. Null/absent on every habit that is not a
     * `savings_goal`, and on an open-ended one.
     */
    targetAmount?: number | null;
    currencyCode?: string | null;
    savingsTargetScope?: SavingsTargetScope | null;
    /**
     * This user's own running total for the habit, across every check-in on it —
     * including ones made under a pact that has since ended, since the money does not
     * stop existing when a cycle does. Absent on responses from a users-service that
     * predates the field; treat `undefined` as "unknown" and render nothing rather than
     * a misleading zero.
     */
    totalSaved?: number;
    /**
     * Per-habit notification switches.
     *
     * All four default to `true` server-side and are NOT NULL, so a client can
     * treat `undefined` as `true` — which is exactly what it means on a response
     * from a users-service predating them. Render an absent value as On: showing
     * Off would tell the user their reminders are disabled while they keep
     * arriving, and submitting the form would then write the `false` the screen
     * invented and make the lie true (the same trap `getHabitsPushPreferences`
     * documents for the account-wide columns).
     *
     * They only ever narrow. The account-wide `settingsPushHabitReminders` /
     * `settingsPushStreakAlerts` still win, so turning one of these on cannot
     * re-enable something the account-level switch turned off.
     */
    notifyReminders?: boolean;
    notifyStreakAlerts?: boolean;
    /** "Your partner checked in" and "your partner missed a day — send a nudge?" */
    notifyPartnerActivity?: boolean;
    /** Pact invited / accepted / declined / expiring / ended, for this habit. */
    notifyPactUpdates?: boolean;
}

/**
 * The four categories as a set, for a settings screen that wants to iterate
 * rather than hardcode. Ordered the way they should be listed: the one the user
 * is most likely to want on first, the one they are most likely to want off
 * third.
 */
export const USER_HABIT_NOTIFICATION_CATEGORIES = [
    'notifyReminders',
    'notifyStreakAlerts',
    'notifyPartnerActivity',
    'notifyPactUpdates',
] as const;

export type UserHabitNotificationCategory = typeof USER_HABIT_NOTIFICATION_CATEGORIES[number];

/**
 * Resolve a habit's switches to plain booleans, applying the "absent means on"
 * rule in one place so no screen has to remember it.
 */
export const getUserHabitNotificationPreferences = (
    habit?: Partial<IUserHabit> | null,
): Record<UserHabitNotificationCategory, boolean> => ({
    notifyReminders: habit?.notifyReminders !== false,
    notifyStreakAlerts: habit?.notifyStreakAlerts !== false,
    notifyPartnerActivity: habit?.notifyPartnerActivity !== false,
    notifyPactUpdates: habit?.notifyPactUpdates !== false,
});

/**
 * Whether the user has unlocked habits tracked on their own, how close they are
 * to unlocking them, and where they stand against the free-tier cap. Fetched as
 * one object so the client never has to re-derive the rule the server enforces.
 */
export interface IUserHabitEligibility {
    /** True once `invitedCount` reaches `soloUnlockInviteCount`. */
    canCreateSolo: boolean;
    /**
     * Distinct people the user has invited to a pact they created, in any
     * state — the numerator of the unlock progress the client renders while
     * `canCreateSolo` is false. Absent on responses from servers predating the
     * threshold; treat `undefined` as "no progress to show" rather than zero.
     */
    invitedCount?: number;
    /** Invites needed to unlock solo habits. Server-configurable, so never hardcode it. */
    soloUnlockInviteCount?: number;
    activeHabitCount: number;
    /** True when either free-tier cap would refuse a new habit right now. */
    isAtHabitLimit: boolean;
    /**
     * Which cap `isAtHabitLimit` refers to. Absent from servers predating the start window.
     * Restoring an archived habit is gated on the active cap alone, so it is still allowed
     * when this is `'habit-start-limit-reached'` — only `'habit-limit-reached'` blocks it.
     */
    habitLimitReason?: 'habit-limit-reached' | 'habit-start-limit-reached' | null;
    /**
     * The free-tier active-habit cap that applies to this account, or null when
     * none does (another brand, or an entitled account). Server-configurable,
     * so never hardcode it. Servers predating 2026-09 sent it only once the cap
     * was hit; treat null as "unknown" on those.
     */
    habitLimit: number | null;
    /** Free-tier cap on habits *started* per `habitStartWindowDays`; null when no cap applies. */
    habitStartLimit?: number | null;
    habitStartWindowDays?: number | null;
    /** Habits started inside the current window, in any status. */
    recentHabitStartCount?: number;
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

// Premium subscription ($6.99/month) Types
export interface IHabitsPremiumSubscription {
    id: string;
    userId: string;
    platform: string;
    productId: string;
    status: 'active' | 'canceled' | 'expired' | 'revoked' | 'on_hold' | 'paused';
    subscriptionState?: string | null;
    autoRenewing?: boolean | null;
    startTime?: string | null;
    /** When access lapses if not renewed. Drives the "renews on"/"expires on" copy. */
    expiryTime?: string | null;
    orderId?: string | null;
    priceAmountMicros?: string | null;
    priceCurrencyCode?: string | null;
    acknowledgedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface IHabitsPremiumOffer {
    productId: string;
    /** True for any entitled account, including admins and lifetime founders. */
    isEntitled: boolean;
    subscription: IHabitsPremiumSubscription | null;
    /**
     * False when the server has no Play credentials, and also when the calling client
     * declared a brand that cannot buy this SKU — either way the CTA must stay hidden.
     * Read `isBrandSupported` to tell the two apart.
     */
    isStoreConfigured: boolean;
    /**
     * False when the client sent an `x-brand-variation` other than HABITS. The premium
     * subscription is a Friends with Habits product on a Friends with Habits Play
     * listing, so no other brand can complete the purchase. Optional because clients
     * predating the field simply see `isStoreConfigured: false` and hide the CTA.
     */
    isBrandSupported?: boolean;
}

// State Interface
/**
 * The app-level daily streak: one streak per user across every habit, in the user's own
 * timezone. Distinct from `IStreak`, which is per habit goal. Mirrors the users-service
 * `GET /habits/daily-streak/me` response — see DailyStreakService.
 */
export interface IDailyStreakWeekDay {
    date: string;
    /** 0 = Monday … 6 = Sunday. */
    dow: number;
    status: 'upheld' | 'frozen' | 'missed' | 'future' | 'pending';
    isToday: boolean;
}

export interface IDailyStreakPendingCelebration {
    kind: 'day' | 'milestone';
    streak: number;
    isPerfectWeek: boolean;
    isNewLongest: boolean;
}

export interface IDailyStreakPendingPlacement {
    periodId: string;
    periodStart: string;
    periodEnd: string;
    placement: number;
    participants: number;
    score: number;
    /** Reserved for leagues; always null today. */
    leagueFrom: string | null;
    leagueTo: string | null;
}

export interface IDailyStreak {
    currentStreak: number;
    longestStreak: number;
    today: string;
    timeZone?: string;
    week: IDailyStreakWeekDay[];
    pendingCelebration: IDailyStreakPendingCelebration | null;
    pendingPlacements?: IDailyStreakPendingPlacement[];
}

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
    premiumOffer: IHabitsPremiumOffer | null;
    /** App-level daily streak; null until first fetched. */
    dailyStreak: IDailyStreak | null;
    isLoading: boolean;
}

// Action Types
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
    RENEW_PACT = 'RENEW_PACT',
    NUDGE_PACT = 'NUDGE_PACT',
    ACCEPT_PACT = 'ACCEPT_PACT',
    DECLINE_PACT = 'DECLINE_PACT',
    ABANDON_PACT = 'ABANDON_PACT',
    // Upsert a pact in place from a returned, hydrated pact — used by member add/remove and
    // solo continuation, which all change the membership or shape of an existing pact rather
    // than creating or ending one.
    UPDATE_PACT = 'UPDATE_PACT',

    // Checkins
    GET_TODAY_CHECKINS = 'GET_TODAY_CHECKINS',
    GET_CHECKINS_BY_RANGE = 'GET_CHECKINS_BY_RANGE',
    CREATE_CHECKIN = 'CREATE_CHECKIN',
    UPDATE_CHECKIN = 'UPDATE_CHECKIN',
    SKIP_CHECKIN = 'SKIP_CHECKIN',
    SHARE_CHECKIN = 'SHARE_CHECKIN',

    // Daily streak (app-level, across all habits)
    GET_DAILY_STREAK = 'GET_DAILY_STREAK',
    // Written from the check-in response, which carries the streak as of that check-in so the
    // celebration can run without a second round trip.
    SET_DAILY_STREAK = 'SET_DAILY_STREAK',
    DAILY_STREAK_CELEBRATED = 'DAILY_STREAK_CELEBRATED',
    ACKNOWLEDGE_PLACEMENT = 'ACKNOWLEDGE_PLACEMENT',

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
    CONTINUE_SOLO_USER_HABIT = 'CONTINUE_SOLO_USER_HABIT',
    UPDATE_USER_HABIT_NOTIFICATION_PREFERENCES = 'UPDATE_USER_HABIT_NOTIFICATION_PREFERENCES',

    // Journal
    GET_JOURNAL_FEED = 'GET_JOURNAL_FEED',
    APPEND_JOURNAL_FEED = 'APPEND_JOURNAL_FEED',
    CREATE_JOURNAL_ENTRY = 'CREATE_JOURNAL_ENTRY',
    UPDATE_JOURNAL_ENTRY = 'UPDATE_JOURNAL_ENTRY',
    DELETE_JOURNAL_ENTRY = 'DELETE_JOURNAL_ENTRY',

    // Lifetime founder offer
    GET_LIFETIME_OFFER = 'GET_LIFETIME_OFFER',
    VERIFY_LIFETIME_PURCHASE = 'VERIFY_LIFETIME_PURCHASE',

    // Premium subscription offer
    GET_PREMIUM_OFFER = 'GET_PREMIUM_OFFER',
    VERIFY_PREMIUM_PURCHASE = 'VERIFY_PREMIUM_PURCHASE',

    // Loading
    HABITS_LOADING = 'HABITS_LOADING',
    HABITS_LOADED = 'HABITS_LOADED',

    // Reset
    RESET_HABITS = 'RESET_HABITS',
}
