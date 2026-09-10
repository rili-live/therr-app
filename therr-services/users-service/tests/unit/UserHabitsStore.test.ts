import { expect } from 'chai';
import sinon from 'sinon';
import UserHabitsStore from '../../src/store/UserHabitsStore';

const buildStore = () => {
    const mockConnection = {
        read: { query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })) },
        write: { query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })) },
    };

    return { store: new UserHabitsStore(mockConnection as any), mockConnection };
};

describe('UserHabitsStore', () => {
    describe('getActiveForReminders', () => {
        const lastSql = (mockConnection: any) => mockConnection.read.query.lastCall.args[0] as string;

        it('reads the habit registry, not pacts — the whole point of the daily reminder pass', async () => {
            const { store, mockConnection } = buildStore();

            await store.getActiveForReminders('2026-08-26', 2000);

            const sql = lastSql(mockConnection);
            // A solo habit exists only in habits.user_habits. Driving this off
            // habits.pacts is exactly the bug the pass exists to fix, and it
            // would still return rows — just never the solo ones.
            expect(sql).to.match(/FROM habits\.user_habits/);
            expect(sql).to.match(/INNER JOIN habits\.habit_goals/);
        });

        it('excludes archived habits', async () => {
            const { store, mockConnection } = buildStore();

            await store.getActiveForReminders('2026-08-26', 2000);

            // Archiving is the user's way of saying "I stopped doing this". A
            // reminder for an archived habit is the fastest way to teach someone
            // that the app ignores them.
            expect(lastSql(mockConnection)).to.match(/uh\."status" = 'active'/);
        });

        it("resolves today's completion in the same query rather than per habit", async () => {
            const { store, mockConnection } = buildStore();

            await store.getActiveForReminders('2026-08-26', 2000);

            const sql = lastSql(mockConnection);
            expect(sql).to.match(/EXISTS \(/);
            expect(sql).to.match(/habits\.habit_checkins/);
            expect(sql).to.match(/c\."status" = 'completed'/);
            expect(sql).to.contain("'2026-08-26'");
            // One query for the run. A per-habit lookup would turn a background
            // job into thousands of round trips against the read pool — the same
            // reason buildHabitLifecycleContext is a batch pre-pass.
            expect(mockConnection.read.query.callCount).to.equal(1);
        });

        it('bounds the run so a growing habit count cannot turn the digest into a long request', async () => {
            const { store, mockConnection } = buildStore();

            await store.getActiveForReminders('2026-08-26', 1500);

            const sql = lastSql(mockConnection);
            expect(sql).to.match(/LIMIT 1500/);
            // Deterministic order, so a truncated run covers the same habits
            // twice rather than shuffling who gets reminded.
            expect(sql).to.match(/ORDER BY uh\."startedAt" ASC, uh\."id" ASC/);
        });

        it('reads through the read pool, never the write pool', async () => {
            const { store, mockConnection } = buildStore();

            await store.getActiveForReminders('2026-08-26', 2000);

            expect(mockConnection.write.query.callCount).to.equal(0);
        });
    });
});
