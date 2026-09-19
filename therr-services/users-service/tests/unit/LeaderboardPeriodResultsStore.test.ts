import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import LeaderboardPeriodResultsStore from '../../src/store/LeaderboardPeriodResultsStore';

const buildStore = () => {
    const mockConnection = {
        read: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
        },
        write: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows: [], rowCount: 0 })),
        },
    };

    return { store: new LeaderboardPeriodResultsStore(mockConnection as any), mockConnection };
};

describe('LeaderboardPeriodResultsStore', () => {
    describe('closePeriod', () => {
        // Regression: the INSERT ... SELECT is raw SQL, and both table names are camelCase.
        // Interpolated bare, Postgres folded them to lowercase and every close failed in prod
        // with `relation "main.leaderboardperiodresults" does not exist` (2026-09-19). The
        // query-builder methods in this store never hit it because knex quotes for them.
        it('quotes the camelCase table names in the raw SQL', async () => {
            const { store, mockConnection } = buildStore();

            await store.closePeriod(BrandVariations.HABITS, '2026-09-07');

            const queryString: string = mockConnection.write.query.args[0][0];
            expect(queryString).to.contain('INSERT INTO main."leaderboardPeriodResults"');
            expect(queryString).to.contain('FROM main."userLeaderboardScores" s');
            expect(queryString).to.not.match(/main\.leaderboardPeriodResults\b/);
            expect(queryString).to.not.match(/main\.userLeaderboardScores\b/);
        });
    });
});
