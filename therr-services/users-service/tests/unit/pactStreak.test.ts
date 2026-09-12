import { expect } from 'chai';
import {
    MIN_PACT_MEMBERS,
    getMajorityThreshold,
    hasReachedMajority,
    computeNextPactStreak,
    canContinueSolo,
    canRemoveMember,
} from '../../src/utilities/pactStreak';

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
        it('starts at 1 when there is no prior credited day', () => {
            expect(computeNextPactStreak({
                lastPactStreakDate: null,
                currentPactStreak: 0,
                streakDate: '2026-09-11',
            })).to.equal(1);
        });

        it('increments on a consecutive daily day', () => {
            expect(computeNextPactStreak({
                lastPactStreakDate: '2026-09-10',
                currentPactStreak: 4,
                streakDate: '2026-09-11',
            })).to.equal(5);
        });

        it('leaves the streak unchanged if the same day is re-evaluated', () => {
            expect(computeNextPactStreak({
                lastPactStreakDate: '2026-09-11',
                currentPactStreak: 7,
                streakDate: '2026-09-11',
            })).to.equal(7);
        });

        it('resets to 1 after a daily gap', () => {
            expect(computeNextPactStreak({
                lastPactStreakDate: '2026-09-08',
                currentPactStreak: 9,
                streakDate: '2026-09-11',
            })).to.equal(1);
        });

        it('does not reset a weekly-cadence pact for a normal off day', () => {
            // 3x/week: a two-day gap is on-cadence, not a miss.
            expect(computeNextPactStreak({
                lastPactStreakDate: '2026-09-09',
                currentPactStreak: 3,
                streakDate: '2026-09-11',
                frequencyType: 'weekly',
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
