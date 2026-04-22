// Indexes to support the Quick Report feature:
// - searchMoments now filters by expiresAt to exclude expired quick reports
// - getQuickReportsSummary queries by (spaceId, category, expiresAt, isMatureContent)
//
// Note: CREATE INDEX CONCURRENTLY should be used in production (outside a transaction).
// For dev/Docker migrations, we use regular CREATE INDEX IF NOT EXISTS.

exports.up = async (knex) => {
    // Partial index on expiresAt for non-null values only.
    // Most moments have NULL expiresAt (no expiry). Quick reports have non-null values.
    // This keeps the index small while covering the OR condition:
    //   WHERE expiresAt IS NULL OR expiresAt > now()
    // Postgres will use this index for the "expiresAt > now()" branch and skip
    // the NULL rows (which pass the IS NULL check anyway).
    await knex.raw(
        'CREATE INDEX IF NOT EXISTS idx_moments_expires_at'
        + ' ON main.moments ("expiresAt") WHERE "expiresAt" IS NOT NULL',
    );

    // Composite index for getQuickReportsSummary query pattern:
    //   WHERE spaceId = ? AND category IN (...) AND (expiresAt IS NULL OR expiresAt > ?)
    //     AND isMatureContent = false
    //   GROUP BY category
    //
    // spaceId leads because it's the most selective (single space).
    // category second for the IN filter + GROUP BY.
    // Partial index on non-null spaceId keeps it small.
    await knex.raw(
        'CREATE INDEX IF NOT EXISTS idx_moments_space_category_expires'
        + ' ON main.moments ("spaceId", "category", "expiresAt")'
        + ' WHERE "spaceId" IS NOT NULL AND "isMatureContent" = false',
    );
};

exports.down = (knex) => knex.raw(`
    DROP INDEX IF EXISTS main.idx_moments_expires_at;
    DROP INDEX IF EXISTS main.idx_moments_space_category_expires;
`);
