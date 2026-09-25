import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

/**
 * The celebration queue's two jobs, pinned.
 *
 * 1. A celebration must never pre-empt the check-in flow. The success toast offers the
 *    note/photo screen; a full-screen celebration appearing over that offer takes it away
 *    before it can be read. So the toast blocks, the screen it opens blocks, and only when both
 *    have gone does anything present.
 * 2. When a placement and a streak are both owed — the ordinary case on the first foreground
 *    after a period closes overnight — the placement goes first. It is rarer and more
 *    consequential, and a streak screen shown first gets dismissed on the way to something the
 *    user did not know was coming.
 */

// Prefixed `mock` so Jest allows the hoisted factory below to reference it.
const mockNavigate = jest.fn();
// Mutable so a test can stand in for the window between app launch and the navigator's
// `onReady`, when `RootNavigation.navigate` is a silent no-op.
const mockIsReady = { value: true };

jest.mock('../../main/components/RootNavigation', () => ({
    __esModule: true,
    navigationRef: { isReady: () => mockIsReady.value },
    // Mirrors the real helper, which drops the call outright until the container is ready.
    RootNavigation: {
        navigate: (...args: any[]) => {
            if (mockIsReady.value) {
                (mockNavigate as any)(...args);
            }
        },
    },
}));

import celebrationQueue, {
    enqueueCelebrationsFromSummary,
    enqueuePlacementCelebrations,
    enqueueStreakCelebration,
    ICelebration,
} from '../../main/utilities/celebrationQueue';

const streak = (overrides: Partial<Extract<ICelebration, { type: 'streak' }>> = {}): ICelebration => ({
    type: 'streak',
    streak: 7,
    week: [],
    milestone: true,
    perfectWeek: false,
    newLongest: true,
    date: '2026-09-13',
    ...overrides,
});

const placement = (overrides: Partial<Extract<ICelebration, { type: 'placement' }>> = {}): ICelebration => ({
    type: 'placement',
    periodId: '2026-09-07',
    periodStart: '2026-09-07',
    periodEnd: '2026-09-14',
    placement: 1,
    participants: 22,
    score: 340,
    leagueTo: null,
    ...overrides,
});

const navigate = mockNavigate;

const navigatedTypes = () => navigate.mock.calls.map(([, params]: any) => params.type);

describe('celebrationQueue — blocking', () => {
    beforeEach(() => {
        navigate.mockClear();
        celebrationQueue.reset();
    });

    it('does not navigate while blocked, and presents once released', () => {
        celebrationQueue.block();
        celebrationQueue.enqueue(streak());

        expect(navigate).not.toHaveBeenCalled();

        celebrationQueue.unblock();

        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith('Celebration', expect.objectContaining({ type: 'streak' }));
    });

    it('stays blocked until every holder releases', () => {
        // The toast and the screen it opened overlap: the screen mounts before the toast's own
        // dismissal fires. A boolean flag would let the first release present over the screen.
        celebrationQueue.block();
        celebrationQueue.block();
        celebrationQueue.enqueue(streak());

        celebrationQueue.unblock();
        expect(navigate).not.toHaveBeenCalled();

        celebrationQueue.unblock();
        expect(navigate).toHaveBeenCalledTimes(1);
    });

    it('never drops below zero blockers, so a stray release cannot leave the queue stuck open', () => {
        celebrationQueue.unblock();
        celebrationQueue.unblock();
        celebrationQueue.block();
        celebrationQueue.enqueue(streak());

        expect(navigate).not.toHaveBeenCalled();

        celebrationQueue.unblock();
        expect(navigate).toHaveBeenCalledTimes(1);
    });
});

describe('celebrationQueue — navigator readiness', () => {
    beforeEach(() => {
        navigate.mockClear();
        celebrationQueue.reset();
        mockIsReady.value = true;
    });

    it('holds a celebration enqueued before the navigator is ready, and presents it once it is', () => {
        // Regression: `flush` used to shift the item and mark itself presenting before calling
        // `RootNavigation.navigate`, which no-ops until the container is ready. The celebration
        // was lost AND the queue believed a screen was up, so nothing presented for the rest of
        // the session — every later enqueue waited on an `onDismissed` that could never come.
        mockIsReady.value = false;
        celebrationQueue.enqueue(placement());

        expect(navigate).not.toHaveBeenCalled();
        expect(celebrationQueue.size).toBe(1);

        mockIsReady.value = true;
        celebrationQueue.flush();

        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith('Celebration', expect.objectContaining({ type: 'placement' }));
    });

    it('is not wedged by an enqueue that raced the navigator: a later enqueue still presents', () => {
        mockIsReady.value = false;
        celebrationQueue.enqueue(placement());
        mockIsReady.value = true;

        celebrationQueue.enqueue(streak());

        expect(navigatedTypes()).toEqual(['placement']);
        celebrationQueue.onDismissed();
        expect(navigatedTypes()).toEqual(['placement', 'streak']);
    });
});

