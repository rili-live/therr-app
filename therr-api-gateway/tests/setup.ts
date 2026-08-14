// Mocha global setup: seed test-safe defaults for env vars that production
// modules read at module load, and neuter the outbound SMS transport for the
// whole run. Required by mocharc via `require`.
//
// Real values from .env are used when present (set by the run script or the
// developer's shell). These defaults only fill in when unset.
//
// Unlike users-service's setup, this file deliberately does NOT load the root
// `.env`. The gateway holds no database connection to point at the dev
// container — its only load-time config is the Twilio pair seeded below — so
// pulling in the whole developer environment would add real credentials to the
// process for no benefit. Keep it that way: if a future module here needs real
// config under test, seed that single var rather than loading dotenv.

// Safe to hoist above the env seeding below: installing the stubs only
// patches the Twilio prototype and reads no configuration.
import { installOutboundTransportStubs, resetSmsOutbox } from './helpers/outboundStubs';

if (!process.env.TWILIO_ACCOUNT_SID) {
    // Twilio's constructor rejects empty strings and anything not starting
    // with 'AC'. Provide a syntactically valid placeholder; tests that
    // actually need to inspect a send should assert on the outbox below.
    process.env.TWILIO_ACCOUNT_SID = `AC${'0'.repeat(32)}`;
}
if (!process.env.TWILIO_AUTH_TOKEN) {
    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
}

// Seeded for the suites that import the real routers (see
// tests/unit/utilities/routeOrdering.test.ts). `middleware/authenticate` throws
// at import if these are unset — deliberately, so a missing secret crash-loops
// the service instead of silently verifying against an empty one. The values
// are never used to sign or verify anything under test.
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-jwt-secret';
}
if (!process.env.JWT_EMAIL_SECRET) {
    process.env.JWT_EMAIL_SECRET = 'test-jwt-email-secret';
}
// The routers read `globalConfig[process.env.NODE_ENV]` at module load and
// would dereference undefined without a key that exists in global-config.
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}

// Nothing under tests/ may reach Twilio: the phone routes send an SMS on every
// start/verify call, and a developer shell carrying real credentials would
// bill (and deliver) them for real. See tests/helpers/outboundStubs.ts.
installOutboundTransportStubs();

// Root hook plugin: mocha applies these around every test in the run,
// regardless of file. Resetting here makes outbox assertions independent of
// which specs ran first — without it, a spec that asserts `lengthOf(1)` passes
// or fails based on file ordering alone. Individual suites may still call
// resetSmsOutbox() themselves; running twice is harmless.
export const mochaHooks = {
    beforeEach() {
        resetSmsOutbox();
    },
};
