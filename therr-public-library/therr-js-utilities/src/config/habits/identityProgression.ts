/**
 * Identity progression for the HABITS app ("Friends with Habits").
 *
 * Behavior change runs habit -> mindset -> identity: repetition produces a shift in
 * how you think, and the durable change is the shift in who you believe you are.
 * Streaks only measure the first layer, and they measure it brittly — one missed day
 * zeroes the number that was carrying the user's motivation.
 *
 * This module models the other two layers. It is deliberately pure and isomorphic:
 * the users-service computes a stage when a check-in lands, and the mobile client
 * renders the same ladder and the same "what's left" hints without a round trip.
 * Both sides must agree on the thresholds or the UI promises a rung the server
 * won't grant.
 *
 * Two invariants make the ladder trustworthy:
 *
 * 1. Every rung is gated on a DIFFERENT KIND of evidence, not on more of the same
 *    counter. Volume alone advances nobody past Repetition. A user cannot reach
 *    Identity by checking in twice a day for a month, because the later rungs ask
 *    for elapsed time, a recovered miss, a self-report, and an outside witness.
 * 2. Progress RATCHETS. `votesCast` never resets and a stage is never revoked (see
 *    `evaluateIdentityStage`'s `currentStage` floor). A missed day costs a streak;
 *    it must not cost an identity, because "I'm the kind of person who does this"
 *    surviving a lapse is the entire mechanism we're trying to build.
 */

/**
 * Rungs of the ladder. Stored as an integer so the DB column stays cheap to index
 * and comparisons (`stage >= MINDSET`) stay obvious. Values are permanent — a
 * persisted row means nothing if these renumber.
 */
enum IdentityStages {
    /** Named the person they want to become; little or no behavior yet. */
    INTENTION = 0,
    /** The behavior is happening on purpose, and it still takes effort. */
    REPETITION = 1,
    /** The behavior costs less than it used to. Effort is dropping. */
    AUTOMATICITY = 2,
    /** They think about it differently — and it has survived a miss. */
    MINDSET = 3,
    /** They say it about themselves, over time, and someone else says it too. */
    IDENTITY = 4,
}

type IdentityStage = IdentityStages;

/** Ordered low -> high. Iteration order matters: `evaluateIdentityStage` walks it. */
const IDENTITY_STAGE_ORDER: IdentityStages[] = [
    IdentityStages.INTENTION,
    IdentityStages.REPETITION,
    IdentityStages.AUTOMATICITY,
    IdentityStages.MINDSET,
    IdentityStages.IDENTITY,
];

/**
 * Stable i18n key suffixes. Clients look up
 * `pages.habits.identity.stages.<key>.{title,blurb}` — never render the enum name.
 */
const IDENTITY_STAGE_KEYS: { [stage in IdentityStages]: string } = {
    [IdentityStages.INTENTION]: 'intention',
    [IdentityStages.REPETITION]: 'repetition',
    [IdentityStages.AUTOMATICITY]: 'automaticity',
    [IdentityStages.MINDSET]: 'mindset',
    [IdentityStages.IDENTITY]: 'identity',
};

/**
 * The evidence a stage decision is made from. Every field is derived from data the
 * app already collects (check-ins, difficulty ratings, streak history) except the
 * two reflection fields, which come from prompts this feature adds.
 */
interface IIdentityEvidence {
    /** Has the user written the identity statement ("someone who runs")? */
    hasIdentityLabel: boolean;
    /** Completed check-ins, all time. Monotonic — never reset by a miss. */
    votesCast: number;
    /** Completed / scheduled over the trailing window, 0..1. */
    consistencyRatio: number;
    /** Distinct ISO weeks with at least one vote. Defeats cramming. */
    distinctWeeksActive: number;
    /** Mean `difficultyRating` (1..5) of recent rated check-ins; null when unrated. */
    meanRecentDifficulty: number | null;
    /** Reflection prompts the user has answered for this habit. */
    reflectionCount: number;
    /** Times they missed and came back. Untested habits don't reach Mindset. */
    comebackCount: number;
    /** Days since the first vote. Identity is not available at any speed. */
    daysSinceFirstVote: number;
    /** Latest self-concept answer, 1..5 ("I'm trying" -> "I am"); null if never asked. */
    selfConceptScore: number | null;
    /** Times a pact partner affirmed the identity. The outside witness. */
    partnerAffirmationCount: number;
}

type EvidenceKey = keyof IIdentityEvidence;

type RequirementComparison = 'gte' | 'lte';

