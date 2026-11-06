import { expect } from 'chai';
import {
    buildMonthDays,
    countFrozenDays,
    getDaysInMonth,
    getMonthBounds,
    getPreviousMonth,
    resolveRequestedMonth,
    summarizeFreezes,
} from '../../src/utilities/streakCalendar';

/**
 * The month calendar behind GET /habits/daily-streak/me/calendar (the Friends with Habits streak
 * detail screen). The rule that matters most: a past day with no ledger row is `none`, never
 * `missed` — the month can reach back before the user's first check-in.
 */
describe('Streak calendar', () => {
    describe('resolveRequestedMonth', () => {
        const today = '2026-11-06';

        it('passes a valid past or current month through', () => {
            expect(resolveRequestedMonth('2026-10', today)).to.equal('2026-10');
            expect(resolveRequestedMonth('2026-11', today)).to.equal('2026-11');
            expect(resolveRequestedMonth('2025-01', today)).to.equal('2025-01');
        });

        it('resolves junk, missing and future months to the current month', () => {
            expect(resolveRequestedMonth(undefined, today)).to.equal('2026-11');
            expect(resolveRequestedMonth('2026-13', today)).to.equal('2026-11');
            expect(resolveRequestedMonth('2026-1', today)).to.equal('2026-11');
            expect(resolveRequestedMonth(['2026-10'], today)).to.equal('2026-11');
            expect(resolveRequestedMonth('2026-12', today)).to.equal('2026-11');
        });
    });

    describe('month math', () => {
        it('knows month lengths, including leap February', () => {
            expect(getDaysInMonth('2026-11')).to.equal(30);
            expect(getDaysInMonth('2026-12')).to.equal(31);
            expect(getDaysInMonth('2026-02')).to.equal(28);
            expect(getDaysInMonth('2028-02')).to.equal(29);
        });

        it('returns inclusive bounds', () => {
            expect(getMonthBounds('2026-11')).to.deep.equal({ start: '2026-11-01', end: '2026-11-30' });
        });

        it('steps back across a year boundary', () => {
            expect(getPreviousMonth('2026-11')).to.equal('2026-10');
            expect(getPreviousMonth('2027-01')).to.equal('2026-12');
        });
    });

    describe('buildMonthDays', () => {
        const rows = [
            { localDate: '2026-11-01', status: 'upheld' as const },
            { localDate: '2026-11-02', status: 'frozen' as const },
            { localDate: '2026-11-03', status: 'upheld' as const },
            { localDate: '2026-11-04', status: 'rest' as const },
            { localDate: '2026-11-05', status: 'missed' as const },
        ];

        it('maps ledger rows, today and the future', () => {
            const days = buildMonthDays('2026-11', '2026-11-06', rows);
            expect(days).to.have.length(30);
            expect(days.slice(0, 7).map((day) => day.status)).to.deep.equal([
                'upheld', 'frozen', 'upheld', 'rest', 'missed', 'pending', 'future',
            ]);
            expect(days[5].isToday).to.equal(true);
            expect(days.filter((day) => day.isToday)).to.have.length(1);
        });

        it('reads an upheld today from the ledger', () => {
            const days = buildMonthDays('2026-11', '2026-11-06', [...rows, { localDate: '2026-11-06', status: 'upheld' }]);
            expect(days[5].status).to.equal('upheld');
        });

        it('marks a past day without a ledger row as none, not missed', () => {
            const days = buildMonthDays('2026-10', '2026-11-06', [{ localDate: '2026-10-30', status: 'upheld' }]);
            expect(days[0].status).to.equal('none');
            expect(days[29].status).to.equal('upheld');
            expect(days.some((day) => day.status === 'missed' || day.status === 'pending')).to.equal(false);
        });

        it('counts frozen days', () => {
            expect(countFrozenDays(buildMonthDays('2026-11', '2026-11-06', rows))).to.equal(1);
        });
    });

    describe('summarizeFreezes', () => {
        it('sums active habits, ignores inactive ones and habits that never earned a freeze', () => {
            const result = summarizeFreezes([
                {
                    habitGoalId: 'a', gracePeriodDays: 3, graceDaysUsed: 1, isActive: true,
                },
                {
                    habitGoalId: 'b', gracePeriodDays: '1', graceDaysUsed: '1',
                },
                {
                    habitGoalId: 'c', gracePeriodDays: 2, graceDaysUsed: 0, isActive: false,
                },
                {
                    habitGoalId: 'd', gracePeriodDays: 0, graceDaysUsed: 0, isActive: true,
                },
            ]);
            expect(result).to.deep.equal({
                remaining: 2,
                total: 4,
                habits: [
                    { habitGoalId: 'a', remaining: 2, total: 3 },
                    { habitGoalId: 'b', remaining: 0, total: 1 },
                ],
            });
        });

        it('never reports negative remaining', () => {
            const result = summarizeFreezes([{ habitGoalId: 'a', gracePeriodDays: 1, graceDaysUsed: 2 }]);
            expect(result.remaining).to.equal(0);
        });

        it('handles no streaks', () => {
            expect(summarizeFreezes([])).to.deep.equal({ remaining: 0, total: 0, habits: [] });
        });
    });
});
