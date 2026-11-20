// Groups: only established accounts can hide a group from everyone's Discover (issue #3230).
//
// Without this, any three accounts, however new, could hide any public group for everyone.
// "countsTowardHide" is decided once, when the report is filed, from the reporter's account age
// (ForumReportsStore.FORUM_REPORT_MIN_ACCOUNT_AGE_DAYS). Account age lives in users-service's
// database, so it cannot be joined at read time; storing the verdict on the row keeps the
// Discover filter a single grouped query on this table.
//
// Every report still hides the group from its own reporter at once; this column only decides
// whether it counts toward FORUM_REPORT_HIDE_THRESHOLD.
//
// Defaults to false: a row whose reporter could not be checked never helps hide a group.
// A separate migration rather than an edit to 20261119000001, so a dev database that has
// already run that one still gets the column.
//
// Idempotent: ADD COLUMN IF NOT EXISTS / DROP COLUMN IF EXISTS. No index: the column is only
// read inside the per-forum aggregate, which is already grouped on the forumId index.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = (knex) => knex.raw(
    'ALTER TABLE main."forumReports" ADD COLUMN IF NOT EXISTS "countsTowardHide" boolean NOT NULL DEFAULT false',
);

/**
 * @param { import("knex").Knex } knex
 */
exports.down = (knex) => knex.raw(
    'ALTER TABLE main."forumReports" DROP COLUMN IF EXISTS "countsTowardHide"',
);
