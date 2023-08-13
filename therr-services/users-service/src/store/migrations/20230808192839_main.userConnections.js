exports.up = (knex) => knex.schema.raw(`
    ALTER TABLE "main"."userConnections"
    DROP CONSTRAINT "userConnections_requestStatus_check";
`);

exports.down = (knex) => knex.schema.raw(`
    ALTER TABLE "main"."userConnections"
    ADD CONSTRAINT "userConnections_requestStatus_check"
    CHECK ("requestStatus" IN ('pending', 'complete', 'denied'));
`);
