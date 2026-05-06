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

    // HABITS Premium Tier (gated by user subscription status)
    PREMIUM_UNLIMITED_PACTS = 'PREMIUM_UNLIMITED_PACTS',
    PREMIUM_VIDEO_PROOF = 'PREMIUM_VIDEO_PROOF',
    PREMIUM_ANALYTICS = 'PREMIUM_ANALYTICS',
    PREMIUM_CUSTOM_CONSEQUENCES = 'PREMIUM_CUSTOM_CONSEQUENCES',
    PREMIUM_HEALTH_INTEGRATIONS = 'PREMIUM_HEALTH_INTEGRATIONS',

    // Search Providers
    ENABLE_MAPBOX_SEARCH = 'ENABLE_MAPBOX_SEARCH',

    // Monetization
    ENABLE_COIN_RECHARGE = 'ENABLE_COIN_RECHARGE',
}

/**
 * Free-tier limits for HABITS. Configurable so the value can be tuned without
 * a code change: set HABITS_FREE_PACT_LIMIT in the environment to override the
 * default. Phase 4 ships at 5 to validate the gating UX without throttling
 * early adopters; the project brief target is 1 once the payment workflow
 * (web-based, see docs/niche-sub-apps/habits/HABITS_PAYMENT_WORKFLOW.md) is
 * live and users can actually upgrade.
 */
const DEFAULT_HABITS_FREE_PACT_LIMIT = 5;

const parseLimit = (raw: unknown, fallback: number): number => {
    const parsed = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const HABITS_FREE_PACT_LIMIT = parseLimit(
    typeof process !== 'undefined' ? process?.env?.HABITS_FREE_PACT_LIMIT : undefined,
    DEFAULT_HABITS_FREE_PACT_LIMIT,
);

export {
    FeatureFlags,
    HABITS_FREE_PACT_LIMIT,
    DEFAULT_HABITS_FREE_PACT_LIMIT,
};
