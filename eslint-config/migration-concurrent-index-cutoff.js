// The point in time from which migrations must build and drop indexes CONCURRENTLY.
//
// `therr/require-concurrent-index` skips any migration whose `YYYYMMDDHHMMSS` filename prefix
// sorts before this value. Everything before it has already run in production, so the lock it
// took is history — rewriting those files would change nothing anywhere.
//
// Set to 2026-10-23: the earliest migration not yet on `main` when the rule was written
// (20261023000001_habits.challenges.js), so every migration that had not reached production was
// checked by it. Same one-way ratchet as migration-idempotency-cutoff.js:
// eslint-config/plugin/tests/migration-concurrent-index-cutoff.test.js asserts the cutoff is in
// the past and that every migration at or after it passes. Raise it only after the migrations it
// would newly exempt have been deliberately reviewed.

module.exports = {
    MIGRATION_CONCURRENT_INDEX_CUTOFF: '20261023000000',
};
