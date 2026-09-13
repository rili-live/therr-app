import {
    IDailyStreak,
    IDailyStreakPendingPlacement,
    IDailyStreakWeekDay,
} from 'therr-react/types';
import { navigationRef, RootNavigation } from '../components/RootNavigation';

/**
 * What a celebration screen renders. Every field is decided server-side — the client never
 * infers that a celebration is owed (see `pendingCelebration` on GET /habits/daily-streak/me),
 * so two devices cannot both celebrate the same day.
 */
export type ICelebration =
    | {
        type: 'streak';
        streak: number;
        week: IDailyStreakWeekDay[];
        milestone: boolean;
        perfectWeek: boolean;
        newLongest: boolean;
        /** The local day being celebrated; POSTed back on dismiss to gate the next one. */
        date: string;
    }
    | {
        type: 'placement';
        periodId: string;
        periodStart: string;
        periodEnd: string;
        placement: number;
        participants: number;
        score: number;
        /** Reserved for leagues; always null today. */
        leagueTo: string | null;
    };

/**
 * Celebrations are queued rather than navigated to directly, for two reasons.
 *
 * 1. **They must not pre-empt the check-in flow.** Checking in shows a toast offering the
 *    note/photo screen. Navigating to a full-screen celebration the instant the request
 *    resolves would tear that away mid-gesture. So the toast blocks the queue, and the screen
 *    it opens keeps it blocked until it closes — save or cancel.
 * 2. **Two can be owed at once.** A placement from a period that closed overnight and today's
 *    streak both come back from the same fetch. They are shown in order, placement first: it is
 *    the rarer and more consequential of the two, and a streak screen shown first would be
 *    dismissed on the way to something the user did not know was coming.
 *
 * `block()` and `unblock()` are counted rather than boolean. The toast and the screen it opens
 * overlap — the screen mounts before the toast's own dismissal unblocks — and a boolean would
 * let the first `unblock` release the queue while the second holder is still on screen.
 */
class CelebrationQueue {
    private queue: ICelebration[] = [];

    private blockers = 0;

    /** True while a celebration screen is on screen, so the next one waits for its dismissal. */
    private isPresenting = false;

    enqueue(celebration: ICelebration) {
        // A placement and a streak can arrive from the same fetch on every foreground. Dropping
        // a duplicate here keeps a re-fetch (a second foreground before the user dismisses)
        // from stacking the same screen twice.
        if (this.queue.some((queued) => CelebrationQueue.isSame(queued, celebration))) {
            return;
        }
        this.queue.push(celebration);
        // Placement before streak, regardless of arrival order.
        this.queue.sort((a, b) => CelebrationQueue.priority(a) - CelebrationQueue.priority(b));
        this.flush();
    }

    block() {
        this.blockers += 1;
    }

    unblock() {
        this.blockers = Math.max(0, this.blockers - 1);
        this.flush();
    }

    /** Called by the celebration screen as it unmounts, to release the next one. */
    onDismissed() {
        this.isPresenting = false;
        this.flush();
    }

    flush() {
        if (this.blockers > 0 || this.isPresenting || !this.queue.length) {
            return;
        }
        // `RootNavigation.navigate` is a silent no-op until the container is ready. Shifting
        // and marking `isPresenting` before that would drop the celebration AND wedge the queue
        // for the rest of the session, since nothing would ever call `onDismissed`. Leave it
        // queued; the next enqueue / unblock re-flushes once the navigator is up.
        if (!navigationRef.isReady()) {
            return;
        }
        const next = this.queue.shift();
        if (!next) {
            return;
        }
        this.isPresenting = true;
        RootNavigation.navigate('Celebration', next);
    }

    /** Test and sign-out affordance: drop anything pending without showing it. */
    reset() {
        this.queue = [];
        this.blockers = 0;
        this.isPresenting = false;
    }

    get size() {
        return this.queue.length;
    }

    get isBlocked() {
        return this.blockers > 0;
    }

    private static priority(celebration: ICelebration): number {
        return celebration.type === 'placement' ? 0 : 1;
    }

    private static isSame(a: ICelebration, b: ICelebration): boolean {
        if (a.type !== b.type) {
            return false;
        }
        if (a.type === 'placement' && b.type === 'placement') {
            return a.periodId === b.periodId;
        }
        if (a.type === 'streak' && b.type === 'streak') {
            return a.date === b.date;
        }
        return false;
    }
}

export const celebrationQueue = new CelebrationQueue();

/** Placements at or above this get the full screen; the rest an inline card on the board. */
export const PODIUM_PLACEMENT_MAX = 3;

/**
 * Queue the streak celebration a daily-streak payload says is owed, if any.
 *
 * Whether one is owed is entirely `pendingCelebration` — the server sets it only while the last
 * upheld day is today and today has not been celebrated. Passing a payload with no pending
 * celebration is the normal case (every check-in after the first of the day) and does nothing.
 */
export const enqueueStreakCelebration = (dailyStreak?: IDailyStreak | null) => {
    const pending = dailyStreak?.pendingCelebration;
    if (!pending) {
        return;
    }

    celebrationQueue.enqueue({
        type: 'streak',
        streak: pending.streak,
        week: dailyStreak?.week || [],
        milestone: pending.kind === 'milestone',
        perfectWeek: pending.isPerfectWeek,
        newLongest: pending.isNewLongest,
        date: dailyStreak?.today || '',
    });
};

/**
 * Queue the full-screen celebrations for podium placements. Anything below the podium is
 * deliberately not queued — the leaderboard renders it as a dismissible inline card instead,
 * because "you finished 7th of 22" does not warrant taking over the screen.
 */
export const enqueuePlacementCelebrations = (placements?: IDailyStreakPendingPlacement[] | null) => {
    (placements || [])
        .filter((placement) => placement.placement <= PODIUM_PLACEMENT_MAX)
        .forEach((placement) => celebrationQueue.enqueue({
            type: 'placement',
            periodId: placement.periodId,
            periodStart: placement.periodStart,
            periodEnd: placement.periodEnd,
            placement: placement.placement,
            participants: placement.participants,
            score: placement.score,
            leagueTo: placement.leagueTo,
        }));
};

/**
 * Everything a daily-streak fetch may owe the user, in the order it should be shown. The queue
 * sorts placement ahead of streak itself, so the call order here does not matter — but both are
 * enqueued from one place so no caller can forget half of it.
 */
export const enqueueCelebrationsFromSummary = (dailyStreak?: IDailyStreak | null) => {
    enqueuePlacementCelebrations(dailyStreak?.pendingPlacements);
    enqueueStreakCelebration(dailyStreak);
};

export default celebrationQueue;
