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
        /**
         * Every habit goal this nudge covers — not only the one the copy names.
         *
         * Carried for the send-time freshness gate
         * (`utilities/checkinNudgeFreshness.ts`), which re-reads check-ins for
         * exactly these pairs before sending and suppresses the row once they
         * are all done. That matters because the digest now schedules rows
         * hours ahead into the user's local day, so "hasn't checked in" is a
         * fact with a shelf life.
         *
         * Never reaches the device: `predictAndSendPushNotification` in
         * push-notifications-service destructures a fixed key set off the
         * request body, so an extra payload field is dropped before the FCM
         * data map is built. Keep it that way — FCM's data map is
         * string->string and an array would fail the whole send.
         */
        habitGoalIds: string[];
    };
    /** How many candidates this one row stands in for. */
    candidateCount: number;
    /**
     * True when at least one habit in this roll-up has a live streak.
     *
     * The digest reads it to decide whether the user gets an evening "last
     * chance" reminder as well as the morning one. Loss aversion is the entire
     * justification for a second push in a day, so a user with nothing to lose
     * gets one reminder, not two — see `runDailyHabitsDigest`.
     */
    hasLiveStreak: boolean;
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

/**
 * The dedupe key for the evening "last chance" nudge.
 *
 * Stamped with the *digest run's* date rather than the recipient's local one,
 * for the same reason `checkinNudgeDedupeKey` is: the digest fires once a day,
 * so one key per run is exactly one notification per user per day, and it stays
 * that way even for a user whose local date differs from the server's or who
 * changes timezone mid-day. The local date has a different job — it is what the
 * send-time freshness gate checks against — and conflating the two would let a
 * traveller dedupe themselves out of a reminder, or into two.
 */
export const lastChanceNudgeDedupeKey = (today: string): string => `last-chance:${today}`;

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
                    // Every goal, including the ones the copy does not name.
                    // The freshness gate needs the full set: suppressing on the
                    // primary habit alone would silence a nudge that still has
                    // two outstanding habits behind it.
                    habitGoalIds: candidates.map((c) => c.habitGoalId),
                },
                candidateCount: candidates.length,
                hasLiveStreak: isAtRisk,
            };
        }),
    };
};
