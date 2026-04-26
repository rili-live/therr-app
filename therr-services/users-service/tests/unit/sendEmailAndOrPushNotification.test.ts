/**
 * Phase 6 verification scenario 3 (token-routing half).
 *
 * resolveDeviceTokenForBrand is the upstream guard that prevents push routing leaks.
 * It looks up the device token from main.userDeviceTokens filtered by brand. Whatever
 * token it returns is what gets handed to push-notifications-service and ultimately to
 * the brand-keyed Firebase Admin app. If this function regressed and ignored the brand
 * argument, a Habits notification would route through the Therr-registered token (and
 * therefore via the Therr Firebase project) — exactly the leak Phase 2 closed.
 *
 * The legacy fallback to users.deviceMobileFirebaseToken stays in place until mobile
 * clients have re-registered against the new endpoint and shadow logs are clean. These
 * tests pin both the brand-scoped lookup and the fallback shape.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import { resolveDeviceTokenForBrand } from '../../src/utilities/sendEmailAndOrPushNotification';

describe('resolveDeviceTokenForBrand', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('queries userDeviceTokens with the requested brand', async () => {
        const stub = sinon.stub(Store.userDeviceTokens, 'getTokensForUser').resolves([
            { token: 'habits-device-token' } as any,
        ]);

        await resolveDeviceTokenForBrand('habits', 'user-1', 'legacy-therr-token');

        expect(stub.calledOnce).to.equal(true);
        expect(stub.firstCall.args[0]).to.equal('habits');
        expect(stub.firstCall.args[1]).to.equal('user-1');
    });

    it('returns the brand-scoped token when one exists, ignoring the legacy column', async () => {
        sinon.stub(Store.userDeviceTokens, 'getTokensForUser').resolves([
            { token: 'habits-device-token' } as any,
        ]);

        const result = await resolveDeviceTokenForBrand('habits', 'user-1', 'legacy-therr-token');

        // The whole point of Phase 2: when the new table has a row, the legacy column
        // must NOT be used — otherwise a user who registered Therr first would have
        // their Habits notifications routed via the Therr Firebase project.
        expect(result).to.equal('habits-device-token');
    });

    it('falls back to the legacy token only when the new table has no row', async () => {
        sinon.stub(Store.userDeviceTokens, 'getTokensForUser').resolves([]);

        const result = await resolveDeviceTokenForBrand('habits', 'user-1', 'legacy-therr-token');

        expect(result).to.equal('legacy-therr-token');
    });

    it('falls back gracefully when the store query throws', async () => {
        sinon.stub(Store.userDeviceTokens, 'getTokensForUser').rejects(new Error('db down'));

        const result = await resolveDeviceTokenForBrand('habits', 'user-1', 'legacy-therr-token');

        expect(result).to.equal('legacy-therr-token');
    });

    it('returns the legacy token without querying when brand is empty', async () => {
        const stub = sinon.stub(Store.userDeviceTokens, 'getTokensForUser');

        const result = await resolveDeviceTokenForBrand('', 'user-1', 'legacy-therr-token');

        expect(stub.called).to.equal(false);
        expect(result).to.equal('legacy-therr-token');
    });

    it('returns the legacy token without querying when toUserId is empty', async () => {
        const stub = sinon.stub(Store.userDeviceTokens, 'getTokensForUser');

        const result = await resolveDeviceTokenForBrand('habits', '', 'legacy-therr-token');

        expect(stub.called).to.equal(false);
        expect(result).to.equal('legacy-therr-token');
    });

    it('does not cross brands — Habits caller cannot get a Therr-registered token', async () => {
        const stub = sinon.stub(Store.userDeviceTokens, 'getTokensForUser');
        stub.withArgs('habits', 'user-1').resolves([]);
        stub.withArgs('therr', 'user-1').resolves([{ token: 'therr-device-token' } as any]);

        const result = await resolveDeviceTokenForBrand('habits', 'user-1', null);

        // Brand-scoped lookup returned [], so the function falls back to the (null) legacy
        // token — never to the Therr-brand token from a different store row.
        expect(result).to.equal(null);
    });
});
