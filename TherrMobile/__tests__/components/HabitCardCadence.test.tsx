import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

import HabitCard from '../../main/components/Habits/HabitCard';
import { buildStyles as buildHabitsStyles } from '../../main/styles/habits';

const themeHabits = buildHabitsStyles('light') as any;

const translate = (key: string, params?: any) => (
    params ? `${key}(${Object.values(params).join(',')})` : key
);

const buildGoal = (overrides: any = {}) => ({
    id: 'goal-1',
    name: 'Workout',
    frequencyType: 'daily',
    frequencyCount: 1,
    ...overrides,
}) as any;

const renderCard = (props: any = {}) => {
    let component: renderer.ReactTestRenderer;
    act(() => {
        component = renderer.create(
            <HabitCard
                habitGoal={buildGoal()}
                themeHabits={themeHabits}
                translate={translate}
                {...props}
            />,
        );
    });

    // @ts-ignore - assigned synchronously inside act
    return component as renderer.ReactTestRenderer;
};

// Walks the rendered JSON rather than `findAllByType(Text)` — app code resolves
// `react-native` through the local resolver proxy, so a `Text` imported here is a
// different module instance and never matches. Same reason as StreakWidget.test.tsx.
const getTextLines = (component: renderer.ReactTestRenderer): string[] => {
    const lines: string[] = [];

    const walk = (node: any) => {
        if (!node || typeof node === 'string') {
            return;
        }
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        const children = node.children || [];
        if (node.type === 'Text') {
            const line = children.filter((child: any) => typeof child === 'string').join('');
            if (line.trim()) {
                lines.push(line);
            }
        }
        children.forEach(walk);
    };

    walk(component.toJSON());

    return lines;
};

describe('HabitCard — cadence label', () => {
    /**
     * The two cases the label used to get wrong. It required `frequencyType === 'weekly'`
     * before honouring a weekday schedule, so a goal the server scheduled on Mon/Wed/Fri
     * rendered as either "3x per custom" or "Every day" depending on its `frequencyType` —
     * with nothing on screen to suggest the label and the schedule disagreed.
     */
    it('lets a weekday schedule win over frequencyType, in both directions', () => {
        const asCustom = getTextLines(renderCard({
            habitGoal: buildGoal({ frequencyType: 'custom', targetDaysOfWeek: [1, 3, 5] }),
        }));
        expect(asCustom).toContain(
            'pages.habits.daysOfWeekShort.mon, pages.habits.daysOfWeekShort.wed, pages.habits.daysOfWeekShort.fri',
        );

        const asDaily = getTextLines(renderCard({
            habitGoal: buildGoal({ frequencyType: 'daily', targetDaysOfWeek: [1, 3, 5] }),
        }));
        expect(asDaily).toContain(
            'pages.habits.daysOfWeekShort.mon, pages.habits.daysOfWeekShort.wed, pages.habits.daysOfWeekShort.fri',
        );
        expect(asDaily).not.toContain('pages.habits.frequency.daily');
    });

    it('reads a bare count as N per week, whatever the frequencyType spells it', () => {
        expect(getTextLines(renderCard({
            habitGoal: buildGoal({ frequencyType: 'custom', frequencyCount: 4 }),
        }))).toContain('pages.habits.frequency.weekly(4)');
    });

    it('keeps the daily label for a daily habit', () => {
        expect(getTextLines(renderCard())).toContain('pages.habits.frequency.daily');
    });
});

describe('HabitCard — week progress chip', () => {
    const weeklyGoal = buildGoal({ frequencyType: 'weekly', frequencyCount: 4 });

    it('renders the tally when the server sent one', () => {
        expect(getTextLines(renderCard({
            habitGoal: weeklyGoal,
            weekProgress: {
                done: 2, target: 4, daysLeft: 3, isRequiredToday: false, isMet: false,
            },
        }))).toContain('pages.habits.cadence.weekProgress(2,4)');
    });

    it('switches to the met copy once the week is discharged', () => {
        expect(getTextLines(renderCard({
            habitGoal: weeklyGoal,
            weekProgress: {
                done: 4, target: 4, daysLeft: 3, isRequiredToday: false, isMet: true,
            },
        }))).toContain('pages.habits.cadence.weekProgressMet(4,4)');
    });

    it('renders nothing at all when weekProgress is absent', () => {
        // Absent means *unknown* — the server could not resolve the user's week, or it
        // predates the field entirely. "0 of 4" shown to someone who trained four times is
        // worse than showing nothing, so there must be no chip rather than an empty one.
        const lines = getTextLines(renderCard({ habitGoal: weeklyGoal }));
        expect(lines.some((line) => line.startsWith('pages.habits.cadence.weekProgress'))).toBe(false);
    });

    it('stays quiet for a daily habit, whose progress is the streak', () => {
        expect(getTextLines(renderCard({
            weekProgress: {
                done: 3, target: 7, daysLeft: 4, isRequiredToday: true, isMet: false,
            },
        })).some((line) => line.startsWith('pages.habits.cadence.weekProgress'))).toBe(false);
    });
});
