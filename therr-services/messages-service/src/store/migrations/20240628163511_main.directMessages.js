// This prevents having 2 directMessages between the same two users where accepting vs. requesting is reverted
exports.up = (knex) => knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS
    "directmessages_least_greatest_idx"
    ON "main"."directMessages"
    (least("fromUserId", "toUserId"), greatest("fromUserId", "toUserId"));
`);

exports.down = (knex) => knex.schema.raw(`
    DROP INDEX IF EXISTS "main"."directmessages_least_greatest_idx";
`);
