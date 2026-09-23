enum FeatureFlags {
    // Navigation Tabs
    ENABLE_AREAS = 'ENABLE_AREAS',
    ENABLE_GROUPS = 'ENABLE_GROUPS',
    ENABLE_MAP = 'ENABLE_MAP',
    ENABLE_CONNECT = 'ENABLE_CONNECT',

    // Content Types
    ENABLE_MOMENTS = 'ENABLE_MOMENTS',
    ENABLE_SPACES = 'ENABLE_SPACES',
    ENABLE_EVENTS = 'ENABLE_EVENTS',
    ENABLE_THOUGHTS = 'ENABLE_THOUGHTS',

    // Social Features
    ENABLE_DIRECT_MESSAGING = 'ENABLE_DIRECT_MESSAGING',
    ENABLE_ACHIEVEMENTS = 'ENABLE_ACHIEVEMENTS',
    ENABLE_ACTIVITIES = 'ENABLE_ACTIVITIES',
    ENABLE_NOTIFICATIONS = 'ENABLE_NOTIFICATIONS',

    // Groups Features
    ENABLE_FORUMS = 'ENABLE_FORUMS',
    ENABLE_ACTIVITY_SCHEDULER = 'ENABLE_ACTIVITY_SCHEDULER',

    // HABITS App Features
    ENABLE_HABITS = 'ENABLE_HABITS',
    ENABLE_PACTS = 'ENABLE_PACTS',
    REQUIRE_PACT_ONBOARDING = 'REQUIRE_PACT_ONBOARDING',
    ENABLE_HABITS_JOURNAL = 'ENABLE_HABITS_JOURNAL',
    // Public social feed of shared check-ins (see docs/WORK_IN_PROGRESS.md 2.6.8).
    // Off by default so it can ship dark and be flipped on per brand build; when on
    // for HABITS it replaces the Awards tab in the bottom bar. A tab and its route
    // read this same flag — see TherrMobile habitsTabLayout.ts for why.
    ENABLE_HABITS_FEED = 'ENABLE_HABITS_FEED',
    ENABLE_HABITS_SOLO = 'ENABLE_HABITS_SOLO',
    ENABLE_HABITS_LIFETIME_OFFER = 'ENABLE_HABITS_LIFETIME_OFFER',

    // HABITS Premium Tier (gated by user subscription status)
    PREMIUM_UNLIMITED_PACTS = 'PREMIUM_UNLIMITED_PACTS',
    PREMIUM_VIDEO_PROOF = 'PREMIUM_VIDEO_PROOF',
    PREMIUM_ANALYTICS = 'PREMIUM_ANALYTICS',
    PREMIUM_CUSTOM_CONSEQUENCES = 'PREMIUM_CUSTOM_CONSEQUENCES',
    PREMIUM_HEALTH_INTEGRATIONS = 'PREMIUM_HEALTH_INTEGRATIONS',

    // Device / OS Permissions
    ENABLE_LOCATION_SERVICES = 'ENABLE_LOCATION_SERVICES',

    // Search Providers
    ENABLE_MAPBOX_SEARCH = 'ENABLE_MAPBOX_SEARCH',

    // Monetization
    ENABLE_COIN_RECHARGE = 'ENABLE_COIN_RECHARGE',
}

/**
 * Free-tier limit for HABITS: how many habits an unentitled account may track
 * at once. Configurable without a code change by setting
 * HABITS_FREE_HABIT_LIMIT in the environment.
 *
 * This replaced an earlier cap on *pacts created*, which measured the wrong
 * thing. Pacts are the social act the app exists to encourage, and counting
 * them meant a user with one habit and four accountability partners was at the
 * limit while a user with five solo habits and no friends was not. Counting
 * tracked habits caps the value delivered rather than the invitations sent, and
 * it is the number a user can see and reason about on their own dashboard.
 *
 * Lowered from 5 to 3 in September 2026. Five was more than most people ever
 * tracked at once, so the cap was a limit almost nobody met and the paywall a
 * screen almost nobody saw. Three is the number a committed user reaches in
 * their first weeks, which is when the offer is worth showing.
 *
 * Enforced by `checkHabitCapacity` in the users-service, which is the only
 * place that reads this; the client learns the value from
 * `GET /habits/user-habits/eligibility` rather than from this constant.
 */
const DEFAULT_HABITS_FREE_HABIT_LIMIT = 3;

