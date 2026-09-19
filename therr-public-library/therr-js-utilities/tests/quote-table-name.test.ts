import { expect } from 'chai';
import { quoteTableName } from '../src/db';

describe('quoteTableName', () => {
    it('quotes the table part of a schema-qualified name', () => {
        expect(quoteTableName('main.leaderboardPeriodResults')).to.equal('main."leaderboardPeriodResults"');
    });

    it('is a harmless no-op in effect on snake_case names', () => {
        expect(quoteTableName('habits.habit_checkins')).to.equal('habits."habit_checkins"');
    });

    it('leaves an already-quoted name alone', () => {
        expect(quoteTableName('main."leaderboardPeriodResults"')).to.equal('main."leaderboardPeriodResults"');
    });

    it('quotes an unqualified name', () => {
        expect(quoteTableName('leaderboardPeriodResults')).to.equal('"leaderboardPeriodResults"');
        expect(quoteTableName('"leaderboardPeriodResults"')).to.equal('"leaderboardPeriodResults"');
    });
});
