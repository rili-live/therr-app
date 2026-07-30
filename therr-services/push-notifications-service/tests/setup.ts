// Mocha global setup: seed test-safe defaults for env vars that production
// modules read at module load, and neuter the outbound push transport for the
// whole run. Required by mocharc via `require`.
//
// Real values from the developer's shell are used when present. These defaults
// only fill in when unset.
//
// Like the gateway's setup and unlike users-service's, this file deliberately
// does NOT load the root `.env`: the only load-time config this service needs
// under test is the Firebase credential seeded below. Seed a single var rather
// than pulling the whole developer environment (and its live credentials) into
// the process.

// Safe to hoist above the env seeding below: installing the stubs only patches
// the firebase-admin Messaging prototype and reads no configuration. In
// particular it does not import src/api/firebaseAdmin, which would run the
// startup validation before the seeding below had a chance to satisfy it.
import { generateKeyPairSync } from 'crypto';
import { installOutboundTransportStubs, resetPushOutbox } from './helpers/outboundStubs';

if (!process.env.PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64) {
    // src/api/firebaseAdmin.ts throws at import time when the THERR credential
    // is missing, so without this any test that transitively imports it fails
    // before running. admin.credential.cert() parses the private key for real,
    // so a placeholder string will not do — generate a throwaway keypair.
    // Generated rather than committed: a checked-in PEM, even a disposable one,
    // trips secret scanners and invites copy-paste into somewhere it matters.
    const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    process.env.PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64 = Buffer.from(JSON.stringify({
        type: 'service_account',
        project_id: 'test-project',
        private_key_id: 'test-key-id',
        private_key: privateKey,
        client_email: 'test@test-project.iam.gserviceaccount.com',
        client_id: '000000000000000000000',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
    })).toString('base64');
}

// Nothing under tests/ may reach FCM: a real send lands on real handsets, and
// unlike a stray SMS there is no bill to notice it afterwards. See
// tests/helpers/outboundStubs.ts.
installOutboundTransportStubs();

// Root hook plugin: mocha applies these around every test in the run,
// regardless of file. Resetting here makes outbox assertions independent of
// which specs ran first — without it, a spec that asserts `lengthOf(1)` passes
// or fails based on file ordering alone. Individual suites may still call
// resetPushOutbox() themselves; running twice is harmless.
export const mochaHooks = {
    beforeEach() {
        resetPushOutbox();
    },
};