/**
 * The companion cap that stops the active limit being cycled through: how many
 * habits an unentitled account may *start* (create, accept, or restore) inside
 * any rolling window, and how long that window is.
 *
 * Counting only active habits makes archiving a real escape hatch, which is
 * deliberate — but it also means a user can archive one habit and start
 * another indefinitely and never meet the cap. The window closes that loop
 * without turning archiving into a trap: a user who tried three habits and
 * shelved them can still start more next month, and an archived habit can
 * always be restored into a free slot as long as the window allows. Counted on
 * `habits.user_habits.startedAt`, which every start path stamps.
 *
 * Both configurable without a deploy — HABITS_FREE_HABIT_STARTS_PER_WINDOW and
 * HABITS_FREE_HABIT_START_WINDOW_DAYS — because the right values are an
 * empirical question. Five starts per thirty days is room to set up the full
 * free tier and swap two of them, and nothing more.
 */
const DEFAULT_HABITS_FREE_HABIT_STARTS_PER_WINDOW = 5;
const DEFAULT_HABITS_FREE_HABIT_START_WINDOW_DAYS = 30;

/**
 * How many accounts may claim the one-time "free for life" founder purchase.
 * Read when rendering the paywall and when allocating a founder slot.
 *
 * Purchases that arrive after the limit is reached are still honoured (the
 * buyer paid); they simply get no founder number. See
 * `20260815000002_habits.lifetime_purchases.js`.
 */
const DEFAULT_HABITS_LIFETIME_FOUNDER_LIMIT = 5000;

/**
 * How many distinct people a HABITS user must have invited to a pact before
 * they may start tracking a habit on their own.
 *
 * The mandatory invite is the app's growth loop, and this keeps it mandatory —
 * but as a threshold rather than a wall. At one, the requirement read as a toll
 * on the way in. At three it is worth surfacing as something to earn, so the
 * client shows progress toward it ("2 of 3 friends invited") and the invite
 * stops being a thing done *to* the user.
 *
 * Configurable without a deploy via HABITS_SOLO_UNLOCK_INVITE_COUNT, because
 * this is a growth lever whose right value is an empirical question — if three
 * turns out to suppress activation, it should be tunable the same day.
 *
 * Counts people, not invitations: see
 * `PactMembersStore.countDistinctInvitedByCreator`.
 */
const DEFAULT_HABITS_SOLO_UNLOCK_INVITE_COUNT = 3;

const parseLimit = (raw: unknown, fallback: number): number => {
    const parsed = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const HABITS_FREE_HABIT_LIMIT = parseLimit(
    typeof process !== 'undefined' ? process?.env?.HABITS_FREE_HABIT_LIMIT : undefined,
    DEFAULT_HABITS_FREE_HABIT_LIMIT,
);

const HABITS_FREE_HABIT_STARTS_PER_WINDOW = parseLimit(
    typeof process !== 'undefined' ? process?.env?.HABITS_FREE_HABIT_STARTS_PER_WINDOW : undefined,
    DEFAULT_HABITS_FREE_HABIT_STARTS_PER_WINDOW,
);

const HABITS_FREE_HABIT_START_WINDOW_DAYS = parseLimit(
    typeof process !== 'undefined' ? process?.env?.HABITS_FREE_HABIT_START_WINDOW_DAYS : undefined,
    DEFAULT_HABITS_FREE_HABIT_START_WINDOW_DAYS,
);

const HABITS_LIFETIME_FOUNDER_LIMIT = parseLimit(
    typeof process !== 'undefined' ? process?.env?.HABITS_LIFETIME_FOUNDER_LIMIT : undefined,
    DEFAULT_HABITS_LIFETIME_FOUNDER_LIMIT,
);

const HABITS_SOLO_UNLOCK_INVITE_COUNT = parseLimit(
    typeof process !== 'undefined' ? process?.env?.HABITS_SOLO_UNLOCK_INVITE_COUNT : undefined,
    DEFAULT_HABITS_SOLO_UNLOCK_INVITE_COUNT,
);

export {
    FeatureFlags,
    HABITS_FREE_HABIT_LIMIT,
    DEFAULT_HABITS_FREE_HABIT_LIMIT,
    HABITS_FREE_HABIT_STARTS_PER_WINDOW,
    DEFAULT_HABITS_FREE_HABIT_STARTS_PER_WINDOW,
    HABITS_FREE_HABIT_START_WINDOW_DAYS,
    DEFAULT_HABITS_FREE_HABIT_START_WINDOW_DAYS,
    HABITS_LIFETIME_FOUNDER_LIMIT,
    DEFAULT_HABITS_LIFETIME_FOUNDER_LIMIT,
    HABITS_SOLO_UNLOCK_INVITE_COUNT,
    DEFAULT_HABITS_SOLO_UNLOCK_INVITE_COUNT,
};
