import { expect } from 'chai';
import { PushNotifications } from 'therr-js-utilities/constants';
import {
    checkinNudgeDedupeKey,
    createCheckinNudgeAccumulator,
} from '../../src/utilities/checkinNudgeRollup';

/**
 * The digest used to enqueue one "go check in" notification per habit and per
 * pact, all with the same `scheduledFor`. The worker drains a claimed batch
 * inside one tick, so a user tracking three habits across two pacts received up
 * to five near-identical pushes in the same second and then hit the 5/day cap,
 * silently dropping anything timely for the rest of the day.
 *
 * These pin the collapse itself: one row per user, the strongest framing kept,
 * and — the part that is easy to lose in a refactor — a check-in target
 * attached only when there is exactly one habit to check into.
 */
describe('check-in nudge roll-up', () => {
    const USER_A = 'user-a';
    const USER_B = 'user-b';

    it('collapses a user\'s whole day into one row', () => {
        const acc = createCheckinNudgeAccumulator();
        acc.add(USER_A, { habitGoalId: 'g1', habitName: 'Reading' });
        acc.add(USER_A, { habitGoalId: 'g2', habitName: 'Gym' });
        acc.add(USER_A, { habitGoalId: 'g3', habitName: 'Journaling' });

        const rows = acc.drain();

        expect(rows).to.have.length(1);
        expect(rows[0].userId).to.equal(USER_A);
        expect(rows[0].payload.habitCount).to.equal(3);
        expect(rows[0].payload.habitNames).to.deep.equal(['Reading', 'Gym', 'Journaling']);
        expect(acc.candidateCount()).to.equal(3);
    });

    it('keeps users separate', () => {
        const acc = createCheckinNudgeAccumulator();
        acc.add(USER_A, { habitGoalId: 'g1', habitName: 'Reading' });
        acc.add(USER_B, { habitGoalId: 'g1', habitName: 'Reading' });

        expect(acc.drain()).to.have.length(2);
    });

    it('counts a habit reached twice only once — the double-send this replaces', () => {
        // A habit held through two pacts hit both the pact-keyed and the
        // habit-keyed path, and deduped against neither because the two keys
        // named different things. Here both feed the same habit-goal key.
        const acc = createCheckinNudgeAccumulator();
        acc.add(USER_A, {
            habitGoalId: 'g1', habitName: 'Reading', pactId: 'pact-1', streakCount: 5,
        });
        acc.add(USER_A, {
            habitGoalId: 'g1', habitName: 'Reading', pactId: 'pact-2', streakCount: 5,
        });

        const rows = acc.drain();
        expect(rows).to.have.length(1);
        expect(rows[0].payload.habitCount).to.equal(1);
        // First write wins, and the pact loop runs first — so the row keeps the
        // pact id the deep link wants.
        expect(rows[0].payload.pactId).to.equal('pact-1');
    });

    describe('framing', () => {
        it('uses the streak warning when any habit has a live streak', () => {
            const acc = createCheckinNudgeAccumulator();
            acc.add(USER_A, { habitGoalId: 'g1', habitName: 'Reading', streakCount: 0 });
            acc.add(USER_A, { habitGoalId: 'g2', habitName: 'Gym', streakCount: 12 });

            const [row] = acc.drain();

            expect(row.type).to.equal(PushNotifications.Types.streakAtRisk);
            // The longest streak leads: it is the loss the user will actually feel.
            expect(row.payload.streakCount).to.equal(12);
            expect(row.payload.habitName).to.equal('Gym');
            expect(row.payload.habitNames[0]).to.equal('Gym');
        });

        it('falls back to the plain reminder when nothing is at stake', () => {
            const acc = createCheckinNudgeAccumulator();
            acc.add(USER_A, { habitGoalId: 'g1', habitName: 'Reading', streakCount: 0 });
            acc.add(USER_A, { habitGoalId: 'g2', habitName: 'Gym' });

            const [row] = acc.drain();

            expect(row.type).to.equal(PushNotifications.Types.dailyHabitReminder);
            expect(row.payload.streakCount).to.equal(0);
        });

        it('preserves digest order when streaks tie', () => {
            const acc = createCheckinNudgeAccumulator();
            acc.add(USER_A, { habitGoalId: 'g1', habitName: 'Reading', streakCount: 4 });
            acc.add(USER_A, { habitGoalId: 'g2', habitName: 'Gym', streakCount: 4 });

            expect(acc.drain()[0].payload.habitName).to.equal('Reading');
        });
    });

    describe('check-in target', () => {
        it('carries the habit goal and freeze count for a single habit', () => {
            const acc = createCheckinNudgeAccumulator();
            acc.add(USER_A, {
                habitGoalId: 'g1',
                habitName: 'Reading',
                pactId: 'pact-1',
                streakCount: 9,
                freezesRemaining: 2,
            });

            const [row] = acc.drain();

            expect(row.payload.habitGoalId).to.equal('g1');
            expect(row.payload.pactId).to.equal('pact-1');
            expect(row.payload.freezesRemaining).to.equal(2);
        });

        it('withholds all three once the nudge covers several habits', () => {
            // "Check In" would have nothing unambiguous to complete, the deep
            // link would open an arbitrary one of them, and a per-habit freeze
            // count would promise a net over habits it does not cover.
            const acc = createCheckinNudgeAccumulator();
            acc.add(USER_A, {
                habitGoalId: 'g1', habitName: 'Reading', pactId: 'pact-1', freezesRemaining: 2,
            });
            acc.add(USER_A, { habitGoalId: 'g2', habitName: 'Gym', freezesRemaining: 1 });

            const [row] = acc.drain();

            expect(row.payload.habitGoalId).to.equal(undefined);
            expect(row.payload.pactId).to.equal(undefined);
            expect(row.payload.freezesRemaining).to.equal(undefined);
        });
    });

    it('ignores entries with nothing to address', () => {
        const acc = createCheckinNudgeAccumulator();
        acc.add('', { habitGoalId: 'g1', habitName: 'Reading' });
        acc.add(USER_A, { habitGoalId: '', habitName: 'Reading' });

        expect(acc.drain()).to.have.length(0);
        expect(acc.candidateCount()).to.equal(0);
    });

    it('writes a key stamped with the day and nothing time-varying', () => {
        // A key holding a clock reading is unique on every run, which turns
        // dedup off without failing anything else.
        expect(checkinNudgeDedupeKey('2026-08-30')).to.equal('checkin-nudge:2026-08-30');
        expect(checkinNudgeDedupeKey('2026-08-30')).to.equal(checkinNudgeDedupeKey('2026-08-30'));
    });
});
