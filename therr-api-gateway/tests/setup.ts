// Mocha global setup: seed test-safe defaults for env vars that production
// modules read at module load, and neuter the outbound SMS transport for the
// whole run. Required by mocharc via `require`.
//
// Real values from .env are used when present (set by the run script or the
// developer's shell). These defaults only fill in when unset.

// Safe to hoist above the env seeding below: installing the stubs only
// patches the Twilio prototype and reads no configuration.
import { installOutboundTransportStubs } from './helpers/outboundStubs';

if (!process.env.TWILIO_ACCOUNT_SID) {
    // Twilio's constructor rejects empty strings and anything not starting
    // with 'AC'. Provide a syntactically valid placeholder; tests that
    // actually need to inspect a send should assert on the outbox below.
    process.env.TWILIO_ACCOUNT_SID = `AC${'0'.repeat(32)}`;
}
if (!process.env.TWILIO_AUTH_TOKEN) {
    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
}

// Nothing under tests/ may reach Twilio: the phone routes send an SMS on every
// start/verify call, and a developer shell carrying real credentials would
// bill (and deliver) them for real. See tests/helpers/outboundStubs.ts.
installOutboundTransportStubs();
