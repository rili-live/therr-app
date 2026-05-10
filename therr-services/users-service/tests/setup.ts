// Mocha global setup: seed test-safe defaults for env vars that production
// modules read at module load. Required by mocharc via `require`. Without
// these, importing utilities that build SDK clients at top level (Twilio,
// AWS) can crash the test runner before any test executes.
//
// Real values from .env are used when present (set by the run script or the
// developer's shell). These defaults only fill in when unset.

if (!process.env.TWILIO_ACCOUNT_SID) {
    // Twilio's constructor rejects empty strings and anything not starting
    // with 'AC'. Provide a syntactically valid placeholder; tests that
    // actually need to call the client must stub it.
    process.env.TWILIO_ACCOUNT_SID = `AC${'0'.repeat(32)}`;
}
if (!process.env.TWILIO_AUTH_TOKEN) {
    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
}
