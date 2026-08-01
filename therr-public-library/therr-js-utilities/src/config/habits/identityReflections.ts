/**
 * Reflection prompts — the "mindset" layer of the HABITS identity ladder.
 *
 * The habit -> mindset -> identity sequence has a gap in the middle that software
 * usually skips: a check-in records that a behavior happened, and a badge records
 * that it happened a lot, but neither records that the user started thinking about
 * themselves differently. Reflections are that missing evidence. They are short,
 * rare, and asked at moments when the answer is actually available — not on a fixed
 * cadence that trains people to dismiss them.
 *
 * Deliberately conservative: at most one prompt per check-in, and the cooldown in
 * `shouldPromptReflection` is measured in weeks. A prompt the user swipes away is
 * worse than no prompt, because it teaches them the app's questions are noise.
 */

import { IdentityStages } from './identityProgression';

enum IdentityReflectionTypes {
    /**
     * "Which sounds truer: I'm trying to run / I'm a runner?" — a 1..5 scale.
     * The only reflection that gates the top rung, because it is the one that
     * measures self-concept rather than circumstance.
     */
    SELF_CONCEPT = 'self_concept',
    /** "Why does this matter to you?" — asked early, re-read later. */
    WHY = 'why',
    /** "What gets in the way?" — asked once effort starts dropping. */
    OBSTACLE = 'obstacle',
    /** Asked on the check-in that ends a lapse. The highest-value moment we have. */
    RECOMMITMENT = 'recommitment',
    /** Written by the pact partner about the user. The outside witness. */
    PARTNER_AFFIRMATION = 'partner_affirmation',
}

type IdentityReflectionType = `${IdentityReflectionTypes}`;

/** What kind of answer the client should collect. */
type IdentityReflectionResponseFormat = 'scale' | 'text';

interface IIdentityReflectionPrompt {
    type: IdentityReflectionTypes;
    responseFormat: IdentityReflectionResponseFormat;
    /**
     * i18n key suffix under `pages.habits.identity.prompts.<key>`. Stable — it is
     * persisted on the reflection row so old answers keep their question.
     */
    promptKey: string;
    /** Earliest stage at which this prompt is appropriate. */
    minStage: IdentityStages;
    /** Days before the same prompt type may be asked again. */
    cooldownDays: number;
    /** Written by the partner rather than the habit owner. */
    isPartnerAuthored?: boolean;
}

const IDENTITY_REFLECTION_PROMPTS: { [type in IdentityReflectionTypes]: IIdentityReflectionPrompt } = {
    [IdentityReflectionTypes.WHY]: {
        type: IdentityReflectionTypes.WHY,
        responseFormat: 'text',
        promptKey: 'why',
        minStage: IdentityStages.REPETITION,
        cooldownDays: 90,
    },
    [IdentityReflectionTypes.RECOMMITMENT]: {
        type: IdentityReflectionTypes.RECOMMITMENT,
        responseFormat: 'text',
        promptKey: 'recommitment',
        minStage: IdentityStages.REPETITION,
        cooldownDays: 14,
    },
    [IdentityReflectionTypes.OBSTACLE]: {
        type: IdentityReflectionTypes.OBSTACLE,
        responseFormat: 'text',
        promptKey: 'obstacle',
        minStage: IdentityStages.AUTOMATICITY,
        cooldownDays: 60,
    },
    [IdentityReflectionTypes.SELF_CONCEPT]: {
        type: IdentityReflectionTypes.SELF_CONCEPT,
        responseFormat: 'scale',
        promptKey: 'selfConcept',
        minStage: IdentityStages.AUTOMATICITY,
        cooldownDays: 30,
    },
    [IdentityReflectionTypes.PARTNER_AFFIRMATION]: {
        type: IdentityReflectionTypes.PARTNER_AFFIRMATION,
        responseFormat: 'text',
        promptKey: 'partnerAffirmation',
        minStage: IdentityStages.REPETITION,
        cooldownDays: 14,
        isPartnerAuthored: true,
    },
};

interface IReflectionPromptContext {
    stage: IdentityStages;
    /** True on the check-in that ends a lapse. Outranks everything else. */
    isComeback: boolean;
    /** Days since each type was last answered; missing key = never answered. */
    daysSinceByType: { [type: string]: number };
}

/**
 * Order of consideration when several prompts are eligible. Recommitment first
 * because the moment passes: the check-in that ends a lapse is the only time the
 * user can tell you what brought them back, and it is the answer they will most
 * want to re-read the next time they slip.
 */
const REFLECTION_PROMPT_PRIORITY: IdentityReflectionTypes[] = [
    IdentityReflectionTypes.RECOMMITMENT,
    IdentityReflectionTypes.SELF_CONCEPT,
    IdentityReflectionTypes.WHY,
    IdentityReflectionTypes.OBSTACLE,
];

/**
 * Pick at most one prompt to show after a check-in, or null to stay quiet.
 *
 * Partner-authored prompts are never returned here — they are offered to the
 * partner from the pact screen, not to the habit owner after their own check-in.
 */
const selectReflectionPrompt = (
    context: IReflectionPromptContext,
): IIdentityReflectionPrompt | null => {
    const eligible = REFLECTION_PROMPT_PRIORITY
        .map((type) => IDENTITY_REFLECTION_PROMPTS[type])
        .filter((prompt) => !prompt.isPartnerAuthored)
        .filter((prompt) => context.stage >= prompt.minStage)
        .filter((prompt) => {
            const daysSince = context.daysSinceByType[prompt.type];
            return daysSince === undefined || daysSince === null || daysSince >= prompt.cooldownDays;
        });

    if (!eligible.length) {
        return null;
    }

    const recommitment = eligible.find((p) => p.type === IdentityReflectionTypes.RECOMMITMENT);
    if (context.isComeback && recommitment) {
        return recommitment;
    }

    // Off a comeback, recommitment has no moment to attach to — skip to the rest.
    return eligible.find((p) => p.type !== IdentityReflectionTypes.RECOMMITMENT) || null;
};

export {
    IdentityReflectionTypes,
    IdentityReflectionType,
    IdentityReflectionResponseFormat,
    IIdentityReflectionPrompt,
    IReflectionPromptContext,
    IDENTITY_REFLECTION_PROMPTS,
    REFLECTION_PROMPT_PRIORITY,
    selectReflectionPrompt,
};
