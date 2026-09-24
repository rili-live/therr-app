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

            await store.getActiveForReminders('2026-08-26', '2026-08-24', 2000);

            const sql = lastSql(mockConnection);
            // A solo habit exists only in habits.user_habits. Driving this off
            // habits.pacts is exactly the bug the pass exists to fix, and it
            // would still return rows — just never the solo ones.
            expect(sql).to.match(/FROM habits\.user_habits/);
            expect(sql).to.match(/INNER JOIN habits\.habit_goals/);
        });

        it('excludes archived habits', async () => {
            const { store, mockConnection } = buildStore();

            await store.getActiveForReminders('2026-08-26', '2026-08-24', 2000);

            // Archiving is the user's way of saying "I stopped doing this". A
            // reminder for an archived habit is the fastest way to teach someone
            // that the app ignores them.
            expect(lastSql(mockConnection)).to.match(/uh\."status" = 'active'/);
        });

        it("resolves today's completion in the same query rather than per habit", async () => {
            const { store, mockConnection } = buildStore();

            await store.getActiveForReminders('2026-08-26', '2026-08-24', 2000);

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

        it("resolves this week's progress in the same query, so cadence needs no extra round trip", async () => {
            const { store, mockConnection } = buildStore();

            await store.getActiveForReminders('2026-08-26', '2026-08-24', 2000);

            const sql = lastSql(mockConnection);
            // Without the week's tally a weekly cadence has no way to know whether it still
            // owes the user a nudge, which is what forced the old spacing heuristic that
            // reminded a 4x/week habit seven days a week.
            expect(sql).to.match(/completionsEarlierThisWeek/);
            // Strictly before today, matching what isRequiredOn and describeWeekProgress expect.
            expect(sql).to.match(/c2\."scheduledDate" >= '2026-08-24'/);
            expect(sql).to.match(/c2\."scheduledDate" < '2026-08-26'/);
            expect(sql).to.match(/g\."cadenceEffectiveFrom"/);
            // Still one query for the whole run.
            expect(mockConnection.read.query.callCount).to.equal(1);
        });

        it('bounds the run so a growing habit count cannot turn the digest into a long request', async () => {
            const { store, mockConnection } = buildStore();

            await store.getActiveForReminders('2026-08-26', '2026-08-24', 1500);

            const sql = lastSql(mockConnection);
            expect(sql).to.match(/LIMIT 1500/);
            // Deterministic order, so a truncated run covers the same habits
            // twice rather than shuffling who gets reminded.
            expect(sql).to.match(/ORDER BY uh\."startedAt" ASC, uh\."id" ASC/);
        });

        it('reads through the read pool, never the write pool', async () => {
            const { store, mockConnection } = buildStore();

            await store.getActiveForReminders('2026-08-26', '2026-08-24', 2000);

            expect(mockConnection.write.query.callCount).to.equal(0);
        });
    });
});

describe('UserHabitsStore.getDetailByUser — week progress', () => {
    const lastSql = (mockConnection: any) => mockConnection.read.query.lastCall.args[0] as string;

    it('tallies days strictly before today, within the user\'s own week', async () => {
        const { store, mockConnection } = buildStore();

        await store.getDetailByUser('user-1', 'active', { weekStart: '2026-09-14', today: '2026-09-17' });

        const sql = lastSql(mockConnection);
        // Strictly before today, matching what describeWeekProgress expects for
        // `completionsEarlierThisWeek` — the same convention as getActiveForReminders.
        expect(sql).to.match(/c\."scheduledDate" >= '2026-09-14'/);
        expect(sql).to.match(/c\."scheduledDate" < '2026-09-17'/);
        expect(sql).to.match(/COUNT\(DISTINCT c\."scheduledDate"\)/);
        expect(sql).to.match(/AS "completionsEarlierThisWeek"/);
    });

    it('binds positionally in SQL order, not in argument order', async () => {
        // The week tally lives in the SELECT list and so binds BEFORE the WHERE clause's
        // userId and status. Pushing the bindings in argument order instead would silently
        // filter the habits list by a date and scope the tally to a uuid.
        const { store, mockConnection } = buildStore();

        await store.getDetailByUser('user-1', 'archived', { weekStart: '2026-09-14', today: '2026-09-17' });

        const sql = lastSql(mockConnection);
        expect(sql.indexOf("'2026-09-14'")).to.be.lessThan(sql.indexOf("'user-1'"));
        expect(sql.indexOf("'user-1'")).to.be.lessThan(sql.indexOf("'archived'"));
        expect(sql).to.match(/uh\."userId" = 'user-1'/);
        expect(sql).to.match(/uh\."status" = 'archived'/);
    });

    it('emits a NULL tally when no week bounds are supplied', async () => {
        // NULL rather than 0 is the load-bearing part: the caller omits `weekProgress`
        // entirely for a NULL, and a client must read its absence as "unknown". Reporting a
        // confident 0 of 4 to someone who trained four times is worse than reporting nothing.
        const { store, mockConnection } = buildStore();

        await store.getDetailByUser('user-1', 'active');

        const sql = lastSql(mockConnection);
        expect(sql).to.match(/NULL::int AS "completionsEarlierThisWeek"/);
        expect(sql).to.not.match(/COUNT\(DISTINCT c\."scheduledDate"\)/);
        expect(sql).to.match(/uh\."userId" = 'user-1'/);
    });

    it('carries the cadence the caller needs to interpret the tally', async () => {
        const { store, mockConnection } = buildStore();

        await store.getDetailByUser('user-1', 'active', { weekStart: '2026-09-14', today: '2026-09-17' });

        const sql = lastSql(mockConnection);
        expect(sql).to.match(/g\."frequencyType"/);
        expect(sql).to.match(/g\."frequencyCount"/);
        expect(sql).to.match(/g\."targetDaysOfWeek"/);
        expect(sql).to.match(/g\."cadenceEffectiveFrom"/);
    });
});
