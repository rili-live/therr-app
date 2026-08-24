// Pin the suite to UTC.
//
// CI runs UTC and production runs UTC, so a test that reads the host timezone
// passes here and fails only on a developer's machine — and, west of UTC, only
// after local evening, which reads as flakiness rather than as the real defect.
// Two such bugs shipped into the habits lifecycle work (a date parsed at UTC
// midnight then formatted as a local calendar date, in both the engine and its
// fixtures) and neither was visible to CI.
//
// This makes the default deterministic; it does not remove timezone coverage.
// Tests that care set `process.env.TZ` themselves and assert across several
// zones — see "the trailing windows" in
// users-service/tests/unit/handlers-habits-digest-lifecycle.test.ts.
process.env.TZ = 'UTC';

module.exports = {
    extension: ['ts', 'js'],
    recursive: true,
    require: ['./tests/setup.ts'],
};
