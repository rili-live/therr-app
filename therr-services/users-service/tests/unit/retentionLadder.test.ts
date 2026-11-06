import { expect } from 'chai';
import {
    classifyRetention,
    comebackMessageKey,
    getComebackLadderDays,
    getDueComebackRung,
    getLapseBackoffDays,
    isBackedOff,
    isLadderExhausted,
} from '../../src/utilities/retentionLadder';

/**
 * The lapsed-user back-off and comeback ladder, as pure rules.
 *
 * Measured 2026-10 (real users): 677 of 902 queued pushes went to people already 3+ days without a
 * check-in, and 14 returns ever came after a gap of 3+ days (7 at 3–6, 6 at 7–13, 1 at 14+).
 * These tests pin the line at day 3 and the ladder that replaces the daily nudges past it.
 */

const TODAY = '2026-10-28';

const history = (overrides: Record<string, string | null> = {}) => ({
    lastCheckinDate: null,
    firstCheckinDate: null,
    firstHabitStartedDate: null,
    ...overrides,
});

describe('retentionLadder', () => {
    afterEach(() => {
        delete process.env.HABIT_LAPSE_BACKOFF_DAYS;
        delete process.env.HABIT_COMEBACK_LADDER_DAYS;
    });

    describe('classifyRetention', () => {
        it('keeps nudging through day 2 and backs off from day 3', () => {
            expect(classifyRetention(history({ lastCheckinDate: '2026-10-26' }), TODAY).state).to.equal('active');
            const lapsed = classifyRetention(history({ lastCheckinDate: '2026-10-25' }), TODAY);
            expect(lapsed.state).to.equal('lapsed');
            expect(lapsed.daysSince).to.equal(3);
            expect(lapsed.anchorDate).to.equal('2026-10-25');
            expect(isBackedOff(lapsed)).to.equal(true);
        });

        it('recognises day 2 — the first check-in was yesterday', () => {
            const dayTwo = classifyRetention(history({ lastCheckinDate: '2026-10-27', firstCheckinDate: '2026-10-27' }), TODAY);
            expect(dayTwo.isDayTwo).to.equal(true);
            expect(dayTwo.state).to.equal('active');
            const later = classifyRetention(history({ lastCheckinDate: '2026-10-27', firstCheckinDate: '2026-10-20' }), TODAY);
            expect(later.isDayTwo).to.equal(false);
        });

        it('dates a never-checked-in user from their first habit, not their signup', () => {
            const fresh = classifyRetention(history({ firstHabitStartedDate: '2026-10-28' }), TODAY);
            expect(fresh.state).to.equal('never-new');
            expect(isBackedOff(fresh)).to.equal(false);
            const stale = classifyRetention(history({ firstHabitStartedDate: '2026-10-20' }), TODAY);
            expect(stale.state).to.equal('never-lapsed');
            expect(stale.anchorDate).to.equal('2026-10-20');
            expect(isBackedOff(stale)).to.equal(true);
        });

        it('never backs off someone with no history to judge', () => {
            expect(isBackedOff(classifyRetention(history(), TODAY))).to.equal(false);
        });

        it('takes the threshold from HABIT_LAPSE_BACKOFF_DAYS', () => {
            process.env.HABIT_LAPSE_BACKOFF_DAYS = '7';
            expect(getLapseBackoffDays()).to.equal(7);
            expect(classifyRetention(history({ lastCheckinDate: '2026-10-25' }), TODAY).state).to.equal('active');
        });

        it('ignores a nonsense threshold rather than backing off everyone', () => {
            ['0', '-2', 'abc', ''].forEach((value) => {
                process.env.HABIT_LAPSE_BACKOFF_DAYS = value;
                expect(getLapseBackoffDays(), value).to.equal(3);
            });
        });
    });

    describe('the ladder', () => {
        const ladder = [3, 7, 14];

        it('offers exactly one rung at a time, the highest one due', () => {
            expect(getDueComebackRung(2, ladder)).to.equal(null);
            expect(getDueComebackRung(3, ladder)).to.equal(3);
            expect(getDueComebackRung(6, ladder)).to.equal(3);
            // A user first found at day 9 gets the day-7 message, not a burst of day 3 and day 7.
            expect(getDueComebackRung(9, ladder)).to.equal(7);
            expect(getDueComebackRung(14, ladder)).to.equal(14);
            expect(getDueComebackRung(20, ladder)).to.equal(14);
        });

        it('stops for good after the last rung', () => {
            expect(getDueComebackRung(21, ladder)).to.equal(null);
            expect(isLadderExhausted(21, ladder)).to.equal(true);
            expect(isLadderExhausted(200, ladder)).to.equal(true);
            expect(isLadderExhausted(20, ladder)).to.equal(false);
        });

        it('reads HABIT_COMEBACK_LADDER_DAYS, sorted, de-duplicated and never below the back-off', () => {
            process.env.HABIT_COMEBACK_LADDER_DAYS = '10, 5, 5, 1';
            expect(getComebackLadderDays(3)).to.deep.equal([5, 10]);
            process.env.HABIT_COMEBACK_LADDER_DAYS = 'garbage';
            expect(getComebackLadderDays(3)).to.deep.equal([3, 7, 14]);
            delete process.env.HABIT_COMEBACK_LADDER_DAYS;
            expect(getComebackLadderDays(10)).to.deep.equal([14]);
            expect(getComebackLadderDays(30)).to.deep.equal([30]);
        });

        it('keys each rung on the lapse, so a later lapse gets the ladder again', () => {
            expect(comebackMessageKey('2026-10-25', 3)).to.equal('retention:comeback:2026-10-25:d3');
            expect(comebackMessageKey('2026-12-01', 3)).to.not.equal(comebackMessageKey('2026-10-25', 3));
            expect(comebackMessageKey('2026-10-25', 3)).to.not.match(/T\d\d:/);
        });
    });
});
