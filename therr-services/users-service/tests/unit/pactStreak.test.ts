import { expect } from 'chai';
import {
    MIN_PACT_MEMBERS,
    getMajorityThreshold,
    hasReachedMajority,
    computeNextPactStreak,
    canContinueSolo,
    canRemoveMember,
} from '../../src/utilities/pactStreak';
import { getCadence } from '../../src/utilities/habitCadence';

/**
 * Shared ("pact") streak logic — unit tests.
 *
 * A pact streak advances on any day a strict majority of the pact's active members complete
 * the habit, and members who miss such a day keep their personal streak. These pin the
 * threshold, cadence continuity, and the floors that gate member removal / solo continuation.
 */
describe('pactStreak', () => {
    describe('getMajorityThreshold', () => {
        it('requires more than half — a strict majority', () => {
            expect(getMajorityThreshold(2)).to.equal(2); // both of two
            expect(getMajorityThreshold(3)).to.equal(2); // 2 of 3
            expect(getMajorityThreshold(4)).to.equal(3); // 3 of 4
            expect(getMajorityThreshold(5)).to.equal(3); // 3 of 5
            expect(getMajorityThreshold(6)).to.equal(4); // 4 of 6
        });

        it('treats solo (one member) as needing that one member', () => {
            expect(getMajorityThreshold(1)).to.equal(1);
        });

        it('never returns 0, so nobody checking in cannot satisfy it', () => {
            expect(getMajorityThreshold(0)).to.equal(1);
            expect(getMajorityThreshold(-3 as any)).to.equal(1);
        });
    });

    describe('hasReachedMajority', () => {
        it('is true once completed count reaches the threshold', () => {
            expect(hasReachedMajority(3, 5)).to.equal(true); // 3 of 5 clears
            expect(hasReachedMajority(2, 5)).to.equal(false); // 2 of 5 does not
            expect(hasReachedMajority(2, 3)).to.equal(true); // 2 of 3 clears
            expect(hasReachedMajority(1, 3)).to.equal(false);
        });

        it('handles the solo case', () => {
            expect(hasReachedMajority(1, 1)).to.equal(true);
            expect(hasReachedMajority(0, 1)).to.equal(false);
        });
    });

    describe('computeNextPactStreak', () => {
        const DAILY = getCadence({ frequencyType: 'daily' });

        it('starts at 1 when there is no prior credited day', () => {
            expect(computeNextPactStreak({
                lastPactStreakDate: null,
                currentPactStreak: 0,
                streakDate: '2026-09-11',
                cadence: DAILY,
            })).to.equal(1);
        });

        it('increments on a consecutive daily day', () => {
            expect(computeNextPactStreak({
                lastPactStreakDate: '2026-09-10',
                currentPactStreak: 4,
                streakDate: '2026-09-11',
                cadence: DAILY,
            })).to.equal(5);
        });

        it('leaves the streak unchanged if the same day is re-evaluated', () => {
            expect(computeNextPactStreak({
                lastPactStreakDate: '2026-09-11',
                currentPactStreak: 7,
                streakDate: '2026-09-11',
                cadence: DAILY,
            })).to.equal(7);
        });

        it('resets to 1 after a daily gap', () => {
            expect(computeNextPactStreak({
                lastPactStreakDate: '2026-09-08',
                currentPactStreak: 9,
                streakDate: '2026-09-11',
                cadence: DAILY,
            })).to.equal(1);
        });

        it('does not reset a weekly-quota pact for a normal off day inside one week', () => {
            // 2026-09-07 is a Monday, so 09-09 and 09-11 are the same Monday–Sunday week. A
            // quota is only judged once the week closes, so a mid-week gap cannot break it.
            expect(computeNextPactStreak({
                lastPactStreakDate: '2026-09-09',
                currentPactStreak: 3,
                streakDate: '2026-09-11',
                cadence: getCadence({ frequencyType: 'weekly', frequencyCount: 3 }),
                creditedDates: ['2026-09-09', '2026-09-11'],
            })).to.equal(4);
        });

        it('resets a weekly-quota pact when a closed week fell short', () => {
            // The week of 09-07 closed with 1 credited day against a target of 3.
            expect(computeNextPactStreak({
                lastPactStreakDate: '2026-09-09',
                currentPactStreak: 3,
                streakDate: '2026-09-14',
                cadence: getCadence({ frequencyType: 'weekly', frequencyCount: 3 }),
                creditedDates: ['2026-09-09'],
            })).to.equal(1);
        });

        it('carries a weekly-quota pact across a week that met its target', () => {
            expect(computeNextPactStreak({
                lastPactStreakDate: '2026-09-11',
                currentPactStreak: 3,
                streakDate: '2026-09-14',
                cadence: getCadence({ frequencyType: 'weekly', frequencyCount: 3 }),
                creditedDates: ['2026-09-08', '2026-09-09', '2026-09-11'],
            })).to.equal(4);
        });
    });

    describe('canContinueSolo', () => {
        it('is offered only to the last active member of an active, non-solo pact', () => {
            expect(canContinueSolo({ status: 'active', isSolo: false, activeMemberCount: 1 })).to.equal(true);
        });

        it('is not offered while more than one member remains', () => {
            expect(canContinueSolo({ status: 'active', isSolo: false, activeMemberCount: 2 })).to.equal(false);
        });

        it('is not offered again once already solo', () => {
            expect(canContinueSolo({ status: 'active', isSolo: true, activeMemberCount: 1 })).to.equal(false);
        });

        it('is not offered on a non-active pact', () => {
            expect(canContinueSolo({ status: 'completed', isSolo: false, activeMemberCount: 1 })).to.equal(false);
            expect(canContinueSolo({ status: 'pending', isSolo: false, activeMemberCount: 1 })).to.equal(false);
        });
    });

    describe('canRemoveMember', () => {
        it('allows removal only while at least the minimum would remain', () => {
            expect(MIN_PACT_MEMBERS).to.equal(2);
            expect(canRemoveMember(3)).to.equal(true); // 3 -> 2, still a pact
            expect(canRemoveMember(2)).to.equal(false); // 2 -> 1, would drop below the floor
            expect(canRemoveMember(1)).to.equal(false);
        });
    });
});
