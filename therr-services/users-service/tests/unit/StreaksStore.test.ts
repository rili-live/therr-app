import { expect } from 'chai';
import sinon from 'sinon';
import StreaksStore from '../../src/store/StreaksStore';

const buildStore = () => {
    const mockConnection = {
        read: { query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })) },
        write: { query: sinon.stub().callsFake(() => Promise.resolve({ rows: [{}] })) },
    };

    return { store: new StreaksStore(mockConnection as any), mockConnection };
};

const STREAK_ID = 'streak-1';

/** The params incrementStreak / resetStreak hand to `update`, for a given stored row. */
const updatesFor = async (
    method: 'incrementStreak' | 'resetStreak',
    row: Record<string, any>,
    completionDate = '2026-10-14',
) => {
    const { store } = buildStore();
    sinon.stub(store, 'getById').resolves({ id: STREAK_ID, ...row });
    const update = sinon.stub(store, 'update').resolves({});

    if (method === 'incrementStreak') {
        await store.incrementStreak(STREAK_ID, completionDate);
    } else {
        await store.resetStreak(STREAK_ID);
    }

    return update.firstCall.args[1];
};

describe('StreaksStore', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('incrementStreak', () => {
        it('re-activates a row that an abandoned pact deactivated', async () => {
            // Nothing else ever sets it back, so without this the habit's freezes, its
            // /streaks/active entry and its at-risk warning stayed off for good.
            const updates = await updatesFor('incrementStreak', {
                currentStreak: 4, longestStreak: 9, currentStreakStartDate: '2026-10-10', isActive: false,
            });

            expect(updates.isActive).to.equal(true);
            expect(updates.currentStreak).to.equal(5);
        });

        it('leaves isActive alone on an already-active row', async () => {
            const updates = await updatesFor('incrementStreak', {
                currentStreak: 4, longestStreak: 9, currentStreakStartDate: '2026-10-10', isActive: true,
            });

            expect(updates).to.not.have.property('isActive');
        });

        it('dates a new record from the run that set it, not from the previous record', async () => {
            // The old guard only wrote longestStreakStartDate when it was empty, so once a later
            // run beat an earlier one the record kept the earlier run's start date.
            const updates = await updatesFor('incrementStreak', {
                currentStreak: 5,
                longestStreak: 5,
                currentStreakStartDate: '2026-10-09',
                longestStreakStartDate: '2026-08-01',
                longestStreakEndDate: '2026-08-05',
                isActive: true,
            }, '2026-10-14');

            expect(updates.longestStreak).to.equal(6);
            expect(updates.longestStreakStartDate).to.equal('2026-10-09');
            expect(updates.longestStreakEndDate).to.equal('2026-10-14');
        });

        it('starts a new run on the completion date, ignoring a stale start date', async () => {
            const updates = await updatesFor('incrementStreak', {
                currentStreak: 0,
                longestStreak: 0,
                currentStreakStartDate: '2026-01-01',
                isActive: true,
            }, '2026-10-14');

            expect(updates.currentStreakStartDate).to.equal('2026-10-14');
            expect(updates.longestStreakStartDate).to.equal('2026-10-14');
        });
    });

    describe('resetStreak', () => {
        it('clears the current run\'s start date rather than leaving it on a streak of 0', async () => {
            const updates = await updatesFor('resetStreak', {
                currentStreak: 3, longestStreak: 8, currentStreakStartDate: '2026-10-10', lastCompletedDate: '2026-10-12',
            });

            expect(updates.currentStreak).to.equal(0);
            // `undefined` is dropped by Knex, which is how the old value survived the reset.
            expect(updates.currentStreakStartDate).to.equal(null);
        });

        it('writes a NULL start date into the SQL', async () => {
            const { store, mockConnection } = buildStore();
            sinon.stub(store, 'getById').resolves({ id: STREAK_ID, currentStreak: 3, longestStreak: 8 });

            await store.resetStreak(STREAK_ID);

            expect(mockConnection.write.query.lastCall.args[0]).to.match(/"currentStreakStartDate" = NULL/);
        });
    });
});
