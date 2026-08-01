import { expect } from 'chai';
import { IdentityStages } from '../src/config/habits/identityProgression';
import {
    IdentityReflectionTypes,
    IDENTITY_REFLECTION_PROMPTS,
    selectReflectionPrompt,
} from '../src/config/habits/identityReflections';

describe('selectReflectionPrompt', () => {
    it('stays quiet at INTENTION, before there is anything to reflect on', () => {
        const prompt = selectReflectionPrompt({
            stage: IdentityStages.INTENTION,
            isComeback: false,
            daysSinceByType: {},
        });
        expect(prompt).to.equal(null);
    });

    it('asks "why" first once the behavior is repeating', () => {
        const prompt = selectReflectionPrompt({
            stage: IdentityStages.REPETITION,
            isComeback: false,
            daysSinceByType: {},
        });
        expect(prompt?.type).to.equal(IdentityReflectionTypes.WHY);
    });

    it('preempts everything with recommitment on the check-in that ends a lapse', () => {
        const prompt = selectReflectionPrompt({
            stage: IdentityStages.MINDSET,
            isComeback: true,
            daysSinceByType: {},
        });
        expect(prompt?.type).to.equal(IdentityReflectionTypes.RECOMMITMENT);
    });

    it('does not ask about recommitment when nothing was interrupted', () => {
        const prompt = selectReflectionPrompt({
            stage: IdentityStages.MINDSET,
            isComeback: false,
            daysSinceByType: {},
        });
        expect(prompt?.type).to.not.equal(IdentityReflectionTypes.RECOMMITMENT);
    });

    it('falls through to the next prompt when recommitment is still cooling down', () => {
        const prompt = selectReflectionPrompt({
            stage: IdentityStages.AUTOMATICITY,
            isComeback: true,
            daysSinceByType: { [IdentityReflectionTypes.RECOMMITMENT]: 2 },
        });
        expect(prompt?.type).to.equal(IdentityReflectionTypes.SELF_CONCEPT);
    });

    it('withholds the self-concept scale until the habit shows automaticity', () => {
        const prompt = selectReflectionPrompt({
            stage: IdentityStages.REPETITION,
            isComeback: false,
            daysSinceByType: { [IdentityReflectionTypes.WHY]: 1 },
        });
        expect(prompt).to.equal(null);
    });

    it('re-asks a prompt only after its cooldown elapses', () => {
        const cooldown = IDENTITY_REFLECTION_PROMPTS[IdentityReflectionTypes.SELF_CONCEPT].cooldownDays;
        const context = {
            stage: IdentityStages.AUTOMATICITY,
            isComeback: false,
            daysSinceByType: {
                [IdentityReflectionTypes.WHY]: 1,
                [IdentityReflectionTypes.OBSTACLE]: 1,
            },
        };

        expect(selectReflectionPrompt({
            ...context,
            daysSinceByType: { ...context.daysSinceByType, [IdentityReflectionTypes.SELF_CONCEPT]: cooldown - 1 },
        })).to.equal(null);

        expect(selectReflectionPrompt({
            ...context,
            daysSinceByType: { ...context.daysSinceByType, [IdentityReflectionTypes.SELF_CONCEPT]: cooldown },
        })?.type).to.equal(IdentityReflectionTypes.SELF_CONCEPT);
    });

    it('never returns a partner-authored prompt to the habit owner', () => {
        const prompts = [
            IdentityStages.REPETITION,
            IdentityStages.AUTOMATICITY,
            IdentityStages.MINDSET,
            IdentityStages.IDENTITY,
        ].map((stage) => selectReflectionPrompt({ stage, isComeback: false, daysSinceByType: {} }));

        prompts.forEach((prompt) => {
            expect(prompt?.type).to.not.equal(IdentityReflectionTypes.PARTNER_AFFIRMATION);
        });
    });
});
