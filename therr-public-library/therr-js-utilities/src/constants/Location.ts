const locationConstants = {
    FALLBACK_CACHE_SEARCH_RADIUS_METERS: 50,
    AREA_PROXIMITY_METERS: 1000,
    AREA_PROXIMITY_NEARBY_METERS: 1609, // ~1 mile // Used for cache invalidation
    AREA_PROXIMITY_EXPANDED_METERS: 160934, // ~100 miles // Temporarily increased until more user traction
    MAX_DISTANCE_TO_CHECK_IN_METERS: 20,
    MAX_AREA_ACTIVATE_COUNT: 50,
    MIN_TIME_BETWEEN_PUSH_NOTIFICATIONS_MS: 1000 * 60 * 3, // 3 minutes
    MIN_TIME_BETWEEN_CHECK_IN_PUSH_NOTIFICATIONS_MS: 1000 * 60 * 30, // 30 minutes
    MIN_TIME_BEFORE_POST_VISIT_NOTIFICATION_MS: 1000 * 60 * 60 * 2, // 2 hours after last visit before sending review CTA
    // Dwelling locations (home, hotel, apartment, extended stay, etc.)
    // A userLocation becomes a "dwelling" once it has been observed on this many distinct
    // calendar days. Multiple days of presence is what separates a place a user lives/stays
    // from a place they merely frequent (coffee shop, gym, office lunch spot).
    DWELL_MIN_DISTINCT_DAYS: 3,
    // How close the user must be to a known dwelling to be considered "at" it.
    // Larger than MAX_DISTANCE_TO_CHECK_IN_METERS because a dwelling is a general
    // area (a building/block), and because rounded coordinates are ~111m granular.
    DWELL_LOCATION_RADIUS_METERS: 150,
    // Dwellings decay: a hotel from last year should not permanently mute notifications.
    DWELL_LOCATION_MAX_AGE_MS: 1000 * 60 * 60 * 24 * 30, // 30 days since last visit
    // How far from a city an author may be and still have their post tagged as being about
    // it (see `detectLocality`). Deliberately the same 60km as PULSE's localFeedRadiusMeters,
    // which buys a property worth keeping: you can only tag a city whose local feed you
    // would yourself be served. If the two numbers drift apart, that stops being true.
    LOCAL_AUTHOR_MAX_DISTANCE_METERS: 60000,
    MIN_RADIUS_OF_AWARENESS: 10,
    MAX_RADIUS_OF_AWARENESS: 160934,
    MIN_RADIUS_OF_INFLUENCE: 10,
    MAX_RADIUS_OF_INFLUENCE: 16093.4,
    MAX_DISTANCE_TO_EVENT: 1609340, // ~ 1000 miles
};

export default locationConstants;
