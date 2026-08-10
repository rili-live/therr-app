import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import { IHabitPhaseRow } from '../store/HabitPhasesStore';
import {
    evaluateHabitPhase,
    daysBetween,
    ESTABLISH_WINDOW_DAYS,
    AUTOMATICITY_WINDOW_DAYS,
    HabitPhase,
    IPhaseDecision,
} from './habitPhaseEngine';
import { normalizeDateString } from './streakHelpers';

/**
 * Batch loader that turns the digest's list of (user, habit) pairs into one
 * lifecycle decision each. See docs/HABIT_LIFECYCLE_MESSAGING.md.
 *
 * WHY A PRE-PASS AND NOT A LOOKUP INSIDE THE PACT LOOP
 *
 * The engine needs four facts per pair: the stored phase row, the habit's age,
 * and completed check-in counts over two trailing windows. Fetched inside the
 * existing per-member loop that is four queries per member per pact — and the
 * digest's whole sequential structure exists to keep read-pool pressure flat,
 * so quietly making it O(4·members·pacts) would undo that. Fetched here it is
 * four queries per run, whatever the pact count.
 *
 * Keys are `${userId}:${habitGoalId}` throughout: the lifecycle belongs to the
 * habit, not to the pact. A user pursuing one goal through two pacts has one
 * phase, gets one taper and one maintenance check-in — which is also why the
 * dedupe keys the digest writes for these are keyed on habitGoalId and never on
 * pactId.
 */

export interface IHabitPair {
    userId: string;
    habitGoalId: string;
}

export interface IHabitLifecycleContext {
    decisions: Record<string, IPhaseDecision>;
    rows: Record<string, IHabitPhaseRow>;
    /** Best-ever streak per pair, for comeback copy that cites a past success. */
    bestStreaks: Record<string, number>;
    /** Habit age in days per pair, for milestone copy. */
    ages: Record<string, number>;
}

export const EMPTY_LIFECYCLE_CONTEXT: IHabitLifecycleContext = {
    decisions: {},
    rows: {},
    bestStreaks: {},
    ages: {},
};

export const pairKey = (userId: string, habitGoalId: string): string => `${userId}:${habitGoalId}`;

/**
 * The engine is off by default.
 *
 * It deploys dark for the same reason the queue worker does, but the stakes are
 * the mirror image: the worker's flag guards against sending too much, this one
 * guards against sending too little. Turning it on *removes* reminders from
 * users who currently get them daily, so it wants a deliberate flip and a
 * cohort to watch, not a silent behaviour change riding along with a deploy.
 */
export const isPhaseEngineEnabled = (): boolean => process.env.HABIT_PHASE_ENGINE_ENABLED === 'true';

const shiftDate = (date: string, days: number): string => normalizeDateString(
    new Date(Date.parse(`${date}T00:00:00.000Z`) + (days * 24 * 60 * 60 * 1000)),
);

/**
 * Load and evaluate every pair. Never throws: a lifecycle lookup that fails
 * must not take down the digest's core partner-accountability notifications, so
 * a failure yields an empty context and the digest falls back to its existing
 * un-tapered behaviour — the safe direction, since it over-reminds rather than
 * going silent.
 */
