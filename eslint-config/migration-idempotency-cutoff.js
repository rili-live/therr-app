// The point in time from which migrations must be idempotent.
//
// `therr/require-idempotent-migration` skips any migration whose `YYYYMMDDHHMMSS` filename
// prefix sorts before this value. The ~190 migrations written before the rule landed are
// already applied in every environment; rewriting them to be re-runnable would change no
// production behaviour and would touch a lot of deployed schema history for nothing. The
// gate is about migrations written from here on.
//
// This is a one-way ratchet. Moving the cutoff *forward* re-exempts migrations that are
// currently passing, which is how a gate quietly stops gating — so
// eslint-config/plugin/tests/migration-idempotency-cutoff.test.js asserts both that the
// cutoff is in the past and that every migration at or after it is clean. Raise it only
// after the migrations it would newly exempt have been deliberately reviewed.
//
// Set to 2026-07-30, one day after the newest migration at the time the rule was written
// (20260728000001_main.userLocations.dwelling.js).

module.exports = {
    MIGRATION_IDEMPOTENCY_CUTOFF: '20260730000000',
};
