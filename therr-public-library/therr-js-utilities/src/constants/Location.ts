const locationConstants = {
    FALLBACK_CACHE_SEARCH_RADIUS_METERS: 50,
    AREA_PROXIMITY_METERS: 1000,
    AREA_PROXIMITY_NEARBY_METERS: 4828, // ~3 miles // Used for cache invalidation
    AREA_PROXIMITY_EXPANDED_METERS: 160934, // ~100 miles // Temporarily increased until more user traction
    MAX_AREA_ACTIVATE_COUNT: 50,
    MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS: 1000 * 60 * 3, // 3 minutes
    MIN_RADIUS_OF_AWARENESS: 10,
    MAX_RADIUS_OF_AWARENESS: 160934,
    MIN_RADIUS_OF_INFLUENCE: 10,
    MAX_RADIUS_OF_INFLUENCE: 16093.4,
};

export default locationConstants;
