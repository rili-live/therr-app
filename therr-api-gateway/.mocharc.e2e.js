// Mocha config for the campaign E2E suite.
//
// Scoped to tests/e2e/ so the main test/integration runners are untouched.
// The suite needs a longer default timeout because each test seeds and
// tears down DB rows across two databases.
//
// NOTE: no `spec` here, deliberately. Mocha CONCATENATES a config `spec` with the
// positional file arguments rather than letting the arguments override it, so a
// `spec: ['./tests/e2e/**/*.test.ts']` made `test:e2e:critical` run the whole suite
// while reporting it as the fast subset. Both npm scripts pass their own glob.

// Pin the suite to UTC, for the same reason .mocharc.js does: CI and production
// both run UTC, so a test that reads the host timezone fails only on a developer's
// machine and reads as flakiness rather than as the real defect.
process.env.TZ = 'UTC';

module.exports = {
    extension: ['ts', 'js'],
    // Root hook that turns "no database" from a silent all-green run into a CI failure.
    require: ['./tests/e2e/helpers/requireDbInCi.ts'],
    timeout: 15000,
    reporter: 'spec',
    exit: true,
};
