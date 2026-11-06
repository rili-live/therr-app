import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

import DailyStreakCalendar from '../../main/components/Habits/DailyStreakCalendar';
import { buildStyles as buildHabitsStyles } from '../../main/styles/habits';

const themeHabits = buildHabitsStyles('light') as any;

const translate = (key: string, params?: any) => (
    params ? `${key}(${Object.values(params).join(',')})` : key
);

// November 2026: 1–5 as in the reference design (frozen 2nd), today the 6th, rest future.
const days = Array.from({ length: 30 }, (_unused, index) => {
    const dayOfMonth = index + 1;
    const date = `2026-11-${String(dayOfMonth).padStart(2, '0')}`;
    let status = 'future';
    if (dayOfMonth <= 5) {
        status = dayOfMonth === 2 ? 'frozen' : 'upheld';
    } else if (dayOfMonth === 6) {
        status = 'pending';
    }
    return { date, status, isToday: dayOfMonth === 6 };
}) as any;

const render = () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
        component = renderer.create(
            <DailyStreakCalendar days={days} themeHabits={themeHabits} translate={translate} />,
        );
    });
    // @ts-ignore - assigned synchronously inside act
    return component as renderer.ReactTestRenderer;
};

// Walks the rendered JSON — see StreakWidget.test.tsx for why not `findAllByType`.
const collect = (node: any, predicate: (node: any) => boolean, found: any[] = []): any[] => {
    if (!node || typeof node === 'string') {
        return found;
    }
    if (Array.isArray(node)) {
        node.forEach((child) => collect(child, predicate, found));
        return found;
    }
    if (predicate(node)) {
        found.push(node);
    }
    (node.children || []).forEach((child: any) => collect(child, predicate, found));
    return found;
};

describe('DailyStreakCalendar', () => {
    it('renders every day of the month with a status label', () => {
        const tree = render().toJSON();
        const labelled = collect(tree, (node) => typeof node.props?.accessibilityLabel === 'string'
            && node.props.accessibilityLabel.startsWith('pages.dailyStreak.dayStatus.'));
        expect(labelled).toHaveLength(30);
        expect(labelled[1].props.accessibilityLabel).toBe('pages.dailyStreak.dayStatus.frozen(2026-11-02)');
        expect(labelled[5].props.accessibilityLabel).toBe('pages.dailyStreak.dayStatus.pending(2026-11-06)');
    });

    it('marks only frozen days with the snowflake', () => {
        const tree = render().toJSON();
        const snowflakes = collect(tree, (node) => (node.children || []).includes('❄️'));
        expect(snowflakes).toHaveLength(1);
    });

    it('draws the run band across the five kept days and not past them', () => {
        const tree = render().toJSON();
        const band = themeHabits.styles.dailyStreakBand;
        const bands = collect(tree, (node) => Array.isArray(node.props?.style)
            && node.props.style.includes(band));
        // Days 1–5 in one row: 1 right half, 2–4 both halves, 5 left half = 8 halves.
        expect(bands).toHaveLength(8);
    });
});
