import logSpan from 'therr-js-utilities/log-or-update-span';
import {
    IDENTITY_CONSISTENCY_WINDOW_DAYS,
    IDENTITY_DIFFICULTY_SAMPLE_SIZE,
    IIdentityReflectionPrompt,
    IIdentityStageEvaluation,
    IdentityStages,
    evaluateIdentityStage,
    isIdentityDormant,
    selectReflectionPrompt,
} from 'therr-js-utilities/config';
import Store from '../../store';
import {
    buildIdentityEvidence,
    daysBetween,
    getDaysSinceLastVote,
} from '../../utilities/identityHelpers';

export interface IIdentitySnapshot {
    progress: any;
    evaluation: IIdentityStageEvaluation;
    isDormant: boolean;
    daysSinceLastVote: number | null;
}

const windowStartDate = (endDate: string, days: number): string => {
    const end = new Date(`${endDate}T00:00:00`);
    end.setDate(end.getDate() - (days - 1));
    return end.toISOString().split('T')[0];
};

const todayString = (): string => new Date().toISOString().split('T')[0];

/**
 * Read the current identity state for a habit and re-evaluate its stage against
 * fresh evidence, without persisting anything.
 *
 * Read paths call this so the card is never stale relative to check-ins that
 * happened elsewhere (a partner's device, a backfilled check-in). The stage it
 * returns is still floored by the stored stage, so a re-evaluation can only ever
 * move a user up.
 */
export const getIdentitySnapshot = async (
    userId: string,
    habitGoalId: string,
    habitGoal: any,
    asOfDate?: string,
): Promise<IIdentitySnapshot | null> => {
    const progress = await Store.identityProgress.getByUserAndHabit(userId, habitGoalId);
    if (!progress) {
        return null;
    }

    const asOf = asOfDate || todayString();
    const [completedInWindow, distinctWeeksActive, recentDifficultyRatings] = await Promise.all([
        Store.habitCheckins.getCompletedCountForPeriod(
            userId,
            habitGoalId,
            windowStartDate(asOf, IDENTITY_CONSISTENCY_WINDOW_DAYS),
            asOf,
        ),
        Store.habitCheckins.getDistinctActiveWeekCount(userId, habitGoalId),
        Store.habitCheckins.getRecentDifficultyRatings(userId, habitGoalId, IDENTITY_DIFFICULTY_SAMPLE_SIZE),
    ]);

    const evidence = buildIdentityEvidence({
        progress,
        habitGoal: habitGoal || {},
        completedInWindow,
        distinctWeeksActive,
        recentDifficultyRatings,
        asOfDate: asOf,
    });

    const daysSinceLastVote = getDaysSinceLastVote(progress.lastVoteDate, asOf);

    return {
        progress,
        evaluation: evaluateIdentityStage(evidence, progress.stage),
        isDormant: isIdentityDormant(daysSinceLastVote),
        daysSinceLastVote,
    };
};

export interface IRecordVoteResult extends IIdentitySnapshot {
    /** Set only when this check-in moved the user up a rung. */
    stageAdvancedTo: IdentityStages | null;
    /** At most one reflection prompt for the client to surface, or null. */
    prompt: IIdentityReflectionPrompt | null;
}

/**
 * Record a completed check-in as a vote for the user's identity, re-evaluate the
 * stage, and decide whether to surface a reflection prompt.
 *
 * Called from the check-in path after the streak has been updated, so `isComeback`
 * can be passed straight through from the streak's own comeback detection rather
 * than re-derived. The counter bumps are additive and the stage only ratchets, so
 * a retried check-in cannot walk anything backwards — but the caller must still
 * only invoke this once per completed date, or votes would double-count.
 */
export const recordIdentityVote = async ({
    userId,
    habitGoalId,
    pactId,
    habitGoal,
    checkinDate,
    isComeback,
}: {
    userId: string;
    habitGoalId: string;
    pactId?: string;
    habitGoal: any;
    checkinDate: string;
    isComeback: boolean;
}): Promise<IRecordVoteResult | null> => {
    const existing = await Store.identityProgress.getOrCreate(userId, habitGoalId, pactId);

    if (isComeback) {
        await Store.identityProgress.incrementCounter(existing.id, 'comebackCount');
    }
    await Store.identityProgress.recordVote(existing.id, checkinDate);

    const snapshot = await getIdentitySnapshot(userId, habitGoalId, habitGoal, checkinDate);
    if (!snapshot) {
        return null;
    }

    const { progress, evaluation } = snapshot;
    const advanced = await Store.identityProgress.applyStage(progress, evaluation.stage);
    if (advanced && evaluation.stage === IdentityStages.IDENTITY && !progress.identityConfirmedAt) {
        await Store.identityProgress.markIdentityConfirmed(progress.id);
    }

    const latestByType = await Store.identityReflections.getLatestByType(userId, habitGoalId);
    const daysSinceByType = latestByType.reduce((acc: { [type: string]: number }, row: any) => ({
        ...acc,
        [row.reflectionType]: daysBetween(row.latestCreatedAt, checkinDate),
    }), {});

    return {
        ...snapshot,
        progress: advanced || progress,
        stageAdvancedTo: advanced ? evaluation.stage : null,
        prompt: selectReflectionPrompt({
            stage: evaluation.stage,
            isComeback,
            daysSinceByType,
        }),
    };
};

/**
 * Fire-and-forget wrapper for the check-in hot path.
 *
 * Identity progression is a secondary effect of checking in: if it fails, the
 * check-in, the streak, and the partner notification must still succeed. The
 * caller gets the result when it resolves and a logged warning when it doesn't.
 */
export const recordIdentityVoteSafely = (
    args: Parameters<typeof recordIdentityVote>[0],
): Promise<IRecordVoteResult | null> => recordIdentityVote(args).catch((err) => {
    logSpan({
        level: 'warn',
        messageOrigin: 'API_SERVER',
        messages: ['Failed to record identity progression for check-in'],
        traceArgs: {
            'error.message': err?.message,
            userId: args.userId,
            habitGoalId: args.habitGoalId,
        },
    });
    return null;
});
