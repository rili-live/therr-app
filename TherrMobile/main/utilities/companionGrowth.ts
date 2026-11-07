import { isAchievementClassEnabledForBrand } from 'therr-js-utilities/config';

/**
 * Habit companion — a pixel-art chameleon that grows as the account does.
 *
 * Growth is derived, never stored: the stage is a pure function of two things the client
 * already holds, the user's completed achievements (`user.achievements`) and the account's
 * age (`user.details.createdAt`). Nothing new is persisted or sent to the backend, so the
 * stage ladder below can be re-tuned freely and every user is re-evaluated on next render.
 *
 * Each stage past the first requires BOTH a number of completed achievements AND a minimum
 * account age. Achievements make growth reflect effort; the age floor makes it reflect
 * staying power, so a burst of first-week achievements cannot rush the chameleon to its
 * final form. Hatching is the exception — it has no age floor, so the egg hatches on the
 * user's very first win.
 *
 * To add stages later: append to COMPANION_STAGES (keep both thresholds non-decreasing),
 * add a sprite for the new id in components/HabitCompanion/sprites.ts, and add its
 * name/caption to the three locale dictionaries under `components.habitCompanion.stages`.
 */

export type CompanionStageId = 'egg' | 'hatchling' | 'juvenile' | 'adult' | 'champion';

export interface ICompanionStage {
    id: CompanionStageId;
    minAchievements: number;
    minAccountAgeDays: number;
}

export const COMPANION_STAGES: ReadonlyArray<ICompanionStage> = [
    { id: 'egg', minAchievements: 0, minAccountAgeDays: 0 },
    { id: 'hatchling', minAchievements: 1, minAccountAgeDays: 0 },
    { id: 'juvenile', minAchievements: 4, minAccountAgeDays: 7 },
    { id: 'adult', minAchievements: 12, minAccountAgeDays: 30 },
    { id: 'champion', minAchievements: 25, minAccountAgeDays: 90 },
];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface ICompanionRequirementProgress {
    current: number;
    required: number;
    isMet: boolean;
}

export interface ICompanionGrowth {
    stage: ICompanionStage;
    stageIndex: number;
    stageCount: number;
    completedAchievements: number;
    accountAgeDays: number;
    nextStage: ICompanionStage | null;
    // Absent at the final stage.
    nextAchievements?: ICompanionRequirementProgress;
    nextAccountAge?: ICompanionRequirementProgress;
    // 0..1 progress from the current stage toward the next; 1 at the final stage. The slower
    // of the two requirements decides it, so the bar never claims more than is actually done.
    progressToNext: number;
}

/**
 * Whole days since the account was created. An unknown or unparseable date counts as a
 * brand-new account (0) rather than throwing — the card must render for a user whose
 * `details` have not loaded yet.
 */
export const getAccountAgeDays = (createdAt: string | number | Date | undefined | null, now: number = Date.now()): number => {
    if (!createdAt) return 0;
    const createdMs = new Date(createdAt).getTime();
    if (!Number.isFinite(createdMs)) return 0;
    return Math.max(0, Math.floor((now - createdMs) / MS_PER_DAY));
};

/**
 * Counts completed achievements in classes this brand can earn. The list the backend
 * returns is already brand-scoped; the class check is a second guard so a cached row from
 * another brand (the `user` slice is persisted) can never feed the companion.
 */
export const countCompletedAchievements = (
    achievements: { [key: string]: any } | undefined | null,
    brandVariation: string,
): number => Object.values(achievements || {})
    .filter((ach: any) => !!ach?.completedAt
        && !!ach?.achievementClass
        && isAchievementClassEnabledForBrand(ach.achievementClass, brandVariation))
    .length;

const ratioBetween = (value: number, from: number, to: number): number => {
    if (to <= from) return 1;
    return Math.max(0, Math.min(1, (value - from) / (to - from)));
};

export const getCompanionGrowth = ({
    achievements,
    accountCreatedAt,
    brandVariation,
    now = Date.now(),
}: {
    achievements: { [key: string]: any } | undefined | null;
    accountCreatedAt: string | number | Date | undefined | null;
    brandVariation: string;
    now?: number;
}): ICompanionGrowth => {
    const completedAchievements = countCompletedAchievements(achievements, brandVariation);
    const accountAgeDays = getAccountAgeDays(accountCreatedAt, now);

    // Stages are climbed in order, so a user who somehow meets a later stage's bar but not
    // an earlier one's stays at the earlier one. Thresholds are non-decreasing, so in
    // practice this is the same as "highest stage met".
    let stageIndex = 0;
    for (let i = 1; i < COMPANION_STAGES.length; i += 1) {
        const candidate = COMPANION_STAGES[i];
        if (completedAchievements >= candidate.minAchievements && accountAgeDays >= candidate.minAccountAgeDays) {
            stageIndex = i;
        } else {
            break;
        }
    }

    const stage = COMPANION_STAGES[stageIndex];
    const nextStage = COMPANION_STAGES[stageIndex + 1] || null;

    if (!nextStage) {
        return {
            stage,
            stageIndex,
            stageCount: COMPANION_STAGES.length,
            completedAchievements,
            accountAgeDays,
            nextStage: null,
            progressToNext: 1,
        };
    }

    const nextAchievements = {
        current: completedAchievements,
        required: nextStage.minAchievements,
        isMet: completedAchievements >= nextStage.minAchievements,
    };
    const nextAccountAge = {
        current: accountAgeDays,
        required: nextStage.minAccountAgeDays,
        isMet: accountAgeDays >= nextStage.minAccountAgeDays,
    };

    return {
        stage,
        stageIndex,
        stageCount: COMPANION_STAGES.length,
        completedAchievements,
        accountAgeDays,
        nextStage,
        nextAchievements,
        nextAccountAge,
        progressToNext: Math.min(
            ratioBetween(completedAchievements, stage.minAchievements, nextStage.minAchievements),
            ratioBetween(accountAgeDays, stage.minAccountAgeDays, nextStage.minAccountAgeDays),
        ),
    };
};
