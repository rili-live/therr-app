import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { closeElapsedLeaderboardPeriod, resetClosedPeriodMemo } from '../../src/handlers/helpers/leaderboardPeriods';

/**
 * `hasResultsForPeriod` cannot distinguish a period closed with no participants from one never
 * closed. The helper is called lazily from every daily-streak summary read, so without a memo
 * a quiet week would re-run the ranking INSERT ... SELECT for every user, on every read, until
 * the next period rolled over.
 */
describe('Leaderboard periods — closeElapsedLeaderboardPeriod memo', () => {
    const brand = BrandVariations.HABITS;
    // A Wednesday; the previous period is the Monday before the current one.
    const now = new Date('2026-09-16T12:00:00.000Z');
    const nextWeek = new Date('2026-09-23T12:00:00.000Z');

    let hasResults: sinon.SinonStub;
    let closePeriod: sinon.SinonStub;

    beforeEach(() => {
        resetClosedPeriodMemo();
        hasResults = sinon.stub(Store.leaderboardPeriodResults, 'hasResultsForPeriod').resolves(false);
        closePeriod = sinon.stub(Store.leaderboardPeriodResults, 'closePeriod').resolves(0);
    });

    afterEach(() => {
        sinon.restore();
        resetClosedPeriodMemo();
    });

    it('does not re-run the close for an empty period on the next read', async () => {
        await closeElapsedLeaderboardPeriod(brand, now);
        await closeElapsedLeaderboardPeriod(brand, now);
        await closeElapsedLeaderboardPeriod(brand, now);

        expect(closePeriod.callCount).to.equal(1);
        expect(hasResults.callCount).to.equal(1);
    });

    it('closes again once the period rolls over', async () => {
        await closeElapsedLeaderboardPeriod(brand, now);
        await closeElapsedLeaderboardPeriod(brand, nextWeek);

        expect(closePeriod.callCount).to.equal(2);
        expect(closePeriod.firstCall.args[1]).to.equal('2026-09-07');
        expect(closePeriod.secondCall.args[1]).to.equal('2026-09-14');
    });

    it('remembers a period the scheduled pass already closed without writing', async () => {
        hasResults.resolves(true);

        await closeElapsedLeaderboardPeriod(brand, now);
        await closeElapsedLeaderboardPeriod(brand, now);

        expect(closePeriod.called).to.equal(false);
        expect(hasResults.callCount).to.equal(1);
    });

    it('keeps the memo per brand', async () => {
        await closeElapsedLeaderboardPeriod(brand, now);
        await closeElapsedLeaderboardPeriod(BrandVariations.THERR, now);

        expect(closePeriod.callCount).to.equal(2);
    });

    it('does not remember a close that threw, so the next read retries', async () => {
        closePeriod.onFirstCall().rejects(new Error('db down'));

        await closeElapsedLeaderboardPeriod(brand, now).catch(() => null);
        await closeElapsedLeaderboardPeriod(brand, now);

        expect(closePeriod.callCount).to.equal(2);
    });
});
