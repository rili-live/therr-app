/* eslint-disable quotes */
import { expect } from 'chai';
import sinon from 'sinon';
import HabitCheckinsStore from '../../src/store/HabitCheckinsStore';

/**
 * A habit day is the checking-in user's own calendar day (see `resolveCheckinHabitDate`).
 *
 * That makes "who has checked in today?" a per-user question the moment two people are in
 * different zones — which is every pact with a long-distance partner, and every pact at all
 * for the hours between one member's midnight and another's. Asking it with a single date
 * showed a partner in Chicago as not-yet-checked-in for the five hours after their local
 * evening crossed UTC midnight: the read-side twin of the bug the write path fixes.
 */

const buildStore = (rows: any[] = []) => {
    const mockConnection = {
        read: { query: sinon.stub().callsFake(() => Promise.resolve({ rows })) },
        write: { query: sinon.stub().callsFake(() => Promise.resolve({ rows })) },
    };

    return { store: new HabitCheckinsStore(mockConnection as any), mockConnection };
};

describe('HabitCheckinsStore.getCompletedOnDateForPairs — per-user habit day', () => {
    it('asks each pair for its own date', async () => {
        const { store, mockConnection } = buildStore();

        await store.getCompletedOnDateForPairs(
            [
                { userId: 'user-chicago', habitGoalId: 'goal-1', date: '2026-09-15' },
                { userId: 'user-tokyo', habitGoalId: 'goal-1', date: '2026-09-16' },
            ],
            '2026-09-15',
        );

        const queryString = mockConnection.read.query.args[0][0];
        expect(queryString).to.contain(`'user-chicago'::uuid, 'goal-1'::uuid, '2026-09-15'::date`);
        expect(queryString).to.contain(`'user-tokyo'::uuid, 'goal-1'::uuid, '2026-09-16'::date`);
        // The date is joined from the VALUES row, not pinned once for the whole batch.
        expect(queryString).to.contain('c."scheduledDate" = p."onDate"');
    });

    it('falls back to the default date for a pair that carries none', async () => {
        const { store, mockConnection } = buildStore();

        await store.getCompletedOnDateForPairs(
            [{ userId: 'user-1', habitGoalId: 'goal-1' }],
            '2026-09-15',
        );

        expect(mockConnection.read.query.args[0][0]).to.contain(
            `'user-1'::uuid, 'goal-1'::uuid, '2026-09-15'::date`,
        );
    });

    it('still short-circuits on an empty batch rather than emitting an empty VALUES list', async () => {
        const { store, mockConnection } = buildStore();

        const result = await store.getCompletedOnDateForPairs([], '2026-09-15');

        expect(result.size).to.equal(0);
        expect(mockConnection.read.query.callCount).to.equal(0);
    });

    it('keys the result by userId:habitGoalId', async () => {
        const { store } = buildStore([{ userId: 'user-1', habitGoalId: 'goal-1' }]);

        const result = await store.getCompletedOnDateForPairs(
            [{ userId: 'user-1', habitGoalId: 'goal-1', date: '2026-09-15' }],
            '2026-09-15',
        );

        expect([...result]).to.deep.equal(['user-1:goal-1']);
    });
});
