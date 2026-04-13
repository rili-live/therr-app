/**
 * Mocha config for the campaign E2E suite.
 *
 * Scoped to tests/e2e/ so the main test/integration runners are untouched.
 * The suite needs a longer default timeout because each test seeds and
 * tears down DB rows across two databases.
 */
module.exports = {
    extension: ['ts', 'js'],
    spec: ['./tests/e2e/**/*.test.ts'],
    timeout: 15000,
    reporter: 'spec',
    exit: true,
};
