/**
 * Guards the test-suite safety net itself.
 *
 * `tests/setup.ts` neuters FCM by patching `Messaging.prototype.send` and its
 * batch siblings — the methods every push funnels through. Those choke points
 * are implementation details of firebase-admin: a major version bump could
 * move or rename them, and nothing else in the suite would notice. Tests would
 * keep passing while delivering real pushes to real handsets from developer
 * machines and CI.
 *
 * The assertions drive an app built the same way `src/api/firebaseAdmin.ts`
 * builds its per-brand apps (`admin.initializeApp` → `.messaging()`), so the
 * patch is proven on the path production actually takes rather than on a
 * hand-rolled `Messaging` instance.
 */
import { expect } from 'chai';
import { generateKeyPairSync } from 'crypto';
import * as admin from 'firebase-admin';
import { pushOutbox, resetPushOutbox } from '../helpers/outboundStubs';

// A named app avoids colliding with the default app that
// src/api/firebaseAdmin.ts initializes if another spec imports it.
const TEST_APP_NAME = 'outbound-stubs-safety-net';

describe('outbound transport stubs (test safety net)', () => {
    let messaging: admin.messaging.Messaging;
    let app: admin.app.App | undefined;

    before(() => {
        // Deliberately does not read PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64.
        // This suite's job is to prove the FCM patch holds, and it must not be
        // able to fail for an unrelated reason — an earlier spec mutating that
        // global, or a developer's real credential being shaped differently.
        // Mint a throwaway keypair instead so the suite is hermetic.
        // Building the app makes no network call; only sending would, and that
        // is exactly what the stub intercepts.
        const { privateKey } = generateKeyPairSync('rsa', {
            modulusLength: 2048,
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
            publicKeyEncoding: { type: 'spki', format: 'pem' },
        });
        app = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: 'test-project',
                clientEmail: 'test@test-project.iam.gserviceaccount.com',
                privateKey,
            }),
        }, TEST_APP_NAME);
        messaging = app.messaging();
    });

    after(async () => {
        // Guarded: if before() threw, there is no app to delete and an
        // unguarded lookup would report a misleading second failure.
        if (app) {
            await app.delete();
        }
    });

    beforeEach(() => {
        resetPushOutbox();
    });

    it('captures a single push instead of putting it on the wire', async () => {
        const messageId = await messaging.send({
            token: 'test-device-token',
            notification: { title: 'New Spots Unlocked', body: 'Tap to explore' },
            data: { type: 'newAreasActivated' },
        });

        expect(pushOutbox).to.have.lengthOf(1);
        expect(pushOutbox[0].token).to.equal('test-device-token');
        expect(pushOutbox[0].title).to.equal('New Spots Unlocked');
        expect(pushOutbox[0].body).to.equal('Tap to explore');
        expect(pushOutbox[0].data).to.deep.equal({ type: 'newAreasActivated' });
        // Callers that log or persist the returned id must not break only
        // under test.
        expect(messageId).to.be.a('string');
    });

    it('captures a batched sendEach rather than letting the fan-out through', async () => {
        const response = await messaging.sendEach([
            { token: 'token-a', notification: { title: 'A', body: 'first' } },
            { token: 'token-b', notification: { title: 'B', body: 'second' } },
        ]);

        expect(pushOutbox).to.have.lengthOf(2);
        expect(pushOutbox.map((push) => push.token)).to.deep.equal(['token-a', 'token-b']);
        expect(response.successCount).to.equal(2);
        expect(response.failureCount).to.equal(0);
    });

    it('captures a multicast fan-out as one entry per token', async () => {
        const response = await messaging.sendEachForMulticast({
            tokens: ['token-a', 'token-b', 'token-c'],
            notification: { title: 'Broadcast', body: 'to everyone' },
        });

        expect(pushOutbox).to.have.lengthOf(3);
        expect(pushOutbox.map((push) => push.token)).to.deep.equal(['token-a', 'token-b', 'token-c']);
        // The shared message body must be recorded against every token, or an
        // assertion on content would pass vacuously.
        expect(pushOutbox.every((push) => push.title === 'Broadcast')).to.equal(true);
        expect(response.successCount).to.equal(3);
    });
});
