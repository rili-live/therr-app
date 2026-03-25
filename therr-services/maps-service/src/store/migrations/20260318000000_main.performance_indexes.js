// Note: CREATE INDEX CONCURRENTLY is used in production (outside a transaction).
// For dev/Docker migrations, we use regular CREATE INDEX IF NOT EXISTS so migrations
// can run within knex's transaction wrapper.

exports.up = async (knex) => {
    // Composite indexes for frequent search filter patterns

    // moments: search queries filter by isMatureContent + isPublic frequently
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_moments_mature_public ON main.moments ("isMatureContent", "isPublic")');

    // moments: lookups by fromUserId with ordering by createdAt
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_moments_from_user_created ON main.moments ("fromUserId", "createdAt" DESC)');

    // moments: space moments query filters by spaceId + isPublic + createdAt
    await knex.raw(
        'CREATE INDEX IF NOT EXISTS idx_moments_space_public_created'
        + ' ON main.moments ("spaceId", "isPublic", "createdAt" DESC) WHERE "spaceId" IS NOT NULL',
    );

    // spaces: search queries filter by isMatureContent + isClaimPending
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_spaces_mature_claim ON main.spaces ("isMatureContent", "isClaimPending")');

    // spaces: lookups by fromUserId with isMatureContent filter
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_spaces_from_user_mature ON main.spaces ("fromUserId", "isMatureContent")');

    // events: search queries filter by isMatureContent + scheduleStartAt
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_events_mature_schedule ON main.events ("isMatureContent", "scheduleStartAt" DESC)');

    // events: group events query
    await knex.raw(
        'CREATE INDEX IF NOT EXISTS idx_events_group_schedule'
        + ' ON main.events ("groupId", "scheduleStartAt" DESC) WHERE "groupId" IS NOT NULL',
    );

    // events: space events query
    await knex.raw(
        'CREATE INDEX IF NOT EXISTS idx_events_space_public_schedule'
        + ' ON main.events ("spaceId", "isPublic", "scheduleStartAt" DESC) WHERE "spaceId" IS NOT NULL',
    );

    // Geography functional indexes for ST_DWithin distance queries
    // These allow the planner to use GiST index scans instead of sequential scans
    // when queries cast geometry columns to geography for meter-based distance checks
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_moments_geom_geography ON main.moments USING gist((geom::geography))');

    await knex.raw('CREATE INDEX IF NOT EXISTS idx_spaces_geom_center_geography ON main.spaces USING gist(("geomCenter"::geography))');

    await knex.raw('CREATE INDEX IF NOT EXISTS idx_events_geom_geography ON main.events USING gist((geom::geography))');
};

exports.down = (knex) => knex.raw(`
    DROP INDEX IF EXISTS main.idx_moments_mature_public;
    DROP INDEX IF EXISTS main.idx_moments_from_user_created;
    DROP INDEX IF EXISTS main.idx_moments_space_public_created;
    DROP INDEX IF EXISTS main.idx_spaces_mature_claim;
    DROP INDEX IF EXISTS main.idx_spaces_from_user_mature;
    DROP INDEX IF EXISTS main.idx_events_mature_schedule;
    DROP INDEX IF EXISTS main.idx_events_group_schedule;
    DROP INDEX IF EXISTS main.idx_events_space_public_schedule;
    DROP INDEX IF EXISTS main.idx_moments_geom_geography;
    DROP INDEX IF EXISTS main.idx_spaces_geom_center_geography;
    DROP INDEX IF EXISTS main.idx_events_geom_geography;
`);