export const buildHabitLifecycleContext = async (
    pairs: IHabitPair[],
    today: string,
): Promise<IHabitLifecycleContext> => {
    if (!pairs.length) {
        return EMPTY_LIFECYCLE_CONTEXT;
    }

    try {
        const shortStart = shiftDate(today, -(ESTABLISH_WINDOW_DAYS - 1));
        const longStart = shiftDate(today, -(AUTOMATICITY_WINDOW_DAYS - 1));

        const shortTargets = pairs.map((p) => ({
            key: `s:${pairKey(p.userId, p.habitGoalId)}`,
            userId: p.userId,
            habitGoalId: p.habitGoalId,
            startDate: shortStart,
            endDate: today,
        }));
        const longTargets = pairs.map((p) => ({
            key: `l:${pairKey(p.userId, p.habitGoalId)}`,
            userId: p.userId,
            habitGoalId: p.habitGoalId,
            startDate: longStart,
            endDate: today,
        }));

        const [rows, firstDates, windowCounts, streaks] = await Promise.all([
            Store.habitPhases.getByUserHabitPairs(pairs),
            Store.habitCheckins.getFirstCompletedDates(pairs),
            Store.habitCheckins.getCompletedCountsForWindows([...shortTargets, ...longTargets]),
            Store.streaks.getByUserHabitPairs(pairs),
        ]);

        const bestStreaks: Record<string, number> = {};
        (streaks || []).forEach((streak: any) => {
            bestStreaks[pairKey(streak.userId, streak.habitGoalId)] = Number(streak.longestStreak || 0);
        });

        const decisions: Record<string, IPhaseDecision> = {};
        const ages: Record<string, number> = {};

        pairs.forEach((pair) => {
            const key = pairKey(pair.userId, pair.habitGoalId);
            const row = rows[key];
            const firstDate = firstDates[key];

            // No completed check-in yet means no habit to have a lifecycle. Age
            // 0 keeps every gate shut, which is what we want: the engine should
            // have nothing to say about a habit nobody has started.
            const habitAgeDays = firstDate ? daysBetween(firstDate, today) + 1 : 0;
            ages[key] = habitAgeDays;

            decisions[key] = evaluateHabitPhase({
                phase: (row?.phase as HabitPhase) || 'forming',
                establishedAt: row?.establishedAt ? normalizeDateString(row.establishedAt) : null,
                automaticityAt: row?.automaticityAt ? normalizeDateString(row.automaticityAt) : null,
                maintenanceStage: Number(row?.maintenanceStage || 0),
                lastComebackAt: row?.lastComebackAt ? normalizeDateString(row.lastComebackAt) : null,
                habitAgeDays,
                completionsShortWindow: Number(windowCounts[`s:${key}`] || 0),
                completionsLongWindow: Number(windowCounts[`l:${key}`] || 0),
                today,
            });
        });

        return {
            decisions, rows, bestStreaks, ages,
        };
    } catch (err: any) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [err?.message, 'Habits digest: failed to build lifecycle context'],
            traceArgs: { 'habitLifecycle.pairCount': pairs.length, source: 'users-service' },
        });
        return EMPTY_LIFECYCLE_CONTEXT;
    }
};

/**
 * Persist the outcome of a decision.
 *
 * `deliveredMaintenanceStage` / `deliveredComeback` are passed separately from
 * the decision on purpose: they record what the queue actually accepted. A
 * notification that failed to enqueue must NOT advance the stored stage or the
 * comeback timestamp, because that would consume the user's one chance at a
 * notification nobody ever sent. Phase transitions are the opposite — they
 * reflect what is true about the habit regardless of whether we managed to
 * announce it, so they persist either way.
 */
export const persistPhaseDecision = async (
    userId: string,
    habitGoalId: string,
    decision: IPhaseDecision,
    today: string,
    delivered: { maintenanceStage?: number; comeback?: boolean },
): Promise<void> => {
    const needsWrite = decision.transitioned
        || delivered.maintenanceStage !== undefined
        || delivered.comeback;
    if (!needsWrite) return;

    const row = await Store.habitPhases.getOrCreate(userId, habitGoalId);
    if (!row) return;

    if (decision.transitioned) {
        const update: Record<string, any> = { phase: decision.nextPhase };

        if (decision.milestone === 'established') {
            // The taper anchor, and a fresh maintenance cycle. Resetting the
            // stage is what lets someone who lapsed and rebuilt receive the
            // 30/60/90 sequence again against their new establishment rather
            // than being permanently past it.
            update.establishedAt = today;
            update.maintenanceStage = 0;
            update.lapsedAt = null;
        }
        if (decision.milestone === 'automaticity') {
            update.automaticityAt = today;
        }
        if (decision.nextPhase === 'lapsed') {
            update.lapsedAt = today;
        }
        if (decision.nextPhase === 'forming') {
            // Recovering from a lapse: clear the lapse marker so a later
            // re-establishment is not read as still-lapsed.
            update.lapsedAt = null;
        }

        await Store.habitPhases.update(row.id, update);
    }

    if (delivered.comeback) {
        await Store.habitPhases.update(row.id, { lastComebackAt: today });
    }

    if (delivered.maintenanceStage !== undefined) {
        await Store.habitPhases.advanceMaintenanceStage(row.id, delivered.maintenanceStage);
    }
};
