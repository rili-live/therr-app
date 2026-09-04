/**
 * Brand-scoped push routing — the guard that decides which app a notification lands in.
 *
 * A device token identifies one app *install*. Therr and Friends with Habits ship from a
 * single Firebase project, so FCM accepts either app's token from either brand's service
 * account: a mis-addressed push does not error, it renders in the wrong app under the wrong
 * name. `resolveDeviceTokenForBrand` is the only thing that prevents it.
 *
 * These tests pin the post-backfill contract: the brand-scoped lookup is authoritative and
 * there is NO fallback to the shared `users.deviceMobileFirebaseToken` column. That fallback
 * is what delivered Friends with Habits evening check-ins to users' Therr installs — the
 * brand had no row, so routing reached for the shared column, which belongs to whichever
 * branded app registered last. `20260904000001_main.userDeviceTokens.backfill.js` migrated
 * the population it legitimately served into real rows; resolving to null for everyone else
 * is the point, not a gap.
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

        await resolveDeviceTokenForBrand('habits', 'user-1');

        expect(stub.calledOnce).to.equal(true);
        expect(stub.firstCall.args[0]).to.equal('habits');
        expect(stub.firstCall.args[1]).to.equal('user-1');
    });

    it('returns the brand-scoped token when one exists', async () => {
        sinon.stub(Store.userDeviceTokens, 'getTokensForUser').resolves([
            { token: 'habits-device-token' } as any,
        ]);

        const result = await resolveDeviceTokenForBrand('habits', 'user-1');

        expect(result).to.equal('habits-device-token');
    });

    it('returns null when this brand has no registration — never another brand\'s token', async () => {
        // THE regression under test. A user with a Therr install and no `habits` row must
        // resolve to nothing, so the send is skipped as 'no-device-token'. Returning any
        // token here delivers a Habits notification to the user's Therr app.
        const stub = sinon.stub(Store.userDeviceTokens, 'getTokensForUser');
        stub.withArgs('habits', 'user-1').resolves([]);
        stub.withArgs('therr', 'user-1').resolves([{ token: 'therr-device-token' } as any]);

        const result = await resolveDeviceTokenForBrand('habits', 'user-1');

        expect(result).to.equal(null);
    });

    it('returns null rather than a token when the store query throws', async () => {
        // A read-pool blip must not degrade into "send it somewhere". It is logged at
        // error level so an outage stays distinguishable from users with no device.
        sinon.stub(Store.userDeviceTokens, 'getTokensForUser').rejects(new Error('db down'));

        const result = await resolveDeviceTokenForBrand('habits', 'user-1');

        expect(result).to.equal(null);
    });

    it('returns null without querying when brand is empty', async () => {
        // An absent brand is a caller bug. It used to resolve the shared legacy column,
        // which is exactly how a brandless producer leaked into the Therr app.
        const stub = sinon.stub(Store.userDeviceTokens, 'getTokensForUser');

        const result = await resolveDeviceTokenForBrand('', 'user-1');

        expect(stub.called).to.equal(false);
        expect(result).to.equal(null);
    });

    it('returns null without querying when toUserId is empty', async () => {
        const stub = sinon.stub(Store.userDeviceTokens, 'getTokensForUser');

        const result = await resolveDeviceTokenForBrand('habits', '');

        expect(stub.called).to.equal(false);
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

        expect(stub.calledOnce).to.equal(true);
        expect(stub.firstCall.args[0]).to.equal('habits');
        expect(stub.firstCall.args[1]).to.deep.equal(['user-1', 'user-2', 'user-3']);
    });

    it('replaces the legacy token with the brand-scoped one, and nulls the rest', async () => {
        sinon.stub(Store.userDeviceTokens, 'getTokensForUsers').resolves([
            { userId: 'user-1', token: 'habits-token-1' },
            { userId: 'user-3', token: 'habits-token-3' },
        ] as any);

        const result = await resolveDeviceTokensForBrand('habits', [
            { id: 'user-1', deviceMobileFirebaseToken: 'legacy-1' },
            { id: 'user-2', deviceMobileFirebaseToken: 'legacy-2' },
            { id: 'user-3', deviceMobileFirebaseToken: 'legacy-3' },
        ]);

        // user-2 has no habits registration. Their legacy token belongs to whichever
        // branded app registered last, so it must be dropped, not substituted — the
        // caller filters nulls out of the fan-out.
        expect(result[0].deviceMobileFirebaseToken).to.equal('habits-token-1');
        expect(result[1].deviceMobileFirebaseToken).to.equal(null);
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

    it('drops the batch rather than falling back when the store query throws', async () => {
        sinon.stub(Store.userDeviceTokens, 'getTokensForUsers').rejects(new Error('db down'));

        const result = await resolveDeviceTokensForBrand('habits', [
            { id: 'user-1', deviceMobileFirebaseToken: 'legacy-1' },
            { id: 'user-2', deviceMobileFirebaseToken: 'legacy-2' },
        ]);

        // Delivering a group message to everyone's wrong app is worse than delivering it
        // to no one, and the sender is not waiting on the push.
        expect(result[0].deviceMobileFirebaseToken).to.equal(null);
        expect(result[1].deviceMobileFirebaseToken).to.equal(null);
    });

    it('nulls every token when brand is empty (no query)', async () => {
        const stub = sinon.stub(Store.userDeviceTokens, 'getTokensForUsers');

        const result = await resolveDeviceTokensForBrand('', [
            { id: 'user-1', deviceMobileFirebaseToken: 'legacy-1' },
        ]);

        expect(stub.called).to.equal(false);
        expect(result[0].deviceMobileFirebaseToken).to.equal(null);
    });

    it('returns empty input untouched (no query)', async () => {
        const stub = sinon.stub(Store.userDeviceTokens, 'getTokensForUsers');

        const result = await resolveDeviceTokensForBrand('habits', []);

        expect(stub.called).to.equal(false);
        expect(result).to.deep.equal([]);
    });
});
