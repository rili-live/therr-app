import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import {
    getDaysBetweenDates,
    normalizeDateString,
    MAX_GRACE_PERIOD_DAYS,
} from '../../src/utilities/streakHelpers';
import { getCadence, countMissedPeriods } from '../../src/utilities/habitCadence';
import { isClaimCodePreVerified } from '../../src/handlers/helpers/pactRedemption';

/**
 * Regression tests for streak gap handling (streak freezes) and claim-based
 * pre-verification.
 *
 * Before this work, incrementStreak was called unconditionally on every
 * completed check-in: streaks never reset after missed days, same-day
 * re-submissions double-counted, and the gracePeriodDays/graceDaysUsed
 * columns were dead. These tests pin the decision inputs the check-in
 * handler now relies on (see createCheckin in handlers/habitCheckins.ts).
 */
describe('Streak gap handling (streak freezes)', () => {
    describe('getDaysBetweenDates', () => {
        it('returns 0 for the same day and 1 for consecutive days', () => {
            expect(getDaysBetweenDates('2026-07-20', '2026-07-20')).to.equal(0);
            expect(getDaysBetweenDates('2026-07-20', '2026-07-21')).to.equal(1);
        });

        it('handles month boundaries', () => {
            expect(getDaysBetweenDates('2026-06-30', '2026-07-02')).to.equal(2);
        });

        it('accepts Date objects (PG date columns deserialize as Date)', () => {
            expect(getDaysBetweenDates(new Date('2026-07-18T00:00:00'), '2026-07-21')).to.equal(3);
        });
    });

    describe('normalizeDateString', () => {
        it('normalizes Date objects and ISO strings to YYYY-MM-DD', () => {
            expect(normalizeDateString(new Date(2026, 6, 21))).to.equal('2026-07-21');
            expect(normalizeDateString('2026-07-21T00:30:00')).to.equal('2026-07-21');
        });
    });

    /**
     * `countMissedDaysForStreak` was replaced by `countMissedPeriods` in utilities/habitCadence.ts
     * when habits gained a real cadence. The daily cases below are unchanged and are the point:
     * every existing habit is `frequencyType: 'daily'`, and the new unit must be a strict no-op
     * for them. The cases that changed are called out where they appear.
     */
    describe('countMissedPeriods (daily cadence) — must match the old behaviour exactly', () => {
        const daily = getCadence({ frequencyType: 'daily' });

        it('returns 0 when the user checked in yesterday (streak intact)', () => {
            expect(countMissedPeriods(daily, {
                lastCompletedDate: '2026-07-20',
                throughDate: '2026-07-21',
            })).to.equal(0);
        });

        it('returns 1 when exactly one day was skipped — the streak-freeze case', () => {
            expect(countMissedPeriods(daily, {
                lastCompletedDate: '2026-07-19',
                throughDate: '2026-07-21',
            })).to.equal(1);
        });

        it('returns N-1 for an N-day gap — more than available freezes forces a reset', () => {
            expect(countMissedPeriods(daily, {
                lastCompletedDate: '2026-07-15',
                throughDate: '2026-07-21',
            })).to.equal(5);
        });
    });

    describe('countMissedPeriods (fixed weekdays)', () => {
        it('counts only target weekdays inside the gap', () => {
            // 2026-07-13 is a Monday. Target days: Mon(1) + Thu(4).
            // Gap Mon→next Mon skips Thu 07-16 only.
            const cadence = getCadence({ frequencyType: 'weekly', targetDaysOfWeek: [1, 4] });
            expect(countMissedPeriods(cadence, {
                lastCompletedDate: '2026-07-13',
                throughDate: '2026-07-20',
            })).to.equal(1);
        });

        it('honours the schedule even when frequencyType is not "weekly"', () => {
            // CHANGED. The old function keyed this branch on `frequencyType === 'weekly'`, so a
            // `custom` goal carrying fixed days fell through to the daily branch and was scored
            // against all seven days — it would have answered 6 here.
            const cadence = getCadence({ frequencyType: 'custom', targetDaysOfWeek: [1, 4] });
            expect(countMissedPeriods(cadence, {
                lastCompletedDate: '2026-07-13',
                throughDate: '2026-07-20',
            })).to.equal(1);
        });
    });

    describe('countMissedPeriods (N per week)', () => {
        // 2026-07-13 Mon … 2026-07-19 Sun; 2026-07-20 is the next Monday.
        const threePerWeek = getCadence({ frequencyType: 'weekly', frequencyCount: 3 });

        it('gives full-week flexibility — an off day inside a good week is not a miss', () => {
            expect(countMissedPeriods(threePerWeek, {
                lastCompletedDate: '2026-07-13',
                throughDate: '2026-07-19',
                completedDates: ['2026-07-13', '2026-07-15', '2026-07-17'],
            })).to.equal(0);
        });

        it('misses a closed week that fell short of the quota', () => {
            // CHANGED, and this is the substance of the change. The old function only ever
            // registered a miss after a gap of more than two whole weeks, which made an
            // N-per-week streak effectively unbreakable: it would have answered 0 here.
            expect(countMissedPeriods(threePerWeek, {
                lastCompletedDate: '2026-07-13',
                throughDate: '2026-07-20',
                completedDates: ['2026-07-13'],
            })).to.equal(1);
        });

        it('does not judge the week in progress, only weeks that have closed', () => {
            expect(countMissedPeriods(threePerWeek, {
                lastCompletedDate: '2026-07-20',
                throughDate: '2026-07-22',
                completedDates: ['2026-07-20'],
            })).to.equal(0);
        });

        it('never reaches back past cadenceEffectiveFrom, which grandfathers pre-existing habits', () => {
            // The week of 07-13 closed at 1 of 3, but this cadence only became authoritative on
            // 07-20, so that week is not its to judge. Without this clamp, deploying the stricter
            // rule would retroactively reset streaks users had already earned.
            expect(countMissedPeriods(threePerWeek, {
                lastCompletedDate: '2026-07-13',
                throughDate: '2026-07-20',
                completedDates: ['2026-07-13'],
                effectiveFrom: '2026-07-20',
            })).to.equal(0);
        });
    });

    describe('freeze economy invariants', () => {
        it('caps earnable freezes at MAX_GRACE_PERIOD_DAYS', () => {
            expect(MAX_GRACE_PERIOD_DAYS).to.equal(3);
        });
    });
});

