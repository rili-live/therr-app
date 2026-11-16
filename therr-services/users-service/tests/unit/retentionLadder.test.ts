import { expect } from 'chai';
import {
    classifyRetention,
    comebackMessageKey,
    getComebackLadderDays,
    getDueComebackRung,
    getDaysIntoLapse,
    getLapseBackoffDays,
    isBackedOff,
    isLadderExhausted,
} from '../../src/utilities/retentionLadder';
import { getCadence, IRequiredDaysHabit } from '../../src/utilities/habitCadence';
import { addDays, daysBetween } from '../../src/utilities/dailyStreak';

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

    describe('cadence-aware lapses', () => {
        // 2026-11-13 is a Friday; 2026-11-16 the Monday after.
        const habit = (source: Record<string, any>, overrides: Partial<IRequiredDaysHabit> = {}): IRequiredDaysHabit => ({
            habitGoalId: 'goal-1',
            cadence: getCadence(source),
            startedOn: '2026-01-01',
            ...overrides,
        });
        const monWedFri = habit({ frequencyType: 'weekly', targetDaysOfWeek: [1, 3, 5] });

        it('does not treat a Mon/Wed/Fri habit\'s weekend as a lapse', () => {
            const monday = classifyRetention(history({ lastCheckinDate: '2026-11-13' }), '2026-11-16', 3, [monWedFri]);
            expect(monday.state).to.equal('active');
            expect(isBackedOff(monday)).to.equal(false);
            expect(getDueComebackRung(monday.daysSince, [3, 7, 14])).to.equal(null);
            // The calendar count this replaces called the same user lapsed.
            expect(classifyRetention(history({ lastCheckinDate: '2026-11-13' }), '2026-11-16').state).to.equal('lapsed');
        });

        it('starts the lapse at the first scheduled day missed, not at the last check-in', () => {
            // Monday the 16th skipped. Tuesday is day 2 of the lapse; Wednesday, the next session, day 3.
            const tuesday = classifyRetention(history({ lastCheckinDate: '2026-11-13' }), '2026-11-17', 3, [monWedFri]);
            expect(tuesday.state).to.equal('active');
            expect(tuesday.daysSince).to.equal(2);
            const wednesday = classifyRetention(history({ lastCheckinDate: '2026-11-13' }), '2026-11-18', 3, [monWedFri]);
            expect(wednesday.state).to.equal('lapsed');
            expect(wednesday.daysSince).to.equal(3);
            // Still keyed on the check-in, so the ledger key is stable for the whole lapse.
            expect(wednesday.anchorDate).to.equal('2026-11-13');
        });

        it('leaves a once-a-week habit alone between sessions that were all done', () => {
            const saturdays = habit({ frequencyType: 'weekly', targetDaysOfWeek: [6] });
            // Checked in Saturday the 14th; next due Saturday the 21st.
            expect(getDaysIntoLapse('2026-11-14', '2026-11-20', [saturdays])).to.equal(0);
            expect(getDaysIntoLapse('2026-11-14', '2026-11-21', [saturdays])).to.equal(0);
            // The 21st skipped: the lapse runs from it.
            expect(getDaysIntoLapse('2026-11-14', '2026-11-22', [saturdays])).to.equal(2);
            expect(getDaysIntoLapse('2026-11-14', '2026-11-23', [saturdays])).to.equal(3);
        });

        it('counts exactly what the calendar did for a daily habit', () => {
            const daily = habit({ frequencyType: 'daily' });
            for (let gap = 2; gap <= 30; gap += 1) {
                const today = addDays('2026-11-01', gap);
                expect(getDaysIntoLapse('2026-11-01', today, [daily]), `gap ${gap}`).to.equal(gap);
                expect(classifyRetention(history({ lastCheckinDate: '2026-11-01' }), today, 3, [daily]).state, `gap ${gap}`)
                    .to.equal(classifyRetention(history({ lastCheckinDate: '2026-11-01' }), today).state);
            }
        });

        it('lets a weekly quota count what was already done that week', () => {
            const threePerWeek = habit({ frequencyType: 'weekly', frequencyCount: 3 });
            // Mon 16 and Wed 18 done; one more owed, so only Sunday the 22nd became required.
            const done = [
                { habitGoalId: 'goal-1', localDate: '2026-11-16' },
                { habitGoalId: 'goal-1', localDate: '2026-11-18' },
            ];
            expect(getDaysIntoLapse('2026-11-18', '2026-11-23', [threePerWeek], done)).to.equal(2);
            // Without that week's tally, Friday the 20th would already have looked required.
            expect(getDaysIntoLapse('2026-11-18', '2026-11-23', [threePerWeek], [])).to.equal(4);
        });

        it('does not count paused days toward a lapse', () => {
            const paused = habit({ frequencyType: 'daily' }, { pausedRanges: [{ from: '2026-11-02', until: null }] });
            expect(classifyRetention(history({ lastCheckinDate: '2026-11-01' }), '2026-11-20', 3, [paused]).state).to.equal('active');
        });

        it('applies the same rule to someone who has not checked in yet', () => {
            const fridayStart = classifyRetention(history({ firstHabitStartedDate: '2026-11-13' }), '2026-11-16', 3, [monWedFri]);
            expect(fridayStart.state).to.equal('never-new');
        });

        it('falls back to calendar days when there are no cadences to go on', () => {
            expect(getDaysIntoLapse('2026-11-13', '2026-11-16', [])).to.equal(3);
            expect(getDaysIntoLapse('2026-11-13', '2026-11-16', null)).to.equal(3);
        });

        it('never starts a lapse before the calendar would, so the comeback bonus promise holds', () => {
            // The comeback copy promises a bonus that `isComebackCheckin` pays on a calendar gap of
            // `lapseDays` or more. Every weekday schedule, every gap: days into the lapse <= calendar days.
            for (let mask = 1; mask < 128; mask += 1) {
                const days = [0, 1, 2, 3, 4, 5, 6].filter((day) => mask & (1 << day)); // eslint-disable-line no-bitwise
                const schedule = habit({ frequencyType: 'weekly', targetDaysOfWeek: days });
                for (let gap = 0; gap <= 21; gap += 1) {
                    const today = addDays('2026-11-13', gap);
                    expect(getDaysIntoLapse('2026-11-13', today, [schedule])).to.be.at.most(daysBetween('2026-11-13', today));
                }
            }
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