interface IStageRequirementSpec {
    /** Evidence field this requirement reads. Doubles as the i18n key suffix. */
    key: EvidenceKey;
    comparison: RequirementComparison;
    threshold: number;
    /**
     * Worst possible value, used only to scale partial progress on `lte`
     * requirements (where "further from the threshold" means less progress).
     */
    worst?: number;
}

/** A requirement resolved against a user's evidence. */
interface IIdentityRequirement extends IStageRequirementSpec {
    /** null when the evidence has never been collected (e.g. no rated check-ins). */
    actual: number | null;
    isMet: boolean;
    /** 0..1 partial credit, for progress bars. */
    progress: number;
}

interface IIdentityStageEvaluation {
    stage: IdentityStages;
    stageKey: string;
    /** null once the user is at IDENTITY. */
    nextStage: IdentityStages | null;
    nextStageKey: string | null;
    /** Requirements for `nextStage`; empty at the top of the ladder. */
    requirements: IIdentityRequirement[];
    /** 0..100 toward `nextStage`; 100 at the top. */
    progressToNextStage: number;
    /** Requirements still unmet, worst-progress first — the "what's left" hint. */
    unmetRequirements: IIdentityRequirement[];
}

/**
 * Requirements to ENTER each stage. INTENTION has none — naming the goal is enough
 * to be on the ladder.
 *
 * The numbers are intentionally not round-number theater. Notes on the ones that
 * carry real weight:
 *  - 21 votes is the folk "21 days" figure and is a fine floor, but on its own it
 *    predicts nothing, which is why AUTOMATICITY also demands a consistency ratio
 *    and week spread.
 *  - `meanRecentDifficulty <= 2.5` is the automaticity signal that matters: the
 *    same act reported as easier over time. Habit strength is effort going down,
 *    not repetitions going up.
 *  - `comebackCount >= 1` is the deliberate one. A habit that has never been
 *    interrupted has never been tested, and the user has no evidence that a lapse
 *    isn't a collapse. We require them to have survived one before we call it a
 *    mindset.
 *  - `partnerAffirmationCount >= 1` is the app's whole thesis applied to the top
 *    rung. Self-concept is socially confirmed; the pact partner is the mirror.
 */
const IDENTITY_STAGE_REQUIREMENTS: { [stage in IdentityStages]: IStageRequirementSpec[] } = {
    [IdentityStages.INTENTION]: [],
    [IdentityStages.REPETITION]: [
        { key: 'hasIdentityLabel', comparison: 'gte', threshold: 1 },
        { key: 'votesCast', comparison: 'gte', threshold: 5 },
    ],
    [IdentityStages.AUTOMATICITY]: [
        { key: 'votesCast', comparison: 'gte', threshold: 21 },
        { key: 'consistencyRatio', comparison: 'gte', threshold: 0.6 },
        { key: 'distinctWeeksActive', comparison: 'gte', threshold: 3 },
    ],
    [IdentityStages.MINDSET]: [
        { key: 'votesCast', comparison: 'gte', threshold: 42 },
        {
            key: 'meanRecentDifficulty', comparison: 'lte', threshold: 2.5, worst: 5,
        },
        { key: 'reflectionCount', comparison: 'gte', threshold: 1 },
        { key: 'comebackCount', comparison: 'gte', threshold: 1 },
    ],
    [IdentityStages.IDENTITY]: [
        { key: 'votesCast', comparison: 'gte', threshold: 66 },
        { key: 'daysSinceFirstVote', comparison: 'gte', threshold: 90 },
        { key: 'selfConceptScore', comparison: 'gte', threshold: 4 },
        { key: 'partnerAffirmationCount', comparison: 'gte', threshold: 1 },
    ],
};

/**
 * Days without a vote before the UI treats a habit as dormant. Dormancy is a
 * DISPLAY state only — it never lowers `stage` or clears `votesCast`. It exists so
 * a lapsed user is greeted with "you're still someone who runs, and it's been a
 * while" instead of a stage demotion that confirms their worst read of themselves.
 */
const IDENTITY_DORMANCY_DAYS = 21;

/**
 * How many of the most recent rated check-ins feed `meanRecentDifficulty`.
 * Recent, because the whole point is the trend.
 */
const IDENTITY_DIFFICULTY_SAMPLE_SIZE = 10;

/** Trailing window for `consistencyRatio`, in days. Four weeks of behavior. */
const IDENTITY_CONSISTENCY_WINDOW_DAYS = 28;

