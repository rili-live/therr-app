import { expect } from 'chai';
import { getCadence } from '../../src/utilities/habitCadence';
import { IPledgeWeekInput, judgePledgeWeek, pledgeMissedDedupeKey } from '../../src/utilities/pledgeVerdict';

/**
 * The weekly pledge verdict (WORK_IN_PROGRESS § 2.8, Phase A). The rule these exist to pin is
 * the one the pledge must never break: a week a streak freeze covered is not a miss. The member
 * was told in advance that the first bad day happens inside the rules, and a pledge that called it
 * a failure would contradict that — and, once Phase B charges on a miss, bill them for it.
 */

// Monday 2026-09-21 → Sunday 2026-09-27.
const WEEK = '2026-09-21';
const dates = (...days: number[]) => new Set(days.map((d) => `2026-09-${String(20 + d).padStart(2, '0')}`));
const ALL_WEEK = dates(1, 2, 3, 4, 5, 6, 7);

const base = (overrides: Partial<IPledgeWeekInput> = {}): IPledgeWeekInput => ({
    weekStart: WEEK,
    cadence: getCadence({ frequencyType: 'daily' }),
    goal: { frequencyType: 'daily', isMeasured: false, targetAmount: null },
    pledgedAt: '2026-09-10T15:00:00.000Z',
    timeZone: 'America/Chicago',
    pactStartDate: '2026-09-01',
    completedDates: ALL_WEEK,
    coveredDates: new Set(),
    weekAmount: 0,
    streak: { currentStreak: 20, gracePeriodDays: 1, graceDaysUsed: 0 },
    streakEvents: [],
    ...overrides,
});

describe('judgePledgeWeek — when a week is judged at all', () => {
    it('judges a week the pledge governed from its first day', () => {
        expect(judgePledgeWeek(base())).to.equal('kept');
    });

    it('does not judge the week a pledge was made in — it first applies the next Monday', () => {
        const verdict = judgePledgeWeek(base({
            pledgedAt: '2026-09-23T15:00:00.000Z',
            completedDates: new Set(),
        }));
        expect(verdict).to.equal('notJudged');
    });

    it('reads the pledge day in the member\'s own zone', () => {
        // 03:00 UTC Monday is still Sunday evening in Chicago, so the pledge governed Monday.
        const verdict = judgePledgeWeek(base({
            pledgedAt: '2026-09-21T03:00:00.000Z',
            completedDates: new Set(),
            streak: null,
        }));
        expect(verdict).to.equal('missed');
    });

    it('does not judge a week the pact started partway through', () => {
        expect(judgePledgeWeek(base({ pactStartDate: '2026-09-23', completedDates: new Set() }))).to.equal('notJudged');
    });

    it('does not judge a week the cadence changed partway through', () => {
        const verdict = judgePledgeWeek(base({
            goal: { frequencyType: 'daily', isMeasured: false, cadenceEffectiveFrom: '2026-09-24' },
            completedDates: new Set(),
        }));
        expect(verdict).to.equal('notJudged');
    });

    it('rejects a weekStart that is not a Monday', () => {
        expect(judgePledgeWeek(base({ weekStart: '2026-09-22' }))).to.equal('notJudged');
    });
});

describe('judgePledgeWeek — measured habits', () => {
    const measured = (weekAmount: number) => base({
        goal: { frequencyType: 'daily', isMeasured: true, targetAmount: '20' },
        weekAmount,
        completedDates: dates(1, 2),
    });

    it('is kept when the week\'s amount reached the weekly target', () => {
        expect(judgePledgeWeek(measured(20))).to.equal('kept');
    });

    it('is missed when the amount fell short, however many days were checked in', () => {
        expect(judgePledgeWeek(base({
            goal: { frequencyType: 'daily', isMeasured: true, targetAmount: 20 },
            weekAmount: 19.5,
        }))).to.equal('missed');
    });

    it('is not rescued by a streak freeze — a freeze covers a day, not an amount', () => {
        expect(judgePledgeWeek(measured(5))).to.equal('missed');
    });

    it('falls back to the cadence rule when a measured goal has no target', () => {
        const verdict = judgePledgeWeek(base({
            goal: { frequencyType: 'daily', isMeasured: true, targetAmount: null },
            weekAmount: 0,
        }));
        expect(verdict).to.equal('kept');
    });
});

describe('judgePledgeWeek — cadence', () => {
    it('counts days the pact carried as done, as the streak does', () => {
        const verdict = judgePledgeWeek(base({
            completedDates: dates(1, 2, 3, 5, 6, 7),
            coveredDates: dates(4),
            streak: { currentStreak: 20, gracePeriodDays: 0, graceDaysUsed: 0 },
        }));
        expect(verdict).to.equal('kept');
    });

    it('is kept when a 3x/week habit hit three days, with four off days and no freeze spent', () => {
        const verdict = judgePledgeWeek(base({
            cadence: getCadence({ frequencyType: 'weekly', frequencyCount: 3 }),
            goal: { frequencyType: 'weekly', frequencyCount: 3, isMeasured: false },
            completedDates: dates(1, 3, 6),
            streak: { currentStreak: 5, gracePeriodDays: 0, graceDaysUsed: 0 },
        }));
        expect(verdict).to.equal('kept');
    });

    it('is kept on a fixed-weekday habit that did every one of its days', () => {
        const verdict = judgePledgeWeek(base({
            // Mon (1), Wed (3), Fri (5) — Sunday-first day indices.
            cadence: getCadence({ targetDaysOfWeek: [1, 3, 5] }),
            goal: { targetDaysOfWeek: [1, 3, 5], isMeasured: false },
            completedDates: dates(1, 3, 5),
        }));
        expect(verdict).to.equal('kept');
    });

    it('is missed when there is no streak for a freeze to save', () => {
        const verdict = judgePledgeWeek(base({
            completedDates: dates(1, 2, 3, 4, 5, 6),
            streak: { currentStreak: 0, gracePeriodDays: 3, graceDaysUsed: 0 },
        }));
        expect(verdict).to.equal('missed');
    });
});

