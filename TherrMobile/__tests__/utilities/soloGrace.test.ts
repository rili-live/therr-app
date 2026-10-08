import { it, describe, expect } from '@jest/globals';
import {
    getSoloGraceDays,
    getSoloGraceDaysLeft,
    isFirstHabitGraceAvailable,
    readSoloGraceEnded,
} from '../../main/utilities/soloGrace';

/**
 * The first-habit solo grace, as the app reads it (#3010). The server decides; these pin that
 * the app only ever reads what it was told, and that a server predating the grace — which sends
 * none of the fields — reads as "no grace" everywhere.
 */
describe('soloGrace', () => {
    const eligibility = (overrides: any = {}): any => ({
        canCreateSolo: true,
        activeHabitCount: 0,
        isAtHabitLimit: false,
        habitLimit: 3,
        ...overrides,
    });

    it('offers the first habit only when the server says the grace is unused and solo is on', () => {
        expect(isFirstHabitGraceAvailable(eligibility({ isSoloGraceAvailable: true }), true)).toBe(true);
        expect(isFirstHabitGraceAvailable(eligibility({ isSoloGraceAvailable: true }), false)).toBe(false);
        expect(isFirstHabitGraceAvailable(eligibility({ isSoloGraceAvailable: false }), true)).toBe(false);
    });

    // canCreateSolo alone is not the signal: an invites-unlocked user has it too, and for them the
    // overlay should keep offering a pact, not "your first habit".
    it('reads a server predating the grace as no grace, even with canCreateSolo', () => {
        expect(isFirstHabitGraceAvailable(eligibility(), true)).toBe(false);
        expect(isFirstHabitGraceAvailable(undefined, true)).toBe(false);
    });

    it('reports the free days and the days left from the server', () => {
        const now = new Date('2026-10-08T12:00:00Z');
        const spent = eligibility({
            soloGraceDays: 7,
            soloGrace: { endsAt: '2026-10-10T06:00:00Z', hasEnded: false, isLocked: false },
        });

        expect(getSoloGraceDays(spent)).toBe(7);
        expect(getSoloGraceDaysLeft(spent, now)).toBe(2);
        expect(getSoloGraceDaysLeft(eligibility({ soloGrace: { endsAt: '2026-10-01T00:00:00Z' } }), now)).toBe(0);
        expect(getSoloGraceDaysLeft(eligibility(), now)).toBeNull();
        expect(getSoloGraceDays(eligibility())).toBeNull();
    });

    it('recognises the grace-ended refusal and nothing else', () => {
        const refusal = { response: { status: 403, data: { error: 'solo-grace-ended', habitGoalId: 'goal-1', requiredCount: 1 } } };

        expect(readSoloGraceEnded(refusal)).toEqual({ habitGoalId: 'goal-1', requiredCount: 1 });
        expect(readSoloGraceEnded({ response: { status: 403, data: { error: 'solo-locked' } } })).toBeNull();
        expect(readSoloGraceEnded({ response: { status: 402, data: { error: 'habit-limit-reached' } } })).toBeNull();
        expect(readSoloGraceEnded(new Error('network'))).toBeNull();
    });
});
