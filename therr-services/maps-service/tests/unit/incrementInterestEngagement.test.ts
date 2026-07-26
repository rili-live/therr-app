/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import * as internalRest from 'therr-js-utilities/internal-rest-request';
import incrementInterestEngagement, { flushInterestEngagement } from '../../src/utilities/incrementInterestEngagement';

describe('incrementInterestEngagement (coalescing buffer)', () => {
    let requestStub: sinon.SinonStub;

    // The flush target URL is read from global-config by NODE_ENV at flush time.
    before(() => {
        process.env.NODE_ENV = process.env.NODE_ENV || 'development';
    });

    const headersFor = (userId: string) => ({
        'x-userid': userId,
        'x-localecode': 'en-us',
        'x-platform': 'mobile',
        'x-brand-variation': 'therr',
    }) as any;

    beforeEach(() => {
        requestStub = sinon.stub(internalRest, 'internalRestRequest').resolves({ data: {} } as any);
    });

    afterEach(async () => {
        // Drain so buffered state can't leak between tests.
        await flushInterestEngagement();
        sinon.restore();
    });

    it('does not issue a request per content view', async () => {
        incrementInterestEngagement(['interests.foodDrink.coffee'], 2, headersFor('user-1'));
        incrementInterestEngagement(['interests.foodDrink.coffee'], 2, headersFor('user-1'));
        incrementInterestEngagement(['interests.sports.soccer'], 3, headersFor('user-1'));

        // Nothing has gone out yet — the whole point is that views accumulate.
        expect(requestStub.called).to.be.eq(false);

        await flushInterestEngagement();

        expect(requestStub.callCount).to.eq(1);
    });

    it('sums repeat engagement on the same interest', async () => {
        incrementInterestEngagement(['interests.foodDrink.coffee'], 2, headersFor('user-1'));
        incrementInterestEngagement(['interests.foodDrink.coffee'], 3, headersFor('user-1'));

        await flushInterestEngagement();

        const { data } = requestStub.args[0][1];
        expect(data.interestIncrements).to.deep.equal({ 'interests.foodDrink.coffee': 5 });
    });

    it('keeps each user in their own request', async () => {
        incrementInterestEngagement(['interests.foodDrink.coffee'], 2, headersFor('user-1'));
        incrementInterestEngagement(['interests.sports.soccer'], 2, headersFor('user-2'));

        await flushInterestEngagement();

        expect(requestStub.callCount).to.eq(2);
    });

    // A rolling deploy can leave an older users-service pod receiving this request, so the
    // one-event-at-a-time shape rides along and still records something sensible.
    it('sends the legacy payload shape alongside the coalesced one', async () => {
        incrementInterestEngagement(['interests.foodDrink.coffee', 'interests.sports.soccer'], 2, headersFor('user-1'));

        await flushInterestEngagement();

        const { data } = requestStub.args[0][1];
        expect(data.interestDisplayNameKeys).to.have.members(['interests.foodDrink.coffee', 'interests.sports.soccer']);
        expect(data.incrBy).to.eq(2);
    });

    it('caps a single event contribution', async () => {
        incrementInterestEngagement(['interests.foodDrink.coffee'], 5000, headersFor('user-1'));

        await flushInterestEngagement();

        const { data } = requestStub.args[0][1];
        expect(data.interestIncrements['interests.foodDrink.coffee']).to.eq(5);
    });

    it('ignores events with no interests or no user', async () => {
        incrementInterestEngagement([], 2, headersFor('user-1'));
        incrementInterestEngagement(['interests.foodDrink.coffee'], 2, { 'x-localecode': 'en-us' } as any);

        await flushInterestEngagement();

        expect(requestStub.called).to.be.eq(false);
    });

    // Blank keys are skipped individually, so an event made up entirely of them buffers an
    // empty map. Flushing that sends a legacy `incrBy` of `Math.max()` over nothing —
    // -Infinity, which JSON-serializes to null — for no increments at all.
    it('ignores an event whose interest keys are all blank', async () => {
        incrementInterestEngagement(['', ''], 2, headersFor('user-1'));

        await flushInterestEngagement();

        expect(requestStub.called).to.be.eq(false);
    });

    it('flushing twice does not resend the same increments', async () => {
        incrementInterestEngagement(['interests.foodDrink.coffee'], 2, headersFor('user-1'));

        await flushInterestEngagement();
        await flushInterestEngagement();

        expect(requestStub.callCount).to.eq(1);
    });

    // A failed flush must not take down the request that triggered it — these call sites
    // were fire-and-forget before, and engagement counts are best-effort.
    it('swallows a failed flush', async () => {
        requestStub.rejects(new Error('users-service unreachable'));
        incrementInterestEngagement(['interests.foodDrink.coffee'], 2, headersFor('user-1'));

        await flushInterestEngagement();

        expect(requestStub.callCount).to.eq(1);
    });
});
