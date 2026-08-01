/**
 * Evidence assembly for the HABITS identity ladder.
 *
 * The ladder itself (rungs, thresholds, the stage decision) lives in
 * therr-js-utilities/config/habits so the mobile client evaluates the same rules.
 * This module is the server-side half: turning rows from habit_checkins and
 * identity_progress into the `IIdentityEvidence` shape that module consumes.
 *
 * Everything here is pure — DB reads happen in handlers/helpers/identityProgress.
 */

import {
    IIdentityEvidence,
    IDENTITY_CONSISTENCY_WINDOW_DAYS,
} from 'therr-js-utilities/config';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Whole days between two calendar dates, ignoring time of day. Accepts the
 * date-only strings the habits tables store as well as Date objects, and parses
 * `YYYY-MM-DD` as a local calendar date — `new Date('2026-07-22')` is UTC
 * midnight, which lands on the previous day in any timezone west of UTC and would
 * shift every span by one. Matches `normalizeDateString` in streakHelpers.
 */
const toLocalMidnight = (value: string | Date): Date => {
    if (typeof value === 'string') {
        const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (dateOnlyMatch) {
            const [, year, month, day] = dateOnlyMatch;
            return new Date(Number(year), Number(month) - 1, Number(day));
        }
    }
    const parsed = new Date(value);
    parsed.setHours(0, 0, 0, 0);
    return parsed;
};

const daysBetween = (from: string | Date, to: string | Date): number => Math.max(
    0,
    Math.round((toLocalMidnight(to).getTime() - toLocalMidnight(from).getTime()) / MS_PER_DAY),
);

export interface IHabitFrequency {
    frequencyType?: string;
    frequencyCount?: number;
    targetDaysOfWeek?: number[];
}

/**
 * How many check-ins a habit's schedule calls for over a window.
 *
 * Deliberately proportional rather than calendar-exact (counting real weekday
 * occurrences between two dates): an exact count shifts with today's weekday, so
 * a user's consistency ratio would wobble day to day without their behavior
 * changing. A stable denominator is worth more than a perfect one here.
 */
const getExpectedCheckinCount = (
    habitGoal: IHabitFrequency,
    windowDays: number = IDENTITY_CONSISTENCY_WINDOW_DAYS,
): number => {
    const weeks = windowDays / 7;
    const targetDays = habitGoal?.targetDaysOfWeek;

    if (targetDays?.length) {
        return Math.max(1, Math.round(weeks * targetDays.length));
    }

    if (habitGoal?.frequencyType === 'weekly') {
        return Math.max(1, Math.round(weeks * (habitGoal.frequencyCount || 1)));
    }

    // Daily (and any unrecognized frequency): the unique constraint on
    // habit_checkins caps completions at one per day regardless of frequencyCount.
    return Math.max(1, windowDays);
};

export interface IEvidenceInputs {
    /** The identity_progress row. */
    progress: {
        identityLabel?: string;
        votesCast?: number;
        comebackCount?: number;
        reflectionCount?: number;
        partnerAffirmationCount?: number;
        selfConceptScore?: number | null;
        firstVoteDate?: string | Date | null;
        lastVoteDate?: string | Date | null;
    };
    habitGoal: IHabitFrequency;
    /** Completed check-ins inside the trailing consistency window. */
    completedInWindow: number;
    /** Distinct calendar weeks with at least one completed check-in, all time. */
    distinctWeeksActive: number;
    /** `difficultyRating` of the most recent rated check-ins, newest first. */
    recentDifficultyRatings: number[];
    /** Injectable for tests; defaults to now. */
    asOfDate?: string | Date;
}

const mean = (values: number[]): number | null => (values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null);

/**
 * Assemble the evidence bundle the stage evaluator reads.
 */
const buildIdentityEvidence = (inputs: IEvidenceInputs): IIdentityEvidence => {
    const {
        progress,
        habitGoal,
        completedInWindow,
        distinctWeeksActive,
        recentDifficultyRatings,
    } = inputs;
    const asOf = inputs.asOfDate || new Date();
    const expectedInWindow = getExpectedCheckinCount(habitGoal);

    return {
        hasIdentityLabel: !!progress.identityLabel,
        votesCast: progress.votesCast || 0,
        // Capped: a user who checks in on unscheduled days shouldn't read as >100%
        // consistent, and an uncapped ratio would let extra volume compensate for
        // missed scheduled days — exactly what this rung is meant to prevent.
        consistencyRatio: Math.min(1, completedInWindow / expectedInWindow),
        distinctWeeksActive,
        meanRecentDifficulty: mean(recentDifficultyRatings.filter((r) => typeof r === 'number')),
        reflectionCount: progress.reflectionCount || 0,
        comebackCount: progress.comebackCount || 0,
        daysSinceFirstVote: progress.firstVoteDate ? daysBetween(progress.firstVoteDate, asOf) : 0,
        selfConceptScore: progress.selfConceptScore ?? null,
        partnerAffirmationCount: progress.partnerAffirmationCount || 0,
    };
};

/**
 * Days since the last vote, or null when the user has never checked in — there is
 * nothing to have lapsed from yet, and `isIdentityDormant` treats null as active.
 */
const getDaysSinceLastVote = (
    lastVoteDate?: string | Date | null,
    asOfDate?: string | Date,
): number | null => (lastVoteDate ? daysBetween(lastVoteDate, asOfDate || new Date()) : null);

export {
    daysBetween,
    getExpectedCheckinCount,
    buildIdentityEvidence,
    getDaysSinceLastVote,
};
