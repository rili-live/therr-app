/**
 * Performance indexes for users-service scalability.
 *
 * Addresses the following query bottlenecks:
 *
 * 1. notifications.associationId - searchNotifications LEFT JOINs on associationId = userConnections.id
 *    with no index, causing sequential scan on every notification fetch.
 *
 * 2. notifications(type) - the LEFT JOIN condition also filters by type (CONNECTION_REQUEST_ACCEPTED,
 *    CONNECTION_REQUEST_RECEIVED), which is unindexed.
 *
 * 3. userConnections partial index for active connections - searchUserConnections and countRecords
 *    always filter by requestStatus='complete' AND isConnectionBroken=false. A partial index on
 *    (requestingUserId) and (acceptingUserId) with this WHERE clause avoids scanning inactive rows.
 *
 * 4. users pg_trgm trigram indexes - searchUsers uses ILIKE '%query%' on firstName, lastName,
 *    userName which cannot use B-tree indexes. Trigram GIN indexes enable fast substring matching.
 *
 * 5. userInterests(userId, isEnabled) - findUsersWithInterests joins on userId WHERE isEnabled=true
 *    but only has single-column indexes.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
    // 1. Enable pg_trgm extension for trigram-based ILIKE search
    await knex.schema.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm;');

    // 2. Trigram GIN indexes on users for ILIKE '%query%' search performance
    await knex.schema.raw('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_first_name_trgm ON main.users USING GIN ("firstName" gin_trgm_ops);');
    await knex.schema.raw('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_name_trgm ON main.users USING GIN ("lastName" gin_trgm_ops);');
    await knex.schema.raw('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_user_name_trgm ON main.users USING GIN ("userName" gin_trgm_ops);');

    // 3. Notifications indexes for searchNotifications JOIN and filtering
    await knex.schema.raw('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_association_id ON main.notifications ("associationId");');
    await knex.schema.raw('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type ON main.notifications ("type");');

    // 4. Partial indexes on userConnections for active connection lookups
    // searchUserConnections and countRecords always filter by these conditions
    await knex.schema.raw(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_connections_active_requesting
        ON main."userConnections" ("requestingUserId")
        WHERE "requestStatus" = 'complete' AND "isConnectionBroken" = false;
    `);
    await knex.schema.raw(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_connections_active_accepting
        ON main."userConnections" ("acceptingUserId")
        WHERE "requestStatus" = 'complete' AND "isConnectionBroken" = false;
    `);

    // 5. Composite index on userInterests for findUsersWithInterests JOIN
    await knex.schema.raw(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_interests_user_enabled
        ON main."userInterests" ("userId", "interestId")
        WHERE "isEnabled" = true;
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
// Disable transaction wrapping so CREATE INDEX CONCURRENTLY can run
exports.config = { transaction: false };

exports.down = async (knex) => {
    await knex.schema.raw('DROP INDEX CONCURRENTLY IF EXISTS main.idx_user_interests_user_enabled;');
    await knex.schema.raw('DROP INDEX CONCURRENTLY IF EXISTS main.idx_user_connections_active_accepting;');
    await knex.schema.raw('DROP INDEX CONCURRENTLY IF EXISTS main.idx_user_connections_active_requesting;');
    await knex.schema.raw('DROP INDEX CONCURRENTLY IF EXISTS main.idx_notifications_type;');
    await knex.schema.raw('DROP INDEX CONCURRENTLY IF EXISTS main.idx_notifications_association_id;');
    await knex.schema.raw('DROP INDEX CONCURRENTLY IF EXISTS main.idx_users_user_name_trgm;');
    await knex.schema.raw('DROP INDEX CONCURRENTLY IF EXISTS main.idx_users_last_name_trgm;');
    await knex.schema.raw('DROP INDEX CONCURRENTLY IF EXISTS main.idx_users_first_name_trgm;');
    // Note: pg_trgm extension is left installed as other code may depend on it
};
