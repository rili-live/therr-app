import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { getPushDiagnostics, sendTestPushNotification } from '../../../src/handlers/diagnostics';
import { pushOutbox } from '../../helpers/outboundStubs';

/**
 * The diagnostics endpoints exist to make push delivery observable, so the
 * property under test is not "does it return 200" but "does it report the
 * fields that distinguish the failure modes from each other".
 *
 * Each assertion below corresponds to a question that was unanswerable in
 * production before these endpoints existed.
 */

const buildRes = () => {
    const res: any = {};
    res.status = sinon.stub().returns(res);
    res.send = sinon.stub().returns(res);
    return res;
};

const buildReq = (overrides: any = {}) => ({
    headers: {
        'x-brand-variation': BrandVariations.HABITS,
        'x-localecode': 'en-us',
        ...(overrides.headers || {}),
    },
    body: overrides.body || {},
    query: overrides.query || {},
});

describe('push diagnostics handlers', () => {
    describe('getPushDiagnostics', () => {
        it('reports the apns topic each brand would be addressed to', () => {
            const req: any = buildReq();
            const res = buildRes();

            getPushDiagnostics(req, res, () => undefined);

            expect(res.status.firstCall.args[0]).to.equal(200);
            const payload = res.send.firstCall.args[0];

            const habits = payload.byBrand.find((b: any) => b.brandVariation === BrandVariations.HABITS);
            expect(habits.iosApnsTopic).to.equal('com.therr.mobile.Therr');
        });

        it('reports whether a brand rides the Therr Firebase app rather than its own', () => {
            // The test env sets only PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64, so every
            // non-THERR brand falls back — which is exactly the shared-project configuration
            // production runs. The point is that the report says so out loud instead of
            // leaving it to be inferred from an absent log line.
            const req: any = buildReq();
            const res = buildRes();

            getPushDiagnostics(req, res, () => undefined);
            const payload = res.send.firstCall.args[0];

            const habits = payload.byBrand.find((b: any) => b.brandVariation === BrandVariations.HABITS);
            expect(habits.isFallbackToTherr).to.equal(true);
            expect(habits.credentialEnvKey).to.equal('PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64_HABITS');
            expect(habits.isCredentialEnvKeySet).to.equal(false);
        });

        it('collapses brands onto the set of Firebase projects actually in use', () => {
            const req: any = buildReq();
            const res = buildRes();

            getPushDiagnostics(req, res, () => undefined);
            const payload = res.send.firstCall.args[0];

            // One shared project is the supported setup; the field exists so an
            // unintended split (or an unintended merge) is visible at a glance.
            expect(payload.distinctFirebaseProjects).to.have.lengthOf(1);
        });

        it('never returns credential material', () => {
            const req: any = buildReq();
            const res = buildRes();

            getPushDiagnostics(req, res, () => undefined);
            const serialized = JSON.stringify(res.send.firstCall.args[0]);

            expect(serialized).to.not.have.string('PRIVATE KEY');
            expect(serialized).to.not.have.string('private_key');
            // Client email is masked, not omitted — it identifies a service account
            // without being usable.
            expect(serialized).to.not.have.string('@therr-app.iam.gserviceaccount.com');
        });

        it('masks the project label out of the service account address', () => {
            // Asserted against the fixture credentials rather than only against the
            // real project's domain, so the guarantee holds on a machine with no
            // secrets on disk too. A service account address is
            // `<name>@<project-id>.iam.gserviceaccount.com`; echoing the domain
            // verbatim would reproduce a complete, real-looking address in a
            // response whose whole contract is that it never returns credentials.
            const req: any = buildReq();
            const res = buildRes();

            getPushDiagnostics(req, res, () => undefined);
            const payload = res.send.firstCall.args[0];
            const emails = payload.byBrand.map((b: any) => b.firebaseClientEmail);

            emails.forEach((email: string) => {
                expect(email).to.not.have.string('test-project.iam');
                expect(email).to.have.string('.iam.gserviceaccount.com');
                // Still enough to tell two service accounts apart in a report.
                expect(email.split('@')[0]).to.have.string('***');
            });
        });
    });

    describe('sendTestPushNotification', () => {
        it('rejects a request with no device token rather than sending into the void', () => {
            const req: any = buildReq({ body: {} });
            const res = buildRes();

            sendTestPushNotification(req, res, () => undefined);

            expect(res.status.firstCall.args[0]).to.equal(400);
        });

        it('rejects a type that createMessage does not handle', async () => {
            const req: any = buildReq({
                body: { deviceToken: 'token-abc', type: 'not-a-real-type' },
            });
            const res = buildRes();

            await sendTestPushNotification(req, res, () => undefined);

            expect(res.status.firstCall.args[0]).to.equal(400);
            // A type with no case returns false from createMessage and is silently
            // dropped in production. Saying so is the whole point.
            expect(res.send.firstCall.args[0].message).to.have.string('no case in createMessage');
        });

        it('echoes the apns topic the message was actually addressed to', async () => {
            const req: any = buildReq({
                body: {
                    deviceToken: 'token-abc',
                    type: PushNotifications.Types.pactInvitation,
                    dryRun: true,
                },
            });
            const res = buildRes();

            await sendTestPushNotification(req, res, () => undefined);

            const payload = res.send.firstCall.args[0];
            expect(payload.envelope.apns.headers['apns-topic']).to.equal('com.therr.mobile.Therr');
            expect(payload.routing.iosApnsTopic).to.equal('com.therr.mobile.Therr');
        });

        it('does not echo the device token back in the envelope', async () => {
            const req: any = buildReq({
                body: { deviceToken: 'super-secret-token', type: PushNotifications.Types.pactInvitation },
            });
            const res = buildRes();

            await sendTestPushNotification(req, res, () => undefined);

            const payload = res.send.firstCall.args[0];
            expect(JSON.stringify(payload.envelope)).to.not.have.string('super-secret-token');
        });

        it('surfaces the FCM result instead of swallowing it', async () => {
            const req: any = buildReq({
                body: { deviceToken: 'token-abc', type: PushNotifications.Types.pactInvitation },
            });
            const res = buildRes();

            await sendTestPushNotification(req, res, () => undefined);

            const payload = res.send.firstCall.args[0];
            expect(payload.result.ok).to.equal(true);
            expect(payload.result.messageId).to.be.a('string');
            // predictAndSendNotification catches everything by design; this path must not.
            expect(pushOutbox.map((p) => p.token)).to.include('token-abc');
        });

        it('reports an FCM failure as a non-2xx with the raw error code', async () => {
            const sendStub = sinon.stub().rejects(
                Object.assign(new Error('Requested entity was not found.'), {
                    code: 'messaging/registration-token-not-registered',
                }),
            );
            // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
            const { Messaging } = require('firebase-admin/messaging');
            const original = Messaging.prototype.send;
            Messaging.prototype.send = sendStub;

            try {
                const req: any = buildReq({
                    body: { deviceToken: 'stale-token', type: PushNotifications.Types.pactInvitation },
                });
                const res = buildRes();

                await sendTestPushNotification(req, res, () => undefined);

                expect(res.status.firstCall.args[0]).to.equal(502);
                const payload = res.send.firstCall.args[0];
                expect(payload.result.ok).to.equal(false);
                // This exact code is the difference between "the user reinstalled and the
                // token is stale" and "the credentials address the wrong Firebase project".
                expect(payload.result.errorCode).to.equal('messaging/registration-token-not-registered');
            } finally {
                Messaging.prototype.send = original;
            }
        });
    });
});