describe('celebrationQueue — ordering', () => {
    beforeEach(() => {
        navigate.mockClear();
        celebrationQueue.reset();
    });

    it('dequeues a placement before a streak, whichever was enqueued first', () => {
        celebrationQueue.block();
        celebrationQueue.enqueue(streak());
        celebrationQueue.enqueue(placement());
        celebrationQueue.unblock();

        expect(navigatedTypes()).toEqual(['placement']);

        // Only one presents at a time; the next waits for the first to be dismissed.
        celebrationQueue.onDismissed();

        expect(navigatedTypes()).toEqual(['placement', 'streak']);
    });

    it('presents one celebration at a time', () => {
        celebrationQueue.enqueue(placement());
        celebrationQueue.enqueue(streak());

        expect(navigate).toHaveBeenCalledTimes(1);
    });

    it('drops a duplicate rather than stacking the same screen twice', () => {
        // Two foregrounds before the user dismisses re-fetch the same pending celebration.
        celebrationQueue.block();
        celebrationQueue.enqueue(streak({ date: '2026-09-13' }));
        celebrationQueue.enqueue(streak({ date: '2026-09-13' }));
        celebrationQueue.enqueue(placement({ periodId: '2026-09-07' }));
        celebrationQueue.enqueue(placement({ periodId: '2026-09-07' }));

        expect(celebrationQueue.size).toBe(2);
    });
});

describe('celebrationQueue — never re-presents what was shown', () => {
    beforeEach(() => {
        navigate.mockClear();
        celebrationQueue.reset();
    });

    it('drops a re-fetch of the celebration on screen, so Continue does not bring it straight back', () => {
        // Regression: the dismiss write is fire-and-forget, so a fetch in flight when the user
        // tapped Continue still carried the same pending celebration. The queue only de-duped
        // against what was *waiting*, not what was showing, and re-presented the screen the
        // user had just dismissed.
        celebrationQueue.enqueue(streak({ date: '2026-09-25' }));
        expect(navigate).toHaveBeenCalledTimes(1);

        celebrationQueue.enqueue(streak({ date: '2026-09-25' }));
        celebrationQueue.onDismissed();

        expect(navigate).toHaveBeenCalledTimes(1);
        expect(celebrationQueue.isIdle).toBe(true);
    });

    it('drops one that arrives after the dismissal too', () => {
        celebrationQueue.enqueue(placement({ periodId: '2026-09-14' }));
        celebrationQueue.onDismissed();
        celebrationQueue.enqueue(placement({ periodId: '2026-09-14' }));

        expect(navigate).toHaveBeenCalledTimes(1);
    });

    it('still presents the next day, and forgets everything on reset (sign-out)', () => {
        celebrationQueue.enqueue(streak({ date: '2026-09-25' }));
        celebrationQueue.onDismissed();
        celebrationQueue.enqueue(streak({ date: '2026-09-26' }));
        expect(navigate).toHaveBeenCalledTimes(2);

        celebrationQueue.reset();
        celebrationQueue.enqueue(streak({ date: '2026-09-26' }));
        expect(navigate).toHaveBeenCalledTimes(3);
    });
});

describe('celebrationQueue — building from a daily-streak summary', () => {
    beforeEach(() => {
        navigate.mockClear();
        celebrationQueue.reset();
    });

    it('queues nothing when the server says no celebration is owed', () => {
        // The client never infers this — `pendingCelebration` is null unless the last upheld
        // day is today and today has not been celebrated.
        enqueueStreakCelebration({
            currentStreak: 12,
            longestStreak: 30,
            today: '2026-09-13',
            week: [],
            pendingCelebration: null,
        } as any);

        expect(navigate).not.toHaveBeenCalled();
        expect(celebrationQueue.size).toBe(0);
    });

    it('carries the server-decided milestone, perfect-week and personal-best flags through', () => {
        enqueueStreakCelebration({
            currentStreak: 30,
            longestStreak: 30,
            today: '2026-09-13',
            week: [],
            pendingCelebration: {
                kind: 'milestone', streak: 30, isPerfectWeek: true, isNewLongest: true,
            },
        } as any);

        expect(navigate).toHaveBeenCalledWith('Celebration', expect.objectContaining({
            type: 'streak',
            streak: 30,
            milestone: true,
            perfectWeek: true,
            newLongest: true,
            date: '2026-09-13',
        }));
    });

    it('gives the full screen to a podium finish only', () => {
        enqueuePlacementCelebrations([
            { ...(placement({ periodId: 'a', placement: 3 }) as any) },
            { ...(placement({ periodId: 'b', placement: 7 }) as any) },
        ] as any);

        // 7th of 22 is an inline card on the leaderboard, not a modal it did not earn.
        expect(navigatedTypes()).toEqual(['placement']);
        expect(navigate.mock.calls[0][1]).toEqual(expect.objectContaining({ periodId: 'a' }));
        expect(celebrationQueue.size).toBe(0);
    });

    it('queues a placement and a streak from one summary, placement first', () => {
        celebrationQueue.block();
        enqueueCelebrationsFromSummary({
            currentStreak: 7,
            longestStreak: 7,
            today: '2026-09-13',
            week: [],
            pendingCelebration: {
                kind: 'milestone', streak: 7, isPerfectWeek: false, isNewLongest: true,
            },
            pendingPlacements: [placement({ periodId: '2026-09-07', placement: 2 }) as any],
        } as any);
        celebrationQueue.unblock();

        expect(navigatedTypes()).toEqual(['placement']);
        celebrationQueue.onDismissed();
        expect(navigatedTypes()).toEqual(['placement', 'streak']);
    });
});
