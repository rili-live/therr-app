/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import {
    countMissedDaysForStreak,
    getDaysBetweenDates,
    normalizeDateString,
    MAX_GRACE_PERIOD_DAYS,
} from '../../src/utilities/streakHelpers';
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

    describe('countMissedDaysForStreak (daily cadence)', () => {
        it('returns 0 when the user checked in yesterday (streak intact)', () => {
            expect(countMissedDaysForStreak('2026-07-20', '2026-07-21', 'daily')).to.equal(0);
        });

        it('returns 1 when exactly one day was skipped — the streak-freeze case', () => {
            expect(countMissedDaysForStreak('2026-07-19', '2026-07-21', 'daily')).to.equal(1);
        });

        it('returns N-1 for an N-day gap — more than available freezes forces a reset', () => {
            expect(countMissedDaysForStreak('2026-07-15', '2026-07-21', 'daily')).to.equal(5);
        });
    });

    describe('countMissedDaysForStreak (weekly cadence)', () => {
        it('counts only target weekdays inside the gap', () => {
            // 2026-07-13 is a Monday. Target days: Mon(1) + Thu(4).
            // Gap Mon→next Mon skips Thu 07-16 only.
            expect(countMissedDaysForStreak('2026-07-13', '2026-07-20', 'weekly', [1, 4])).to.equal(1);
        });

        it('gives X-times-per-week habits full-week flexibility', () => {
            expect(countMissedDaysForStreak('2026-07-13', '2026-07-19', 'weekly')).to.equal(0);
            // A gap of more than one full week counts as a single miss event
            expect(countMissedDaysForStreak('2026-07-01', '2026-07-21', 'weekly')).to.equal(1);
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
