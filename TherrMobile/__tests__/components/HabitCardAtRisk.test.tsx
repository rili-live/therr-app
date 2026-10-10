import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

import HabitCard, { isHabitStreakAtRisk } from '../../main/components/Habits/HabitCard';
import { buildStyles as buildHabitsStyles } from '../../main/styles/habits';

const translate = (key: string) => key;

const buildStreak = (currentStreak: number, overrides: any = {}) => ({
    currentStreak,
    gracePeriodDays: 0,
    graceDaysUsed: 0,
    ...overrides,
}) as any;

const buildWeek = (overrides: any = {}) => ({
    done: 2,
    target: 5,
    daysLeft: 3,
    isRequiredToday: true,
    isMet: false,
    ...overrides,
});

const completedToday = { status: 'completed' } as any;

const renderCard = (themeName: 'light' | 'dark', props: any = {}) => {
    const themeHabits = buildHabitsStyles(themeName) as any;
    let component: renderer.ReactTestRenderer;
    act(() => {
        component = renderer.create(
            <HabitCard
                habitGoal={{ id: 'goal-1', name: 'Workout', frequencyType: 'weekly', frequencyCount: 5 } as any}
                themeHabits={themeHabits}
                translate={translate}
                {...props}
            />,
        );
    });

    // @ts-ignore - assigned synchronously inside act
    const root = (component as renderer.ReactTestRenderer).toJSON() as any;
    const flat = Object.assign({}, ...[].concat(root.props.style).flat(Infinity).filter(Boolean));
    return { root, flat, themeHabits };
};

describe('isHabitStreakAtRisk', () => {
    it('is true only for a live streak that today is required for and not yet checked in', () => {
        expect(isHabitStreakAtRisk(buildStreak(3), buildWeek(), false)).toBe(true);
    });

    it('is false once today is checked in', () => {
        expect(isHabitStreakAtRisk(buildStreak(3), buildWeek(), true)).toBe(false);
    });

    it('is false when the week still has room to skip today', () => {
        expect(isHabitStreakAtRisk(buildStreak(3), buildWeek({ isRequiredToday: false }), false)).toBe(false);
    });

    it('is false with no streak to lose', () => {
        expect(isHabitStreakAtRisk(buildStreak(0), buildWeek(), false)).toBe(false);
        expect(isHabitStreakAtRisk(undefined, buildWeek(), false)).toBe(false);
    });

    /**
     * `riskLevel` assumes a daily cadence, so a weekly habit reads "critical" while the week
     * still has slack. The outline must not follow it.
     */
    it('ignores the daily-only riskLevel and treats unknown progress as safe', () => {
        expect(isHabitStreakAtRisk(buildStreak(3, { riskLevel: 'critical' }), buildWeek({ isRequiredToday: false }), false))
            .toBe(false);
        expect(isHabitStreakAtRisk(buildStreak(3, { riskLevel: 'critical' }), undefined, false)).toBe(false);
    });
});

describe('HabitCard — at-risk outline', () => {
    it.each(['light', 'dark'] as const)('outlines an at-risk card in the %s theme without shifting its contents', (themeName) => {
        const { root, flat, themeHabits } = renderCard(themeName, {
            streak: buildStreak(3),
            weekProgress: buildWeek(),
        });
        const base = themeHabits.styles.habitCardContainer;

        expect(flat.borderWidth).toBeGreaterThan(0);
        expect(flat.backgroundColor).not.toBe(base.backgroundColor);
        expect(flat.padding + flat.borderWidth).toBe(base.padding);
        expect(root.props.accessibilityHint).toBe('pages.habits.widget.streakAtRisk');
    });

    it('leaves a safe card untouched', () => {
        const { root, flat } = renderCard('light', {
            streak: buildStreak(3),
            weekProgress: buildWeek(),
            todayCheckin: completedToday,
        });

        expect(flat.borderWidth).toBeUndefined();
        expect(root.props.accessibilityHint).toBeUndefined();
    });
});
