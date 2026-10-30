import { it, describe, expect } from '@jest/globals';
import {
    getHabitRisk, getHabitRiskTone, sortByHabitRisk, STREAK_DANGER_FROM_HOUR,
} from '../../main/routes/Habits/habitRisk';

/**
 * The habits list puts what still needs a check-in on top and what is done at the bottom, with
 * a streak about to end above everything. The urgency itself is the server's (users-service
 * `getCheckinUrgency`); these pin how the client ranks and colours it.
 */

const week = (overrides: Record<string, any> = {}) => ({
    done: 0, target: 3, daysLeft: 4, isRequiredToday: false, isMet: false, ...overrides,
});

describe('getHabitRisk', () => {
    it('treats a check-in today as done, whatever else is true', () => {
        expect(getHabitRisk({
            isCompletedToday: true, weekProgress: week({ urgency: 'required' }), streakCount: 9,
        })).toBe('done');
    });

    it('treats a met weekly quota as done', () => {
        expect(getHabitRisk({
            isCompletedToday: false, weekProgress: week({ isMet: true, urgency: 'met' }), streakCount: 4,
        })).toBe('done');
    });

    it('flags a live streak on a required day as the highest risk', () => {
        expect(getHabitRisk({
            isCompletedToday: false, weekProgress: week({ target: 7, isRequiredToday: true, urgency: 'required' }), streakCount: 5,
        })).toBe('streakAtRisk');
    });

    it('does not warn on a daily habit with no streak to lose', () => {
        expect(getHabitRisk({
            isCompletedToday: false, weekProgress: week({ target: 7, isRequiredToday: true, urgency: 'required' }), streakCount: 0,
        })).toBe('onTrack');
    });

    it('warns on a weekly target that is due today even without a streak', () => {
        expect(getHabitRisk({
            isCompletedToday: false, weekProgress: week({ isRequiredToday: true, urgency: 'required' }), streakCount: 0,
        })).toBe('dueToday');
    });

    it('maps soon, flexible and rest through', () => {
        expect(getHabitRisk({ isCompletedToday: false, weekProgress: week({ urgency: 'soon' }), streakCount: 2 })).toBe('dueSoon');
        expect(getHabitRisk({ isCompletedToday: false, weekProgress: week({ urgency: 'flexible' }), streakCount: 2 })).toBe('onTrack');
        expect(getHabitRisk({ isCompletedToday: false, weekProgress: week({ urgency: 'rest' }), streakCount: 2 })).toBe('restDay');
    });

    it('falls back to the two booleans on a server that predates urgency', () => {
        expect(getHabitRisk({ isCompletedToday: false, weekProgress: week({ isRequiredToday: true }), streakCount: 3 })).toBe('streakAtRisk');
        expect(getHabitRisk({ isCompletedToday: false, weekProgress: week(), streakCount: 3 })).toBe('onTrack');
        expect(getHabitRisk({ isCompletedToday: false, weekProgress: week({ isMet: true }), streakCount: 3 })).toBe('done');
    });

    it('reads a missing weekProgress as unknown, not at risk', () => {
        expect(getHabitRisk({ isCompletedToday: false, streakCount: 12 })).toBe('onTrack');
    });
});

describe('getHabitRiskTone', () => {
    it('keeps a streak at risk amber until the evening, then red', () => {
        expect(getHabitRiskTone('streakAtRisk', 9)).toBe('warning');
        expect(getHabitRiskTone('streakAtRisk', STREAK_DANGER_FROM_HOUR)).toBe('danger');
    });

    it('outlines due habits amber and leaves the rest alone', () => {
        expect(getHabitRiskTone('dueToday', 20)).toBe('warning');
        expect(getHabitRiskTone('dueSoon', 20)).toBe('warning');
        expect(getHabitRiskTone('onTrack', 20)).toBeNull();
        expect(getHabitRiskTone('restDay', 20)).toBeNull();
        expect(getHabitRiskTone('done', 20)).toBeNull();
    });
});

describe('sortByHabitRisk', () => {
    it('puts risk on top, done at the bottom, and the longer streak first within a tier', () => {
        const items = [
            { id: 'done', risk: 'done' as const, streakCount: 30 },
            { id: 'flexible', risk: 'onTrack' as const, streakCount: 0 },
            { id: 'short-risk', risk: 'streakAtRisk' as const, streakCount: 2 },
            { id: 'soon', risk: 'dueSoon' as const, streakCount: 1 },
            { id: 'long-risk', risk: 'streakAtRisk' as const, streakCount: 20 },
            { id: 'rest', risk: 'restDay' as const, streakCount: 5 },
        ];

        expect(sortByHabitRisk(items, (item) => item).map((item) => item.id)).toEqual([
            'long-risk', 'short-risk', 'soon', 'flexible', 'rest', 'done',
        ]);
    });

    it('keeps the incoming order on a full tie', () => {
        const items = [
            { id: 'a', risk: 'onTrack' as const, streakCount: 0 },
            { id: 'b', risk: 'onTrack' as const, streakCount: 0 },
        ];
        expect(sortByHabitRisk(items, (item) => item).map((item) => item.id)).toEqual(['a', 'b']);
    });
});
