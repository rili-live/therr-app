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
 * Enforced by `assertHabitCapacity` in the users-service, which is the only
 * place that reads this.
 */
const DEFAULT_HABITS_FREE_HABIT_LIMIT = 5;

/**
 * How many accounts may claim the one-time "free for life" founder purchase.
 * Read when rendering the paywall and when allocating a founder slot.
 *
 * Purchases that arrive after the limit is reached are still honoured (the
 * buyer paid); they simply get no founder number. See
 * `20260815000002_habits.lifetime_purchases.js`.
 */
const DEFAULT_HABITS_LIFETIME_FOUNDER_LIMIT = 5000;

const parseLimit = (raw: unknown, fallback: number): number => {
    const parsed = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const HABITS_FREE_HABIT_LIMIT = parseLimit(
    typeof process !== 'undefined' ? process?.env?.HABITS_FREE_HABIT_LIMIT : undefined,
    DEFAULT_HABITS_FREE_HABIT_LIMIT,
);

const HABITS_LIFETIME_FOUNDER_LIMIT = parseLimit(
    typeof process !== 'undefined' ? process?.env?.HABITS_LIFETIME_FOUNDER_LIMIT : undefined,
    DEFAULT_HABITS_LIFETIME_FOUNDER_LIMIT,
);

export {
    FeatureFlags,
    HABITS_FREE_HABIT_LIMIT,
    DEFAULT_HABITS_FREE_HABIT_LIMIT,
    HABITS_LIFETIME_FOUNDER_LIMIT,
    DEFAULT_HABITS_LIFETIME_FOUNDER_LIMIT,
};
