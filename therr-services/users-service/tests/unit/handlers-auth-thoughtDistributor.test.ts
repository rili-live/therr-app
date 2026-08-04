/* eslint-disable quotes */
/**
 * When login seeds a user's content stream, and under whose identity.
 *
 * Two things are being pinned here, both of which were wrong:
 *
 *  1. The trigger used to sit on the bare username/email/phone lookup, ahead of
 *     `validateCredentials` — so it fired on failed attempts, and submitting a known email
 *     was enough to make the server do stream-activation work for that account.
 *  2. It passed `req.headers` through unchanged. Login is an unauthenticated route, so the
 *     gateway leaves `x-userid` empty; `internalRestRequest` forwards it verbatim and
 *     reactions-service rejects the batch with a 401 that `createReactions` swallows. The
 *     seed silently never happened, and that same header is what the distributor resolves the
 *     user's content algorithm from.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { AccessLevels } from 'therr-js-utilities/constants';
import { login } from '../../src/handlers/auth';
import Store from '../../src/store';
import TherrEventEmitter from '../../src/api/TherrEventEmitter';
import * as userHelpers from '../../src/utilities/userHelpers';
import * as authUserHelpers from '../../src/handlers/helpers/user';
import * as inviteAcceptance from '../../src/handlers/helpers/inviteAcceptance';
import * as recordFunnelMetricModule from '../../src/utilities/recordFunnelMetric';

const VERIFIED_USER = {
    id: 'user-abc',
    email: 'test@test.com',
    userName: 'test@test.com',
    accessLevels: [AccessLevels.EMAIL_VERIFIED],
    loginCount: 4,
    integrationsAccess: undefined,
};

/** Lets the setImmediate the distributor is deferred behind actually run. */
const flush = () => new Promise((resolve) => { setImmediate(resolve); });

describe('login — thought distributor trigger', () => {
    let distributorStub: sinon.SinonStub;
    let validateCredentialsStub: sinon.SinonStub;
    let res: any;

    const buildReq = () => ({
        // What the gateway actually sends for an unauthenticated login: the header exists but
        // is empty, because `authenticateOptional` had no token to decode.
        headers: {
            'x-userid': '',
            'x-localecode': 'en-us',
            'x-brand-variation': 'therr',
        },
        body: {
            userName: 'test@test.com',
            password: 'hunter2',
            isSSO: false,
        },
    });

    beforeEach(() => {
        res = {
            status: sinon.stub().returnsThis(),
            send: sinon.stub().returnsThis(),
        };

        distributorStub = sinon.stub(TherrEventEmitter, 'runThoughtDistributorAlgorithm').resolves({});
        sinon.stub(Store.users, 'getUserByConditions').resolves([VERIFIED_USER]);
        validateCredentialsStub = sinon.stub(authUserHelpers, 'validateCredentials');

        // Everything below is issueUserSession's surrounding machinery — stubbed only so the
        // success path can be reached without a DB or a token secret.
        sinon.stub(Store.userOrganizations, 'get').resolves([] as any);
        sinon.stub(Store.users, 'updateUser').resolves([{ ...VERIFIED_USER }]);
        sinon.stub(Store.users, 'upsertBrandVariation').resolves([] as any);
        sinon.stub(userHelpers, 'createUserToken').returns('id-token' as any);
        sinon.stub(userHelpers, 'createRefreshToken').returns({ token: 'refresh-token' } as any);
        sinon.stub(inviteAcceptance, 'acceptInvitesOnFirstLogin').resolves();
        sinon.stub(recordFunnelMetricModule, 'default').resolves();
    });

    afterEach(() => {
        sinon.restore();
    });

    it('does not seed a stream when the credentials are wrong', async () => {
        validateCredentialsStub.resolves([false, undefined, undefined]);

        await login(buildReq() as any, res, (() => undefined) as any);
        await flush();

        expect(distributorStub.called).to.be.eq(false);
    });

    it('seeds the stream once the credentials check out', async () => {
        validateCredentialsStub.resolves([true, { ...VERIFIED_USER }, undefined]);

        await login(buildReq() as any, res, (() => undefined) as any);
        await flush();

        expect(distributorStub.calledOnce).to.be.eq(true);
    });

    // The header is the identity reactions-service writes the rows under, and what the
    // distributor resolves the content algorithm from. An empty one 401s the whole batch.
    it('names the authenticated user in x-userid rather than forwarding the empty header', async () => {
        validateCredentialsStub.resolves([true, { ...VERIFIED_USER }, undefined]);

        await login(buildReq() as any, res, (() => undefined) as any);
        await flush();

        const [headers, contextUserIds] = distributorStub.args[0];
        expect(headers['x-userid']).to.equal('user-abc');
        expect(contextUserIds).to.deep.equal(['user-abc']);
    });

    it('keeps the rest of the request headers, so brand and locale still resolve', async () => {
        validateCredentialsStub.resolves([true, { ...VERIFIED_USER }, undefined]);

        await login(buildReq() as any, res, (() => undefined) as any);
        await flush();

        const [headers] = distributorStub.args[0];
        expect(headers['x-brand-variation']).to.equal('therr');
        expect(headers['x-localecode']).to.equal('en-us');
    });

    // Login is deliberately ungated (the notifications-poll caller passes
    // minSecondsBetweenRuns) so a fresh session always re-seeds.
    it('leaves the run ungated so a fresh session always re-seeds', async () => {
        validateCredentialsStub.resolves([true, { ...VERIFIED_USER }, undefined]);

        await login(buildReq() as any, res, (() => undefined) as any);
        await flush();

        const minSecondsBetweenRuns = distributorStub.args[0][4];
        expect(minSecondsBetweenRuns === undefined || minSecondsBetweenRuns === 0).to.be.eq(true);
    });
});
