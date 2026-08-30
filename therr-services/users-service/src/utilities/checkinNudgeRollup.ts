import { PushNotifications } from 'therr-js-utilities/constants';

/**
 * Collapses a user's whole day of "go check in" nudges into one notification.
 *
 * ## Why
 *
 * The digest used to enqueue one row per habit and one per pact:
 *
 *   streak-at-risk:<pactId>:<today>          (pact loop, per pact)
 *   streak-at-risk:habit:<habitGoalId>:<today> (reminder pass, per habit)
 *   daily-habit-reminder:<habitGoalId>:<today>  (reminder pass, per habit)
 *
 * All three say the same thing, and the queue worker drains a claimed batch
 * inside one 30s tick — so someone tracking three habits across two pacts got
 * up to five near-identical pushes back to back, then hit the 5/day cap and had
 * anything timely for the rest of the day silently dropped.
 *
 * Rolling up at the *producer* is what fixes that, rather than spacing at the
 * worker: spacing three copies of the same sentence an hour apart is still
 * three copies of the same sentence.
 *
 * It also closes the double-send in docs/WORK_IN_PROGRESS.md — a habit held
 * through two pacts hit both the pact-keyed and the habit-keyed path and
 * deduped against neither, because the keys named different things. Here both
 * paths feed one accumulator keyed on the habit goal.
 *
 * ## What survives the collapse
 *
 * The framing, and the strongest number. If any habit has a live streak the
 * notification is `streakAtRisk` and cites the *longest* one at stake, because
 * that is the one whose loss the user will feel; otherwise it is
 * `dailyHabitReminder`. The rest becomes a count and a name list
 * (push-notifications-service renders at most three — see `checkinNudgeCopy`).
 */

export interface ICheckinNudgeCandidate {
    habitGoalId: string;
    /** Present when the habit is backed by a pact; selects the deep-link target. */
    pactId?: string;
    habitName: string;
    /** 0 or absent means "no live streak", which selects the reminder framing. */
    streakCount?: number;
    /** Streak freezes left. Only meaningful for a single-habit nudge. */
    freezesRemaining?: number;
}

export interface ICheckinNudgeRow {
    userId: string;
    type: PushNotifications.Types;
    payload: {
        habitName: string;
        habitCount: number;
        habitNames: string[];
        streakCount: number;
        freezesRemaining?: number;
        habitGoalId?: string;
        pactId?: string;
    };
    /** How many candidates this one row stands in for. */
    candidateCount: number;
}

/**
 * The dedupe key every rolled-up nudge uses.
 *
 * `userId` is deliberately absent: the queue's uniqueness constraint is
 * (brandVariation, userId, dedupeKey), so putting it in the key again would be
 * redundant — and a key that varied per habit is exactly what allowed the
 * duplicates this module exists to remove.
 */
export const checkinNudgeDedupeKey = (today: string): string => `checkin-nudge:${today}`;

const hasLiveStreak = (candidate: ICheckinNudgeCandidate): boolean => Number(candidate.streakCount || 0) > 0;

export const createCheckinNudgeAccumulator = () => {
    // Insertion-ordered, so the notification lists habits in the order the
    // digest walked them and two runs of the same day produce the same copy.
    const byUser = new Map<string, Map<string, ICheckinNudgeCandidate>>();

    return {
        /**
         * Records one habit that wants a nudge today.
         *
         * Keyed on the habit goal, so the same habit reached through two pacts —
         * or through both the pact loop and the reminder pass — is counted once.
         * First write wins: the pact loop runs first and carries the pact id
         * that the deep link wants.
         */
        add: (userId: string, candidate: ICheckinNudgeCandidate): void => {
            if (!userId || !candidate?.habitGoalId) {
                return;
            }
            if (!byUser.has(userId)) {
                byUser.set(userId, new Map());
            }
            const habits = byUser.get(userId) as Map<string, ICheckinNudgeCandidate>;
            if (!habits.has(candidate.habitGoalId)) {
                habits.set(candidate.habitGoalId, candidate);
            }
        },

        /** Number of distinct habits recorded, across all users. */
        candidateCount: (): number => Array.from(byUser.values())
            .reduce((total, habits) => total + habits.size, 0),

        /** One row per user, ready to enqueue. */
        drain: (): ICheckinNudgeRow[] => Array.from(byUser.entries()).map(([userId, habitMap]) => {
            const candidates = Array.from(habitMap.values());
            // The habit with the longest live streak leads the copy. `reduce`
            // keeps the first on a tie, which preserves digest order.
            const primary = candidates.reduce(
                (best, current) => (Number(current.streakCount || 0) > Number(best.streakCount || 0) ? current : best),
                candidates[0],
            );
            const isAtRisk = candidates.some(hasLiveStreak);
            const isSingle = candidates.length === 1;

            return {
                userId,
                type: isAtRisk
                    ? PushNotifications.Types.streakAtRisk
                    : PushNotifications.Types.dailyHabitReminder,
                payload: {
                    habitName: primary.habitName,
                    habitCount: candidates.length,
                    // Primary first: it is the one the singular copy would have
                    // named, and the list is truncated downstream.
                    habitNames: [
                        primary.habitName,
                        ...candidates.filter((c) => c !== primary).map((c) => c.habitName),
                    ],
                    streakCount: Number(primary.streakCount || 0),
                    // Freeze counts are per habit. Naming one while the copy
                    // covers three would promise a net over habits it does not
                    // cover, so the plural body drops the clause entirely.
                    freezesRemaining: isSingle ? primary.freezesRemaining : undefined,
                    // Only a single-habit nudge can carry a check-in target or a
                    // deep link. With several, "Check In" has nothing
                    // unambiguous to complete and the tap belongs on the list.
                    habitGoalId: isSingle ? primary.habitGoalId : undefined,
                    pactId: isSingle ? primary.pactId : undefined,
                },
                candidateCount: candidates.length,
            };
        }),
    };
};
