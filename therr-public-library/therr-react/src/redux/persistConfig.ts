/**
 * Shared redux-persist configuration.
 *
 * Each platform (mobile/web) wraps the root reducer with `persistReducer`
 * using this config merged with a platform-specific `storage` adapter.
 *
 * Only read-heavy, user-relevant slices are persisted.
 * Transient slices (map, messages, reactions, routing) are excluded.
 */
const basePersistConfig = {
    key: 'therr-root',
    version: 1,
    // Coalesce writes so action bursts (map searches, socket events, feed
    // refreshes) don't each trigger a full slice serialization into storage.
    // Trade-off: up to `throttle` ms of unpersisted state on hard-kill.
    throttle: 1000,
    whitelist: [
        'user',
        'content',
        'notifications',
        'userConnections',
    ],
};

export default basePersistConfig;
