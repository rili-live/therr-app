import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

import StreakWidget from '../../main/components/Habits/StreakWidget';
import { buildStyles as buildHabitsStyles } from '../../main/styles/habits';

const themeHabits = buildHabitsStyles('light') as any;

const translate = (key: string, params?: any) => (
    params ? `${key}(${Object.values(params).join(',')})` : key
);

const buildStreak = (overrides: any = {}) => ({
    id: 'streak-1',
    userId: 'user-1',
    habitGoalId: 'goal-1',
    currentStreak: 1,
    longestStreak: 4,
    gracePeriodDays: 2,
    graceDaysUsed: 1,
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    riskLevel: 'safe',
    ...overrides,
}) as any;

const renderWidget = (props: any) => {
    let component: renderer.ReactTestRenderer;
    act(() => {
        component = renderer.create(
            <StreakWidget
                streak={buildStreak()}
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
// different module instance and never matches.
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

describe('StreakWidget', () => {
    it('renders milestone and grace days on their own rows by default', () => {
        const component = renderWidget({});
        const lines = getTextLines(component);

        expect(lines).toContain('pages.habits.streak.nextMilestone(3)');
        expect(lines).toContain('pages.habits.streak.graceDaysRemaining(1)');
        expect(lines).toContain('1/3');
    });

    it('collapses milestone, progress and grace days onto a single line when compact', () => {
        const component = renderWidget({ compact: true });
        const lines = getTextLines(component);

        expect(lines).toContain(
            '1/3 · pages.habits.streak.nextMilestoneCompact(3) · pages.habits.streak.graceDaysCompact(1)',
        );
        expect(lines).not.toContain('pages.habits.streak.nextMilestone(3)');
        expect(lines).not.toContain('pages.habits.streak.graceDaysRemaining(1)');
    });

    it('renders fewer lines when compact than by default', () => {
        expect(getTextLines(renderWidget({ compact: true })).length)
            .toBeLessThan(getTextLines(renderWidget({})).length);
    });

    it('omits the grace days summary when none remain', () => {
        const component = renderWidget({
            compact: true,
            streak: buildStreak({ gracePeriodDays: 1, graceDaysUsed: 1 }),
        });

        expect(getTextLines(component)).toContain('1/3 · pages.habits.streak.nextMilestoneCompact(3)');
    });

    it('still renders the title and streak badge when compact', () => {
        const lines = getTextLines(renderWidget({ compact: true }));

        expect(lines).toContain('pages.habits.currentStreak');
        expect(lines.join(' ')).toContain('pages.habits.streak.day');
    });
});
