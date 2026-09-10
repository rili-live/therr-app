// Let a user choose which algorithm ranks their content stream.
//
// Context: until now "the algorithm" was a set of hardcoded literals spread across four
// uncoordinated ranking surfaces (docs/ALGORITHM_AUDIT.md). Those constants now live in
// therr-js-utilities `content-ranking` as named profiles, and this column records which
// profile a user picked. It is read by the thought distributor (users-service
// TherrEventEmitter) to select and score candidates.
//
// Defaults to 'pulse' deliberately. PULSE's profile values reproduce the pre-abstraction
// production ranker exactly — same gravity, candidate pool, activation batch range, interest
// boost, and no author-diversity cap — and content-ranking's unit tests assert that the SQL
// it emits is byte-identical to the previous HOT_SCORE_EXPRESSION. So every existing row
// backfills to the behavior it already had and nobody's feed changes until they open the
// picker. Keep this in sync with DEFAULT_CONTENT_ALGORITHM; it cannot be imported here
// because migrations are plain JS and the constant is TypeScript compiled to lib/.
//
// NOT NULL so the read path never has to distinguish "unset" from "chose the default" — a
// nullable column would push that branch into every consumer.
//
// varchar(32) rather than a pg enum: the set of algorithms is expected to grow (WANDER is
// already implemented but unreleased pending geo-aware map surfaces), and adding a value to
// a pg enum is a schema migration that cannot run inside a transaction with other DDL. The
// authoritative allow-list is SELECTABLE_CONTENT_ALGORITHMS, enforced at the API gateway.
//
// Idempotent (ADD COLUMN IF NOT EXISTS / DROP COLUMN IF EXISTS) per
// therr/require-idempotent-migration: knex writes the knex_migrations row only after the
// function resolves, so a run killed partway would otherwise leave the column in place with
// no ledger row and fail on re-run.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE main."users" ADD COLUMN IF NOT EXISTS "settingsContentAlgorithm" varchar(32) NOT NULL DEFAULT \'pulse\'');
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('ALTER TABLE main."users" DROP COLUMN IF EXISTS "settingsContentAlgorithm"');
};
