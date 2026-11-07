import { it, describe, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import {
    getFirstPauseReminderDate,
    getPauseOffer,
    getNextPauseReminderDate,
    getPauseAvailability,
    localDayToDate,
} from '../../main/routes/Habits/habitPause';
import { getHabitRisk, getHabitRiskTone, sortByHabitRisk } from '../../main/routes/Habits/habitRisk';

/**
 * How the habit screens read a paused habit. The rules are the server's (users-service
 * `utilities/habitPause.ts`); these pin that the client says what the server holds — and in
 * particular that a server day is read as the user's local day, not as UTC midnight.
 */

const pause = (overrides: Record<string, any> = {}) => ({
    id: 'pause-1',
    pausedOn: '2026-11-07',
    daysPaused: 0,
    streakAtPause: 12,
    upcomingReminderDays: [7, 14, 30],
    ...overrides,
});

const ymd = (date: Date | null) => (date
    ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    : null);

describe('habit pause', () => {
    it('reads a server day as that local calendar day', () => {
        expect(ymd(localDayToDate('2026-11-07'))).toBe('2026-11-7');
        expect(localDayToDate('garbage')).toBeNull();
        expect(localDayToDate(null)).toBeNull();
    });

    it('names the next reminder from the ones still to come', () => {
        expect(ymd(getNextPauseReminderDate(pause() as any))).toBe('2026-11-14');
        expect(ymd(getNextPauseReminderDate(pause({ daysPaused: 9, upcomingReminderDays: [14, 30] }) as any)))
            .toBe('2026-11-21');
        expect(getNextPauseReminderDate(pause({ daysPaused: 40, upcomingReminderDays: [] }) as any)).toBeNull();
    });

    it('falls back to the fixed schedule when the server sends no upcoming list', () => {
        expect(ymd(getNextPauseReminderDate(pause({ daysPaused: 20, upcomingReminderDays: undefined }) as any)))
            .toBe('2026-12-7');
    });

    it('names the first reminder of a fresh pause for the success toast', () => {
        expect(ymd(getFirstPauseReminderDate([
            { dayCount: 14, localDate: '2026-11-21' },
            { dayCount: 7, localDate: '2026-11-14' },
        ]))).toBe('2026-11-14');
        expect(getFirstPauseReminderDate(undefined)).toBeNull();
    });

    it('offers pause, explains the cooldown, or shows the paused state', () => {
        expect(getPauseAvailability({ status: 'active', pause: null, pauseAvailableOn: null }))
            .toEqual({ kind: 'available' });
        expect(getPauseAvailability({ status: 'active', pause: pause() as any })?.kind).toBe('paused');
        const cooldown = getPauseAvailability({ status: 'active', pause: null, pauseAvailableOn: '2026-11-14' });
        expect(cooldown?.kind).toBe('cooldown');
        expect(getPauseAvailability({ status: 'archived', pause: null } as any)).toBeNull();
        expect(getPauseAvailability(undefined)).toBeNull();
    });

    it('offers no Pause button when the server predates pausing (no `pause` key)', () => {
        // The Play build can ship before the backend that serves /pause does; a button there
        // would only fail on tap.
        expect(getPauseAvailability({ status: 'active' } as any)).toBeNull();
        expect(getPauseAvailability({ status: 'active', pauseAvailableOn: null } as any)).toBeNull();
    });
});

describe('paused habits in the list', () => {
    const required = {
        done: 0, target: 7, daysLeft: 3, isRequiredToday: true, isMet: false, urgency: 'required',
    } as any;

    it('is never at risk and never outlined, even on a required day with a streak', () => {
        const risk = getHabitRisk({
            isCompletedToday: false, weekProgress: required, streakCount: 12, isPaused: true,
        });
        expect(risk).toBe('paused');
        expect(getHabitRiskTone(risk, 22)).toBeNull();
    });

    it('reads as done once checked in (which resumes it)', () => {
        expect(getHabitRisk({
            isCompletedToday: true, weekProgress: required, streakCount: 12, isPaused: true,
        })).toBe('done');
    });

    it('sorts below everything, including done', () => {
        const sorted = sortByHabitRisk(
            [
                { id: 'paused', risk: 'paused' as const, streakCount: 30 },
                { id: 'done', risk: 'done' as const, streakCount: 1 },
                { id: 'atRisk', risk: 'streakAtRisk' as const, streakCount: 2 },
            ],
            (item) => item,
        );
        expect(sorted.map((item) => item.id)).toEqual(['atRisk', 'done', 'paused']);
    });
});

describe('pause offer from a streak nudge', () => {
    it('reads only the two offer values from route params', () => {
        expect(getPauseOffer({ habitGoalId: 'g', pauseOffer: 'open' })).toBe('open');
        expect(getPauseOffer({ habitGoalId: 'g', pauseOffer: 'suggest' })).toBe('suggest');
        expect(getPauseOffer({ habitGoalId: 'g', pauseOffer: 'true' })).toBeUndefined();
        expect(getPauseOffer({ habitGoalId: 'g' })).toBeUndefined();
        expect(getPauseOffer(undefined)).toBeUndefined();
    });

    /**
     * Layout is a large connected component, so — like HabitsNotificationTabRouting — the routing
     * literals are read from source. These pin the two halves the user experiences: the Pause
     * button opens the habit with the dialog up, and a body tap on a pause-offering nudge opens it
     * with the prompt beside the check-in.
     */
    const layoutSource = fs.readFileSync(path.resolve(__dirname, '../../main/components/Layout.tsx'), 'utf8');

    it('routes the Pause button to the habit with the dialog open', () => {
        const branchStart = layoutSource.indexOf('pressAction?.id === PushNotifications.PressActionIds.habitPause');
        expect(branchStart).toBeGreaterThan(-1);
        const branch = layoutSource.slice(branchStart, branchStart + 1500);
        expect(branch).toContain("targetRouteView: 'HabitDetail'");
        expect(branch).toContain("pauseOffer: 'open'");
    });

    it('routes a body tap on a pause-offering streak nudge to the habit with the prompt', () => {
        expect(layoutSource).toMatch(/offersPause && habitGoalId[\s\S]{0,200}pauseOffer: 'suggest'/);
    });
});
