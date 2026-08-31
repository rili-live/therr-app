/**
 * `syncDeviceTokenForBrand` is the ONLY path that writes `main.userDeviceTokens`, which is the
 * table push routing reads to decide which app receives a brand's notification. Two regressions
 * it guards against, both of which shipped to production once:
 *
 *   1. Filing every device under the literal platform 'mobile'. The UNIQUE key is
 *      (userId, brandVariation, platform), so a user's iPhone and Android phone collapsed onto
 *      one row and the second registration silently evicted the first.
 *   2. Leaving the superseded legacy row behind once a client reports a real platform, which
 *      makes the push-diagnostics endpoint report a phantom registration.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import syncDeviceTokenForBrand, { normalizePlatform } from '../../src/utilities/syncDeviceTokenForBrand';
import { LEGACY_TOKEN_PLATFORM } from '../../src/store/UserDeviceTokensStore';

const headers = (overrides: { [key: string]: any } = {}) => ({
    'x-brand-variation': 'habits',
    'x-platform': 'android',
    ...overrides,
});

describe('normalizePlatform', () => {
    it('passes through the platform values the migration documents', () => {
        expect(normalizePlatform('ios')).to.equal('ios');
        expect(normalizePlatform('android')).to.equal('android');
        expect(normalizePlatform('web')).to.equal('web');
    });

    it('recognises the literal the web clients actually send', () => {
        // therr-client-web and the dashboard both send 'desktop', not 'web'. Folding it into
        // the legacy bucket would put a browser and a phone on the same row.
        expect(normalizePlatform('desktop')).to.equal('desktop');
    });

    it('is case- and whitespace-insensitive', () => {
        expect(normalizePlatform(' Android ')).to.equal('android');
        expect(normalizePlatform('IOS')).to.equal('ios');
    });

    it('files unrecognised, absent, and legacy values under the legacy platform', () => {
        // The header is untrusted, so anything unknown must fold into one bucket rather than
        // minting a new platform key (and therefore a new UNIQUE slot) per distinct string.
        expect(normalizePlatform('mobile')).to.equal(LEGACY_TOKEN_PLATFORM);
        expect(normalizePlatform(undefined)).to.equal(LEGACY_TOKEN_PLATFORM);
        expect(normalizePlatform('')).to.equal(LEGACY_TOKEN_PLATFORM);
        expect(normalizePlatform('tv')).to.equal(LEGACY_TOKEN_PLATFORM);
        expect(normalizePlatform({ nope: true })).to.equal(LEGACY_TOKEN_PLATFORM);
    });
});

describe('syncDeviceTokenForBrand', () => {
    let upsertStub: sinon.SinonStub;
    let deleteLegacyStub: sinon.SinonStub;

    beforeEach(() => {
        upsertStub = sinon.stub(Store.userDeviceTokens, 'upsertToken').resolves([]);
        deleteLegacyStub = sinon.stub(Store.userDeviceTokens, 'deleteLegacyPlatformRow').resolves(0);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('upserts under the brand and the real platform', async () => {
        await syncDeviceTokenForBrand(headers(), 'user-1', 'habits-android-token');

        expect(upsertStub.calledOnce).to.equal(true);
        expect(upsertStub.firstCall.args).to.deep.equal(['habits', 'user-1', 'android', 'habits-android-token']);
    });

    it('keeps a user\'s two devices on separate rows', async () => {
        await syncDeviceTokenForBrand(headers({ 'x-platform': 'android' }), 'user-1', 'android-token');
        await syncDeviceTokenForBrand(headers({ 'x-platform': 'ios' }), 'user-1', 'ios-token');

        expect(upsertStub.firstCall.args[2]).to.equal('android');
        expect(upsertStub.secondCall.args[2]).to.equal('ios');
        expect(upsertStub.secondCall.args[3]).to.equal('ios-token');
    });

    it('drops the superseded legacy row once a real platform registers', async () => {
        await syncDeviceTokenForBrand(headers(), 'user-1', 'habits-android-token');

        expect(deleteLegacyStub.calledOnce).to.equal(true);
        expect(deleteLegacyStub.firstCall.args).to.deep.equal(['habits', 'user-1']);
    });

    it('does not delete the legacy row when the client still reports the legacy platform', async () => {
        // An install that never updates must keep its registration — deleting here would
        // unsubscribe it from push entirely.
        await syncDeviceTokenForBrand(headers({ 'x-platform': 'mobile' }), 'user-1', 'legacy-token');

        expect(upsertStub.firstCall.args[2]).to.equal(LEGACY_TOKEN_PLATFORM);
        expect(deleteLegacyStub.called).to.equal(false);
    });

    it('is a no-op without a token or a user id', async () => {
        await syncDeviceTokenForBrand(headers(), 'user-1', undefined);
        await syncDeviceTokenForBrand(headers(), undefined, 'some-token');

        expect(upsertStub.called).to.equal(false);
    });

    it('swallows a store failure so the surrounding user update still succeeds', async () => {
        upsertStub.rejects(new Error('connection terminated'));

        // Resolving rather than throwing is the contract: the legacy column write has already
        // happened in the caller and must not be rolled back by a dual-write failure.
        await syncDeviceTokenForBrand(headers(), 'user-1', 'habits-android-token');

        expect(deleteLegacyStub.called).to.equal(false);
    });
});