describe('judgePledgeWeek — streak freezes are never a miss', () => {
    it('covers a trailing miss the held freezes will absorb at the next check-in', () => {
        // Checked in Mon–Sat, missed Sunday, holds one freeze.
        const verdict = judgePledgeWeek(base({ completedDates: dates(1, 2, 3, 4, 5, 6) }));
        expect(verdict).to.equal('covered');
    });

    it('misses when the trailing gap is longer than the freezes held', () => {
        const verdict = judgePledgeWeek(base({
            completedDates: dates(1, 2, 3, 4, 5),
            streak: { currentStreak: 20, gracePeriodDays: 1, graceDaysUsed: 0 },
        }));
        expect(verdict).to.equal('missed');
    });

    it('covers a settled mid-week miss that a recorded freeze already saved', () => {
        // Missed Wednesday; Thursday's check-in spent the freeze (so none is held now).
        const verdict = judgePledgeWeek(base({
            completedDates: dates(1, 2, 4, 5, 6, 7),
            streak: { currentStreak: 20, gracePeriodDays: 1, graceDaysUsed: 1 },
            streakEvents: [{ eventType: 'grace_used', eventDate: '2026-09-24' }],
        }));
        expect(verdict).to.equal('covered');
    });

    it('does not double-count a freeze already spent inside the week against the freezes left', () => {
        // Missed Tue and Wed, Thursday's check-in spent two freezes, one is still held, Sunday missed.
        const verdict = judgePledgeWeek(base({
            completedDates: dates(1, 4, 5, 6),
            streak: { currentStreak: 20, gracePeriodDays: 3, graceDaysUsed: 2 },
            streakEvents: [{ eventType: 'grace_used', eventDate: '2026-09-24' }],
        }));
        expect(verdict).to.equal('covered');
    });

    it('misses a settled gap with no freeze recorded for it', () => {
        const verdict = judgePledgeWeek(base({
            completedDates: dates(1, 2, 4, 5, 6, 7),
            streak: { currentStreak: 4, gracePeriodDays: 1, graceDaysUsed: 0 },
            streakEvents: [],
        }));
        expect(verdict).to.equal('missed');
    });

    it('misses when the streak reset inside the week', () => {
        const verdict = judgePledgeWeek(base({
            completedDates: dates(1, 5, 6, 7),
            streak: { currentStreak: 3, gracePeriodDays: 1, graceDaysUsed: 0 },
            streakEvents: [{ eventType: 'missed', eventDate: '2026-09-25' }],
        }));
        expect(verdict).to.equal('missed');
    });

    it('covers a trailing miss a Monday check-in already spent the freeze on, before the verdict ran', () => {
        // Checked in Mon–Sat, missed Sunday. Monday's check-in spent the only freeze and dated
        // the event Monday — outside the week — so none is held when the verdict runs.
        const verdict = judgePledgeWeek(base({
            completedDates: dates(1, 2, 3, 4, 5, 6),
            streak: { currentStreak: 21, gracePeriodDays: 1, graceDaysUsed: 1 },
            streakEvents: [
                { eventType: 'completed', eventDate: '2026-09-28' },
                { eventType: 'grace_used', eventDate: '2026-09-28' },
            ],
        }));
        expect(verdict).to.equal('covered');
    });

    it('misses a trailing gap a Monday check-in already reset the streak for', () => {
        const verdict = judgePledgeWeek(base({
            completedDates: dates(1, 2, 3, 4, 5),
            streak: { currentStreak: 1, gracePeriodDays: 3, graceDaysUsed: 0 },
            streakEvents: [{ eventType: 'missed', eventDate: '2026-09-28' }],
        }));
        expect(verdict).to.equal('missed');
    });

    it('covers an unmet weekly quota a Monday check-in already spent the freeze on', () => {
        const verdict = judgePledgeWeek(base({
            cadence: getCadence({ frequencyType: 'weekly', frequencyCount: 4 }),
            goal: { frequencyType: 'weekly', frequencyCount: 4, isMeasured: false },
            completedDates: dates(1, 3, 5),
            streak: { currentStreak: 6, gracePeriodDays: 1, graceDaysUsed: 1 },
            streakEvents: [{ eventType: 'grace_used', eventDate: '2026-09-28' }],
        }));
        expect(verdict).to.equal('covered');
    });

    it('covers an unmet weekly quota when a freeze is held, since the check-in flow judges it next', () => {
        const input = {
            cadence: getCadence({ frequencyType: 'weekly', frequencyCount: 4 }),
            goal: { frequencyType: 'weekly', frequencyCount: 4, isMeasured: false },
            completedDates: dates(1, 3, 5),
        };
        expect(judgePledgeWeek(base(input))).to.equal('covered');
        expect(judgePledgeWeek(base({
            ...input,
            streak: { currentStreak: 6, gracePeriodDays: 1, graceDaysUsed: 1 },
        }))).to.equal('missed');
    });
});

describe('pledgeMissedDedupeKey', () => {
    it('is stamped with the pact and the week, and holds no clock', () => {
        expect(pledgeMissedDedupeKey('pact-1', WEEK)).to.equal('pledge-missed:pact-1:2026-09-21');
        expect(pledgeMissedDedupeKey('pact-1', WEEK)).to.equal(pledgeMissedDedupeKey('pact-1', WEEK));
    });
});
