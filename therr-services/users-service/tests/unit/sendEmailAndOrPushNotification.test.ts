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
import {
    resolveDeviceTokenForBrand,
    resolveDeviceTokensForBrand,
} from '../../src/utilities/sendEmailAndOrPushNotification';

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

describe('resolveDeviceTokensForBrand (multi-user fan-out)', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('queries userDeviceTokens once with all userIds (no N+1)', async () => {
        const stub = sinon.stub(Store.userDeviceTokens, 'getTokensForUsers').resolves([]);

        await resolveDeviceTokensForBrand('habits', [
            { id: 'user-1', deviceMobileFirebaseToken: 'legacy-1' },
            { id: 'user-2', deviceMobileFirebaseToken: 'legacy-2' },
            { id: 'user-3', deviceMobileFirebaseToken: 'legacy-3' },
        ]);

        // The whole point of the plural variant: a single round-trip for the whole group,
        // not one query per recipient.
        expect(stub.calledOnce).to.equal(true);
        expect(stub.firstCall.args[0]).to.equal('habits');
        expect(stub.firstCall.args[1]).to.deep.equal(['user-1', 'user-2', 'user-3']);
    });

    it('replaces deviceMobileFirebaseToken with brand-scoped token where one exists', async () => {
        sinon.stub(Store.userDeviceTokens, 'getTokensForUsers').resolves([
            { userId: 'user-1', token: 'habits-token-1' },
            { userId: 'user-3', token: 'habits-token-3' },
        ] as any);

        const result = await resolveDeviceTokensForBrand('habits', [
            { id: 'user-1', deviceMobileFirebaseToken: 'legacy-1' },
            { id: 'user-2', deviceMobileFirebaseToken: 'legacy-2' },
            { id: 'user-3', deviceMobileFirebaseToken: 'legacy-3' },
        ]);

        // user-1 and user-3 have re-registered against the new endpoint — their pushes
        // must route via the brand-scoped token. user-2 hasn't yet — keep their legacy
        // token as the fallback so the rollout doesn't silently drop notifications.
        expect(result[0].deviceMobileFirebaseToken).to.equal('habits-token-1');
        expect(result[1].deviceMobileFirebaseToken).to.equal('legacy-2');
        expect(result[2].deviceMobileFirebaseToken).to.equal('habits-token-3');
    });

    it('preserves all other user fields', async () => {
        sinon.stub(Store.userDeviceTokens, 'getTokensForUsers').resolves([
            { userId: 'user-1', token: 'habits-token-1' },
        ] as any);

        const result = await resolveDeviceTokensForBrand('habits', [
            {
                id: 'user-1',
                deviceMobileFirebaseToken: 'legacy-1',
                email: 'a@b.com',
                role: 'admin',
                shouldMuteNotifs: false,
            } as any,
        ]);

        // The fan-out caller passes additional fields (role, shouldMuteNotifs, etc.) that
        // push-notifications-service reads. The token swap must not strip them.
        expect(result[0]).to.deep.include({
            id: 'user-1',
            deviceMobileFirebaseToken: 'habits-token-1',
            email: 'a@b.com',
            role: 'admin',
            shouldMuteNotifs: false,
        });
    });

    it('falls back gracefully when the store query throws', async () => {
        sinon.stub(Store.userDeviceTokens, 'getTokensForUsers').rejects(new Error('db down'));

        const result = await resolveDeviceTokensForBrand('habits', [
            { id: 'user-1', deviceMobileFirebaseToken: 'legacy-1' },
            { id: 'user-2', deviceMobileFirebaseToken: 'legacy-2' },
        ]);

        // A DB blip during a group fan-out must not silently drop the entire push batch
        // for everyone — fall through to legacy tokens so users still get notified.
        expect(result[0].deviceMobileFirebaseToken).to.equal('legacy-1');
        expect(result[1].deviceMobileFirebaseToken).to.equal('legacy-2');
    });

    it('returns input untouched when brand is empty (no query)', async () => {
        const stub = sinon.stub(Store.userDeviceTokens, 'getTokensForUsers');

        const input = [{ id: 'user-1', deviceMobileFirebaseToken: 'legacy-1' }];
        const result = await resolveDeviceTokensForBrand('', input);

        expect(stub.called).to.equal(false);
        expect(result).to.equal(input);
    });

    it('returns empty input untouched (no query)', async () => {
        const stub = sinon.stub(Store.userDeviceTokens, 'getTokensForUsers');

        const result = await resolveDeviceTokensForBrand('habits', []);

        expect(stub.called).to.equal(false);
        expect(result).to.deep.equal([]);
    });

    it('does not cross brands — Habits fan-out cannot pick up Therr-registered tokens', async () => {
        const stub = sinon.stub(Store.userDeviceTokens, 'getTokensForUsers');
        stub.withArgs('habits', sinon.match.array).resolves([]);
        stub.withArgs('therr', sinon.match.array).resolves([
            { userId: 'user-1', token: 'therr-token-1' },
        ] as any);

        const result = await resolveDeviceTokensForBrand('habits', [
            { id: 'user-1', deviceMobileFirebaseToken: null },
        ]);

        // Brand-scoped lookup returned [] for habits — keep the (null) legacy fallback,
        // never reach across into Therr's brand-scoped row.
        expect(result[0].deviceMobileFirebaseToken).to.equal(null);
    });
});
