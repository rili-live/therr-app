import { expect } from 'chai';
import {
    IdentityStages,
    IIdentityEvidence,
    IDENTITY_DORMANCY_DAYS,
    evaluateIdentityStage,
    isIdentityDormant,
} from '../src/config/habits/identityProgression';

const noEvidence: IIdentityEvidence = {
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
};

// Evidence that satisfies every rung, so individual tests can knock out one
// requirement at a time and assert exactly which rung it blocks.
const fullEvidence: IIdentityEvidence = {
    hasIdentityLabel: true,
    votesCast: 120,
    consistencyRatio: 0.9,
    distinctWeeksActive: 16,
    meanRecentDifficulty: 1.4,
    reflectionCount: 4,
    comebackCount: 2,
    daysSinceFirstVote: 140,
    selfConceptScore: 5,
    partnerAffirmationCount: 3,
};

const withEvidence = (overrides: Partial<IIdentityEvidence>): IIdentityEvidence => ({
    ...fullEvidence,
    ...overrides,
});

describe('evaluateIdentityStage', () => {
    it('starts a brand new habit at INTENTION', () => {
        const result = evaluateIdentityStage(noEvidence);
        expect(result.stage).to.equal(IdentityStages.INTENTION);
        expect(result.stageKey).to.equal('intention');
        expect(result.nextStage).to.equal(IdentityStages.REPETITION);
    });

    it('awards IDENTITY when every rung is satisfied', () => {
        const result = evaluateIdentityStage(fullEvidence);
        expect(result.stage).to.equal(IdentityStages.IDENTITY);
        expect(result.nextStage).to.equal(null);
        expect(result.nextStageKey).to.equal(null);
        expect(result.requirements).to.have.lengthOf(0);
        expect(result.progressToNextStage).to.equal(100);
    });

    it('requires a named identity, not just check-ins, to leave INTENTION', () => {
        const result = evaluateIdentityStage(withEvidence({ hasIdentityLabel: false }));
        expect(result.stage).to.equal(IdentityStages.INTENTION);
        expect(result.unmetRequirements.map((r) => r.key)).to.deep.equal(['hasIdentityLabel']);
    });

    it('does not let volume alone buy AUTOMATICITY — check-ins must be spread out', () => {
        // 40 check-ins crammed into a single week: past the vote threshold, but the
        // week-spread requirement is what makes the rung mean "sustained".
        const result = evaluateIdentityStage(withEvidence({
            votesCast: 40,
            distinctWeeksActive: 1,
        }));
        expect(result.stage).to.equal(IdentityStages.REPETITION);
        expect(result.unmetRequirements.map((r) => r.key)).to.deep.equal(['distinctWeeksActive']);
    });

    it('holds at AUTOMATICITY until the habit has survived a lapse', () => {
        const result = evaluateIdentityStage(withEvidence({ comebackCount: 0 }));
        expect(result.stage).to.equal(IdentityStages.AUTOMATICITY);
        expect(result.unmetRequirements.map((r) => r.key)).to.deep.equal(['comebackCount']);
    });

    it('holds at AUTOMATICITY while the habit still feels hard', () => {
        const result = evaluateIdentityStage(withEvidence({ meanRecentDifficulty: 4.5 }));
        expect(result.stage).to.equal(IdentityStages.AUTOMATICITY);
        expect(result.unmetRequirements.map((r) => r.key)).to.deep.equal(['meanRecentDifficulty']);
    });

    it('treats never-collected evidence as unmet rather than as partial credit', () => {
        const result = evaluateIdentityStage(withEvidence({ meanRecentDifficulty: null }));
        expect(result.stage).to.equal(IdentityStages.AUTOMATICITY);
        const difficulty = result.requirements.find((r) => r.key === 'meanRecentDifficulty');
        expect(difficulty?.actual).to.equal(null);
        expect(difficulty?.isMet).to.equal(false);
        expect(difficulty?.progress).to.equal(0);
    });

    it('holds at MINDSET without an outside witness', () => {
        const result = evaluateIdentityStage(withEvidence({ partnerAffirmationCount: 0 }));
        expect(result.stage).to.equal(IdentityStages.MINDSET);
        expect(result.unmetRequirements.map((r) => r.key)).to.deep.equal(['partnerAffirmationCount']);
    });

    it('holds at MINDSET until enough time has passed, however perfect the record', () => {
        const result = evaluateIdentityStage(withEvidence({ daysSinceFirstVote: 30 }));
        expect(result.stage).to.equal(IdentityStages.MINDSET);
        expect(result.unmetRequirements.map((r) => r.key)).to.deep.equal(['daysSinceFirstVote']);
    });

    it('holds at MINDSET while the user still says "I am trying to"', () => {
        const result = evaluateIdentityStage(withEvidence({ selfConceptScore: 2 }));
        expect(result.stage).to.equal(IdentityStages.MINDSET);
        expect(result.unmetRequirements.map((r) => r.key)).to.deep.equal(['selfConceptScore']);
    });

    it('never revokes a stage the user already earned', () => {
        // Trailing-window evidence has decayed to nothing, but a stage is a claim
        // about who someone became — a bad month does not un-make it.
        const result = evaluateIdentityStage(noEvidence, IdentityStages.MINDSET);
        expect(result.stage).to.equal(IdentityStages.MINDSET);
        expect(result.nextStage).to.equal(IdentityStages.IDENTITY);
    });

    it('still advances past a stale stored stage when the evidence has grown', () => {
        const result = evaluateIdentityStage(fullEvidence, IdentityStages.REPETITION);
        expect(result.stage).to.equal(IdentityStages.IDENTITY);
    });

    it('never skips a rung, so every stage below the awarded one is satisfied', () => {
        // Identity-level everything except the AUTOMATICITY week spread. Without the
        // walk-up, this evidence would otherwise satisfy MINDSET and IDENTITY.
        const result = evaluateIdentityStage(withEvidence({ distinctWeeksActive: 1 }));
        expect(result.stage).to.equal(IdentityStages.REPETITION);
    });

    it('reports partial progress toward the next rung', () => {
        const result = evaluateIdentityStage(withEvidence({
            votesCast: 5,
            consistencyRatio: 0.3,
            distinctWeeksActive: 1,
        }));
        expect(result.stage).to.equal(IdentityStages.REPETITION);
        expect(result.progressToNextStage).to.be.greaterThan(0);
        expect(result.progressToNextStage).to.be.lessThan(100);
    });

    it('caps requirement progress at 1 when evidence overshoots the threshold', () => {
        const result = evaluateIdentityStage(withEvidence({ hasIdentityLabel: false }));
        const votes = result.requirements.find((r) => r.key === 'votesCast');
        expect(votes?.progress).to.equal(1);
    });

    it('orders unmet requirements worst-progress first so the UI can lead with the gap', () => {
        const result = evaluateIdentityStage(withEvidence({
            votesCast: 20,
            consistencyRatio: 0.06,
            distinctWeeksActive: 2,
        }));
        const unmetKeys = result.unmetRequirements.map((r) => r.key);
        expect(unmetKeys[0]).to.equal('consistencyRatio');
        expect(unmetKeys).to.include('votesCast');
    });
});

describe('isIdentityDormant', () => {
    it('is false for an active habit', () => {
        expect(isIdentityDormant(0)).to.equal(false);
        expect(isIdentityDormant(IDENTITY_DORMANCY_DAYS - 1)).to.equal(false);
    });

    it('is true once the dormancy window elapses', () => {
        expect(isIdentityDormant(IDENTITY_DORMANCY_DAYS)).to.equal(true);
        expect(isIdentityDormant(90)).to.equal(true);
    });

    it('is false when the user has never voted, since there is nothing to lapse from', () => {
        expect(isIdentityDormant(null)).to.equal(false);
    });
});
