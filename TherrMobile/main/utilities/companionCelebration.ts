import AsyncStorage from '@react-native-async-storage/async-storage';
import { COMPANION_STAGES, CompanionStageId, getCompanionGrowth } from './companionGrowth';

/**
 * Decides when the habit companion's stage-up celebration is owed.
 *
 * The companion's stage is derived on the client (utilities/companionGrowth.ts) — nothing about
 * it is stored on the server — so "has the user seen this stage yet?" is remembered here, on the
 * device, per user. That has two consequences worth knowing:
 *
 * - A user on two phones sees each stage-up once per phone. Harmless for a one-off "your
 *   chameleon grew" moment, and the price of keeping the ladder re-tunable with no backend.
 * - With nothing remembered yet (first launch of a build carrying this, a reinstall, a new
 *   phone) the current stage is recorded as the baseline and NOT celebrated. Celebrating it
 *   would congratulate an existing user on growth they never watched happen, and a reinstall
 *   would replay it.
 *
 * Callers must only evaluate once this session's achievements fetch has landed: the persisted
 * `user` slice can hold a stale or empty achievement list at launch, and a baseline recorded from
 * that would turn the real list's arrival into a false multi-stage jump.
 */

const STORAGE_KEY_PREFIX = 'therr.habitCompanion.seenStage.';

export interface ICompanionStageUp {
    /** The stage reached — the one to celebrate. */
    stageId: CompanionStageId;
    stageIndex: number;
    /** The last stage this device showed. Can be more than one step back after a long absence. */
    fromStageId: CompanionStageId;
    fromStageIndex: number;
}

const storageKey = (userId: string) => `${STORAGE_KEY_PREFIX}${userId}`;

/**
 * Pure decision. `seenStageIndex` is null when nothing has been recorded for this user on this
 * device. Returns the stage-up to celebrate, or null when nothing is owed.
 */
export const getOwedStageUp = (seenStageIndex: number | null, currentStageIndex: number): ICompanionStageUp | null => {
    if (seenStageIndex === null || !Number.isInteger(seenStageIndex)) {
        return null;
    }
    // Stages only go down if achievements are removed; that is not a moment to mark either way.
    if (currentStageIndex <= seenStageIndex) {
        return null;
    }
    const stage = COMPANION_STAGES[currentStageIndex];
    const fromIndex = Math.max(0, Math.min(seenStageIndex, COMPANION_STAGES.length - 1));
    if (!stage) {
        return null;
    }
    return {
        stageId: stage.id,
        stageIndex: currentStageIndex,
        fromStageId: COMPANION_STAGES[fromIndex].id,
        fromStageIndex: fromIndex,
    };
};

export const loadSeenStageIndex = async (userId: string): Promise<number | null> => {
    try {
        const raw = await AsyncStorage.getItem(storageKey(userId));
        if (raw === null || raw === undefined) return null;
        const parsed = Number.parseInt(raw, 10);
        return Number.isInteger(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

/** Records a stage as seen. Never lowers what is stored, so an out-of-order write cannot replay a stage. */
export const markStageSeen = async (userId: string, stageIndex: number): Promise<void> => {
    try {
        const current = await loadSeenStageIndex(userId);
        if (current !== null && current >= stageIndex) return;
        await AsyncStorage.setItem(storageKey(userId), String(stageIndex));
    } catch {
        // Best-effort: failing to remember costs at most one repeat celebration.
    }
};

/**
 * Evaluates the user's companion and returns the stage-up owed, recording a baseline (and
 * returning null) when this device has never seen a stage for this user. Never throws.
 */
export const checkCompanionStageUp = async ({
    userId,
    achievements,
    accountCreatedAt,
    brandVariation,
    now = Date.now(),
}: {
    userId: string | undefined | null;
    achievements: { [key: string]: any } | undefined | null;
    accountCreatedAt: string | number | Date | undefined | null;
    brandVariation: string;
    now?: number;
}): Promise<ICompanionStageUp | null> => {
    if (!userId) return null;
    const { stageIndex } = getCompanionGrowth({ achievements, accountCreatedAt, brandVariation, now });
    const seen = await loadSeenStageIndex(userId);
    if (seen === null) {
        await markStageSeen(userId, stageIndex);
        return null;
    }
    return getOwedStageUp(seen, stageIndex);
};
