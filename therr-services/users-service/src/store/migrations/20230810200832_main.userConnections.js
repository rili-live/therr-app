// This prevents having 2 userConnections between the same two users where accepting vs. requesting is reverted
exports.up = (knex) => knex.schema.raw(`
    CREATE UNIQUE INDEX
    "userconnections_least_greatest_idx"
    ON "main"."userConnections"
    (least("acceptingUserId", "requestingUserId"), greatest("acceptingUserId", "requestingUserId"));
`);

exports.down = (knex) => knex.schema.raw(`
    DROP INDEX IF EXISTS "main"."userconnections_least_greatest_idx";
`);
