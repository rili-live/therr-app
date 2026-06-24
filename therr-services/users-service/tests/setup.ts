// Mocha global setup: seed test-safe defaults for env vars that production
// modules read at module load. Required by mocharc via `require`. Without
// these, importing utilities that build SDK clients at top level (Twilio,
// AWS) can crash the test runner before any test executes.
//
// Real values from .env are used when present (set by the run script or the
// developer's shell). These defaults only fill in when unset.

// Load the root .env first so config.ts (read at import time) picks up the real
// DB host/port. The unit `test:` scripts don't load dotenv themselves, so without
// this any test that exercises an unstubbed store falls back to localhost:5432 and
// fails with ECONNREFUSED when the dev DB is mapped to a non-default port (e.g. 5431).
// dotenv does not override already-set vars, so a CI-provided environment still wins.
// eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

if (!process.env.TWILIO_ACCOUNT_SID) {
    // Twilio's constructor rejects empty strings and anything not starting
    // with 'AC'. Provide a syntactically valid placeholder; tests that
    // actually need to call the client must stub it.
    process.env.TWILIO_ACCOUNT_SID = `AC${'0'.repeat(32)}`;
}
if (!process.env.TWILIO_AUTH_TOKEN) {
    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
}
// config.ts reads JWT_SECRET / JWT_EMAIL_SECRET once at import time, so they must be
// present before any module that imports config is loaded. Setting them inside a test's
// before() hook is too late — the value is already captured. Seed non-empty defaults here
// (the run script / shell .env override these when present).
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-secret-key';
}
if (!process.env.JWT_EMAIL_SECRET) {
    process.env.JWT_EMAIL_SECRET = 'test-email-secret-key';
}