describe('Pact claim pre-verification (isClaimCodePreVerified)', () => {
    const CLAIM_CODE = 'PACT-ABCD';
    const INVITEE_USER_ID = 'original-invitee-id';

    afterEach(() => {
        sinon.restore();
    });

    const stubMember = (overrides: any = {}) => sinon.stub(Store.pactMembers, 'findByClaim').resolves({
        id: 'member-1',
        pactId: 'pact-1',
        userId: INVITEE_USER_ID,
        status: 'pending',
        claimTokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
        ...overrides,
    });

    it('returns true when the registrant email matches the original invitee (skips verification wall)', async () => {
        stubMember();
        sinon.stub(Store.users, 'findUser').resolves([{ email: 'invitee@test.com', phoneNumber: null }]);

        const result = await isClaimCodePreVerified(CLAIM_CODE, { email: 'invitee@test.com' });
        expect(result).to.equal(true);
    });

    it('returns true on a phone match when the invite went out via SMS', async () => {
        stubMember();
        sinon.stub(Store.users, 'findUser').resolves([{ email: null, phoneNumber: '+15551230000' }]);

        const result = await isClaimCodePreVerified(CLAIM_CODE, { phoneNumber: '(555) 123-0000' });
        expect(result).to.equal(true);
    });

    it('returns false when the registrant does not match the invitee (leaked code)', async () => {
        stubMember();
        sinon.stub(Store.users, 'findUser').resolves([{ email: 'invitee@test.com', phoneNumber: null }]);

        const result = await isClaimCodePreVerified(CLAIM_CODE, { email: 'stranger@test.com' });
        expect(result).to.equal(false);
    });

    it('returns false for an expired claim', async () => {
        stubMember({ claimTokenExpiresAt: new Date(Date.now() - 1000).toISOString() });
        const findUserStub = sinon.stub(Store.users, 'findUser').resolves([{ email: 'invitee@test.com' }]);

        const result = await isClaimCodePreVerified(CLAIM_CODE, { email: 'invitee@test.com' });
        expect(result).to.equal(false);
        expect(findUserStub.notCalled).to.equal(true);
    });

    it('returns false for an already-redeemed (non-pending) claim', async () => {
        stubMember({ status: 'active' });

        const result = await isClaimCodePreVerified(CLAIM_CODE, { email: 'invitee@test.com' });
        expect(result).to.equal(false);
    });

    it('returns false with no code, and fails closed on lookup errors', async () => {
        expect(await isClaimCodePreVerified(null, { email: 'x@test.com' })).to.equal(false);

        sinon.stub(Store.pactMembers, 'findByClaim').rejects(new Error('db down'));
        expect(await isClaimCodePreVerified(CLAIM_CODE, { email: 'x@test.com' })).to.equal(false);
    });
});