/** Bounds of the self-concept prompt ("I'm trying to be" .. "I am"). */
const SELF_CONCEPT_MIN_SCORE = 1;
const SELF_CONCEPT_MAX_SCORE = 5;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const evidenceValue = (evidence: IIdentityEvidence, key: EvidenceKey): number | null => {
    const raw = evidence[key];
    if (typeof raw === 'boolean') {
        return raw ? 1 : 0;
    }
    if (raw === null || raw === undefined || Number.isNaN(raw as number)) {
        return null;
    }
    return raw as number;
};

const resolveRequirement = (
    spec: IStageRequirementSpec,
    evidence: IIdentityEvidence,
): IIdentityRequirement => {
    const actual = evidenceValue(evidence, spec.key);

    // Missing evidence is not partial credit. A habit with no rated check-ins has
    // shown no drop in effort, so it should read 0% toward the automaticity rung
    // rather than inheriting a flattering default.
    if (actual === null) {
        return {
            ...spec, actual: null, isMet: false, progress: 0,
        };
    }

    if (spec.comparison === 'lte') {
        const worst = spec.worst ?? Math.max(actual, spec.threshold);
        const span = worst - spec.threshold;
        return {
            ...spec,
            actual,
            isMet: actual <= spec.threshold,
            progress: span > 0 ? clamp((worst - actual) / span, 0, 1) : Number(actual <= spec.threshold),
        };
    }

    return {
        ...spec,
        actual,
        isMet: actual >= spec.threshold,
        progress: spec.threshold > 0 ? clamp(actual / spec.threshold, 0, 1) : 1,
    };
};

const getStageRequirements = (
    stage: IdentityStages,
    evidence: IIdentityEvidence,
): IIdentityRequirement[] => (IDENTITY_STAGE_REQUIREMENTS[stage] || [])
    .map((spec) => resolveRequirement(spec, evidence));

/**
 * Resolve the stage a user's evidence earns.
 *
 * Walks the ladder from the bottom and stops at the first rung whose requirements
 * are not all met, so stages can never be skipped — every rung below the awarded
 * one is guaranteed satisfied. `currentStage` acts as a floor: a stage already
 * earned is never taken back, even if the trailing-window evidence that earned it
 * has since decayed.
 */
const evaluateIdentityStage = (
    evidence: IIdentityEvidence,
    currentStage: IdentityStages = IdentityStages.INTENTION,
): IIdentityStageEvaluation => {
    let earned = IdentityStages.INTENTION;

    // Skip INTENTION (index 0) — it has no requirements and is the floor.
    for (let i = 1; i < IDENTITY_STAGE_ORDER.length; i += 1) {
        const candidate = IDENTITY_STAGE_ORDER[i];
        const isEarned = getStageRequirements(candidate, evidence).every((req) => req.isMet);
        if (!isEarned) {
            break;
        }
        earned = candidate;
    }

    const stage = Math.max(earned, currentStage) as IdentityStages;
    const nextStage = stage >= IdentityStages.IDENTITY ? null : ((stage + 1) as IdentityStages);
    const requirements = nextStage === null ? [] : getStageRequirements(nextStage, evidence);
    const progressToNextStage = requirements.length === 0
        ? 100
        : Math.round((requirements.reduce((sum, req) => sum + req.progress, 0) / requirements.length) * 100);

    return {
        stage,
        stageKey: IDENTITY_STAGE_KEYS[stage],
        nextStage,
        nextStageKey: nextStage === null ? null : IDENTITY_STAGE_KEYS[nextStage],
        requirements,
        progressToNextStage,
        unmetRequirements: requirements
            .filter((req) => !req.isMet)
            .sort((a, b) => a.progress - b.progress),
    };
};

/**
 * Dormant = no vote in `IDENTITY_DORMANCY_DAYS`. Display-only; see the constant.
 */
const isIdentityDormant = (daysSinceLastVote: number | null): boolean => daysSinceLastVote !== null
    && daysSinceLastVote >= IDENTITY_DORMANCY_DAYS;

export {
    IdentityStages,
    IdentityStage,
    IDENTITY_STAGE_ORDER,
    IDENTITY_STAGE_KEYS,
    IDENTITY_STAGE_REQUIREMENTS,
    IDENTITY_DORMANCY_DAYS,
    IDENTITY_DIFFICULTY_SAMPLE_SIZE,
    IDENTITY_CONSISTENCY_WINDOW_DAYS,
    SELF_CONCEPT_MIN_SCORE,
    SELF_CONCEPT_MAX_SCORE,
    IIdentityEvidence,
    IIdentityRequirement,
    IIdentityStageEvaluation,
    IStageRequirementSpec,
    evaluateIdentityStage,
    getStageRequirements,
    isIdentityDormant,
};
