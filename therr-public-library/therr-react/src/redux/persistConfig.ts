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
    whitelist: [
        'user',
        'content',
        'notifications',
        'userConnections',
    ],
};

export default basePersistConfig;
