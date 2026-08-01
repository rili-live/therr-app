import { expect } from 'chai';
import { IDENTITY_CONSISTENCY_WINDOW_DAYS } from 'therr-js-utilities/config';
import {
    buildIdentityEvidence,
    daysBetween,
    getDaysSinceLastVote,
    getExpectedCheckinCount,
} from '../../src/utilities/identityHelpers';

/**
 * Evidence assembly for the identity ladder (habit -> mindset -> identity).
 *
 * The ladder's decision rules are tested in therr-js-utilities; these cover the
 * server-side half — turning check-in rows into the evidence bundle it reads.
 */

describe('getExpectedCheckinCount', () => {
    it('expects one per day for a daily habit', () => {
        expect(getExpectedCheckinCount({ frequencyType: 'daily' })).to.equal(IDENTITY_CONSISTENCY_WINDOW_DAYS);
    });

    it('ignores frequencyCount on daily habits, since one check-in per day is the cap', () => {
        // habit_checkins is unique on (userId, habitGoalId, scheduledDate), so a
        // "3x daily" goal can still only produce 28 completions in 28 days.
        expect(getExpectedCheckinCount({ frequencyType: 'daily', frequencyCount: 3 })).to.equal(28);
    });

    it('scales a weekly habit by its per-week count', () => {
        expect(getExpectedCheckinCount({ frequencyType: 'weekly', frequencyCount: 3 })).to.equal(12);
    });

    it('counts target weekdays when the schedule names specific days', () => {
        expect(getExpectedCheckinCount({
            frequencyType: 'weekly',
            frequencyCount: 1,
            targetDaysOfWeek: [1, 3, 5],
        })).to.equal(12);
    });

    it('honors an explicit window length', () => {
        expect(getExpectedCheckinCount({ frequencyType: 'weekly', frequencyCount: 2 }, 7)).to.equal(2);
    });

    it('never returns zero, so the consistency ratio can never divide by zero', () => {
        expect(getExpectedCheckinCount({ frequencyType: 'weekly', frequencyCount: 0 }, 1)).to.equal(1);
        expect(getExpectedCheckinCount({}, 0)).to.equal(1);
    });
});

describe('daysBetween', () => {
    it('counts whole calendar days', () => {
        expect(daysBetween('2026-07-01', '2026-07-08')).to.equal(7);
    });

    it('treats date-only strings as local dates, not UTC midnight', () => {
        // `new Date('2026-07-22')` is UTC midnight, which is Jul 21 evening west of
        // UTC — parsing it naively would shift every span by a day.
        expect(daysBetween('2026-07-22', '2026-07-22')).to.equal(0);
    });

    it('clamps to zero rather than returning a negative span', () => {
        expect(daysBetween('2026-07-08', '2026-07-01')).to.equal(0);
    });

    it('spans month and year boundaries', () => {
        expect(daysBetween('2026-12-25', '2027-01-01')).to.equal(7);
    });
});

describe('getDaysSinceLastVote', () => {
    it('returns null when the user has never voted', () => {
        expect(getDaysSinceLastVote(null, '2026-08-01')).to.equal(null);
        expect(getDaysSinceLastVote(undefined, '2026-08-01')).to.equal(null);
    });

    it('measures the gap from the last vote', () => {
        expect(getDaysSinceLastVote('2026-07-01', '2026-08-01')).to.equal(31);
    });
});

describe('buildIdentityEvidence', () => {
    const baseInputs = {
        progress: {
            identityLabel: 'someone who runs before work',
            votesCast: 30,
            comebackCount: 1,
            reflectionCount: 2,
            partnerAffirmationCount: 1,
            selfConceptScore: 4,
            firstVoteDate: '2026-05-01',
            lastVoteDate: '2026-08-01',
        },
        habitGoal: { frequencyType: 'daily' },
        completedInWindow: 21,
        distinctWeeksActive: 9,
        recentDifficultyRatings: [2, 3, 1],
        asOfDate: '2026-08-01',
    };

    it('maps stored counters straight through', () => {
        const evidence = buildIdentityEvidence(baseInputs);
        expect(evidence.hasIdentityLabel).to.equal(true);
        expect(evidence.votesCast).to.equal(30);
        expect(evidence.comebackCount).to.equal(1);
        expect(evidence.reflectionCount).to.equal(2);
        expect(evidence.partnerAffirmationCount).to.equal(1);
        expect(evidence.selfConceptScore).to.equal(4);
        expect(evidence.distinctWeeksActive).to.equal(9);
    });

    it('derives the consistency ratio from the habit schedule', () => {
        const evidence = buildIdentityEvidence(baseInputs);
        expect(evidence.consistencyRatio).to.equal(21 / 28);
    });

    it('caps the consistency ratio at 1 so extra volume cannot offset missed days', () => {
        const evidence = buildIdentityEvidence({
            ...baseInputs,
            habitGoal: { frequencyType: 'weekly', frequencyCount: 2 },
            completedInWindow: 20,
        });
        expect(evidence.consistencyRatio).to.equal(1);
    });

    it('averages recent difficulty ratings', () => {
        const evidence = buildIdentityEvidence(baseInputs);
        expect(evidence.meanRecentDifficulty).to.equal(2);
    });

    it('reports null difficulty when no check-in has been rated', () => {
        const evidence = buildIdentityEvidence({ ...baseInputs, recentDifficultyRatings: [] });
        expect(evidence.meanRecentDifficulty).to.equal(null);
    });

    it('measures elapsed time from the first vote', () => {
        const evidence = buildIdentityEvidence(baseInputs);
        expect(evidence.daysSinceFirstVote).to.equal(92);
    });

    it('treats a habit with no votes yet as zero days old, not negative', () => {
        const evidence = buildIdentityEvidence({
            ...baseInputs,
            progress: { ...baseInputs.progress, firstVoteDate: null },
        });
        expect(evidence.daysSinceFirstVote).to.equal(0);
    });

    it('defaults every missing counter to a non-advancing value on a brand new row', () => {
        const evidence = buildIdentityEvidence({
            progress: {},
            habitGoal: {},
            completedInWindow: 0,
            distinctWeeksActive: 0,
            recentDifficultyRatings: [],
            asOfDate: '2026-08-01',
        });
        expect(evidence).to.deep.equal({
            hasIdentityLabel: false,
            votesCast: 0,
            consistencyRatio: 0,
            distinctWeeksActive: 0,
            meanRecentDifficulty: null,
            reflectionCount: 0,
            comebackCount: 0,
            daysSinceFirstVote: 0,
            selfConceptScore: null,
            partnerAffirmationCount: 0,
        });
    });
});
